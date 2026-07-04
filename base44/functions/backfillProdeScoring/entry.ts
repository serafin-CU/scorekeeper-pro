import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Safety-net Prode scoring. Idempotent per user+match.
 * Scoring rules: exact score = 5, correct outcome (winner/draw) = 3.
 *
 * Design goals (learned the hard way):
 *  - Must be CHEAP and FAST on every scheduled run so it never hits the rate
 *    limit or the 180s timeout. The old version re-read the ENTIRE PointsLedger
 *    on every run — that got prohibitively expensive as the ledger grew and
 *    caused persistent "Rate limit exceeded" failures.
 *  - New approach: only look at matches finalized in a recent window (default
 *    last 48h, override with { hours }), and for each one read ONLY that match's
 *    ledger entries (small, scoped) to decide what's missing. This keeps every
 *    run bounded no matter how large the total ledger gets.
 *  - A full historical sweep is still available on demand via { all: true }.
 *
 * Runnable by an admin (manual) OR unattended by a scheduled automation.
 * POST {}  |  POST { hours: 72 }  |  POST { all: true }
 */
Deno.serve(async (req) => {
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 120000;

    try {
        const base44 = createClientFromRequest(req);
        let user = null;
        try { user = await base44.auth.me(); } catch (_) { user = null; }
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        let body = {};
        try { body = await req.json(); } catch (_) { body = {}; }
        const windowHours = typeof body.hours === 'number' ? body.hours : 48;
        const doAll = body.all === true;

        // Most-recently finalized first.
        const finals = await base44.asServiceRole.entities.MatchResultFinal.list('-finalized_at', 1000);
        const cutoff = Date.now() - windowHours * 3600 * 1000;
        const recentFinals = doAll
            ? finals
            : finals.filter(f => {
                const t = f.finalized_at ? new Date(f.finalized_at).getTime() : 0;
                return t >= cutoff;
            });

        let totalScored = 0;
        let totalSkipped = 0;
        let incomplete = false;
        const perMatch = [];

        for (const finalResult of recentFinals) {
            if (Date.now() - startedAt > TIME_BUDGET_MS) {
                incomplete = true;
                break;
            }

            const matchId = finalResult.match_id;

            // Read ONLY this match's existing ledger entries (small, scoped).
            const existing = await base44.asServiceRole.entities.PointsLedger.filter({
                mode: 'PRODE',
                source_type: 'MATCH'
            });
            const scoredForMatch = new Set(
                existing
                    .filter(e => (e.source_id || '').startsWith('PRODE:MATCH:' + matchId + ':'))
                    .map(e => e.source_id)
            );

            const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id: matchId });

            // Fast path: already fully scored — skip without any writes.
            if (predictions.length > 0 && scoredForMatch.size >= predictions.length) {
                totalSkipped += predictions.length;
                continue;
            }

            const toCreate = [];
            let skipped = 0;

            for (const pred of predictions) {
                const sourceId = 'PRODE:MATCH:' + matchId + ':' + pred.user_id;
                if (scoredForMatch.has(sourceId)) {
                    skipped++;
                    continue;
                }

                let points = 0;
                const breakdown = { exact_score: 0, correct_outcome: 0, total: 0 };

                if (pred.pred_home_goals === finalResult.home_goals &&
                    pred.pred_away_goals === finalResult.away_goals) {
                    breakdown.exact_score = 5;
                    points += 5;
                } else {
                    const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'home' :
                        pred.pred_home_goals < pred.pred_away_goals ? 'away' : 'draw';
                    const actualWinner = finalResult.home_goals > finalResult.away_goals ? 'home' :
                        finalResult.home_goals < finalResult.away_goals ? 'away' : 'draw';
                    if (predWinner === actualWinner) {
                        breakdown.correct_outcome = 3;
                        points += 3;
                    }
                }
                breakdown.total = points;

                toCreate.push({
                    user_id: pred.user_id,
                    mode: 'PRODE',
                    source_type: 'MATCH',
                    source_id: sourceId,
                    points,
                    breakdown_json: JSON.stringify(breakdown)
                });
            }

            // Bulk write in batches of 25 with a short pause to respect the write rate limit.
            for (let i = 0; i < toCreate.length; i += 25) {
                await base44.asServiceRole.entities.PointsLedger.bulkCreate(toCreate.slice(i, i + 25));
                await new Promise(r => setTimeout(r, 1200));
            }

            totalScored += toCreate.length;
            totalSkipped += skipped;
            if (toCreate.length > 0) {
                perMatch.push({ match_id: matchId, scored: toCreate.length, skipped });
            }
        }

        return Response.json({
            ok: true,
            incomplete,
            window_hours: doAll ? 'ALL' : windowHours,
            finals_checked: recentFinals.length,
            total_scored: totalScored,
            total_skipped: totalSkipped,
            elapsed_ms: Date.now() - startedAt,
            per_match: perMatch
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});