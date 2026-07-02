import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Computes, per user, the longest run of consecutive EXACT-score Prode hits
 * (PointsLedger rows with points === 5), ordered by match kickoff time.
 * Read-only analytics. Admin-only.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Kickoff time per match id (to order a user's results chronologically)
        const matches = await base44.asServiceRole.entities.Match.list();
        const kickoffByMatch = {};
        for (const m of matches) kickoffByMatch[m.id] = new Date(m.kickoff_at).getTime();
        const matchIdSet = new Set(matches.map(m => m.id));

        // Paginate the full PRODE ledger
        const rows = [];
        let skip = 0;
        while (true) {
            const batch = await base44.asServiceRole.entities.PointsLedger.filter(
                { mode: 'PRODE' }, '-created_date', 500, skip
            );
            for (const r of batch) {
                // source_id = 'PRODE:MATCH:<matchId>:<userId>' — resolve robustly:
                // whichever of the two trailing segments is a real match id is the match.
                const parts = (r.source_id || '').split(':');
                let matchId = null;
                for (const seg of parts) {
                    if (matchIdSet.has(seg)) { matchId = seg; break; }
                }
                if (!matchId) continue;
                rows.push({ userId: r.user_id, matchId, points: r.points, kickoff: kickoffByMatch[matchId] });
            }
            if (batch.length < 500) break;
            skip += 500;
            if (skip > 500000) break;
        }

        // Group by user
        const byUser = {};
        for (const row of rows) {
            if (!byUser[row.userId]) byUser[row.userId] = new Map();
            // dedupe per match (keep any one — points are deterministic per match)
            if (!byUser[row.userId].has(row.matchId)) byUser[row.userId].set(row.matchId, row);
        }

        const results = [];
        for (const [userId, map] of Object.entries(byUser)) {
            const list = Array.from(map.values()).sort((a, b) => a.kickoff - b.kickoff);
            let best = 0, cur = 0, exactTotal = 0;
            for (const r of list) {
                if (r.points === 5) { cur++; exactTotal++; if (cur > best) best = cur; }
                else cur = 0;
            }
            results.push({ userId, longestExactStreak: best, exactTotal, matchesScored: list.length });
        }

        results.sort((a, b) =>
            b.longestExactStreak - a.longestExactStreak ||
            b.exactTotal - a.exactTotal
        );

        const top = results.slice(0, 10);

        // Resolve names
        const users = await base44.asServiceRole.entities.User.list();
        const nameById = {};
        for (const u of users) nameById[u.id] = u.full_name || u.email;
        for (const t of top) t.name = nameById[t.userId] || t.userId;

        return Response.json({ ok: true, top });
    } catch (error) {
        console.error('[exactStreakLeaderboard] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});