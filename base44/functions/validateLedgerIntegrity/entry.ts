import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Validate PRODE ledger integrity and record the result as an analytics event.
 *
 * Two checks:
 *  1. Duplicate scan — no (user_id, source_id) pair should appear more than once.
 *  2. Scoring recompute — each user's ledger total must equal an independent
 *     recompute from finalized results (exact = 5, correct outcome = 3).
 *
 * Records a `ledger_integrity_check` analytics event with the outcome.
 * Runnable by an admin (manual) OR unattended by a scheduled automation.
 * POST {}
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        let user = null;
        try { user = await base44.auth.me(); } catch (_) { user = null; }
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // ── Load full PRODE ledger via pagination ──
        const ledger = [];
        let skip = 0;
        while (true) {
            const batch = await base44.asServiceRole.entities.PointsLedger.filter({ mode: 'PRODE' }, '-created_date', 1000, skip);
            ledger.push(...batch);
            if (batch.length < 1000) break;
            skip += 1000;
            if (skip > 500000) break;
        }

        // ── Check 1: duplicates ──
        const seen = new Set();
        let duplicateCount = 0;
        const ledgerTotals = {};
        for (const e of ledger) {
            const key = `${e.user_id}|${e.source_id}`;
            if (seen.has(key)) duplicateCount++;
            else seen.add(key);
            ledgerTotals[e.user_id] = (ledgerTotals[e.user_id] || 0) + (e.points || 0);
        }

        // ── Load finalized results ──
        const finals = [];
        skip = 0;
        while (true) {
            const batch = await base44.asServiceRole.entities.MatchResultFinal.filter({}, '-finalized_at', 1000, skip);
            finals.push(...batch);
            if (batch.length < 1000) break;
            skip += 1000;
            if (skip > 500000) break;
        }
        const finalByMatch = {};
        finals.forEach(f => { finalByMatch[f.match_id] = f; });

        // ── Load all predictions ──
        const preds = [];
        skip = 0;
        while (true) {
            const batch = await base44.asServiceRole.entities.ProdePrediction.filter({}, '-submitted_at', 1000, skip);
            preds.push(...batch);
            if (batch.length < 1000) break;
            skip += 1000;
            if (skip > 500000) break;
        }

        // ── Check 2: recompute expected totals ──
        const expected = {};
        for (const p of preds) {
            const f = finalByMatch[p.match_id];
            if (!f) continue;
            let pts = 0;
            if (p.pred_home_goals === f.home_goals && p.pred_away_goals === f.away_goals) {
                pts = 5;
            } else {
                const pw = p.pred_home_goals > p.pred_away_goals ? 'H' : p.pred_home_goals < p.pred_away_goals ? 'A' : 'D';
                const aw = f.home_goals > f.away_goals ? 'H' : f.home_goals < f.away_goals ? 'A' : 'D';
                if (pw === aw) pts = 3;
            }
            expected[p.user_id] = (expected[p.user_id] || 0) + pts;
        }

        const allUsers = new Set([...Object.keys(expected), ...Object.keys(ledgerTotals)]);
        const mismatches = [];
        for (const uid of allUsers) {
            const exp = expected[uid] || 0;
            const lg = ledgerTotals[uid] || 0;
            if (exp !== lg) mismatches.push({ user_id: uid, expected: exp, ledger: lg, diff: lg - exp });
        }

        const passed = duplicateCount === 0 && mismatches.length === 0;

        // ── Record the validation run as an analytics event ──
        base44.analytics.track({
            eventName: 'ledger_integrity_check',
            properties: {
                passed,
                ledger_entries: ledger.length,
                duplicate_count: duplicateCount,
                finalized_matches: finals.length,
                users_checked: allUsers.size,
                mismatch_count: mismatches.length,
                triggered_by: user ? 'admin' : 'scheduled'
            }
        });

        return Response.json({
            ok: true,
            passed,
            ledger_entries: ledger.length,
            duplicate_count: duplicateCount,
            finalized_matches: finals.length,
            users_checked: allUsers.size,
            mismatch_count: mismatches.length,
            mismatches: mismatches.slice(0, 20)
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});