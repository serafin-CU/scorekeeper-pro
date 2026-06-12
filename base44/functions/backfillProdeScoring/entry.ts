import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Backfill Prode scoring for all matches that have a MatchResultFinal but whose
 * predictions were never scored into PointsLedger. Idempotent per user+match.
 * Scoring rules: exact score = 5, correct outcome (winner/draw) = 3.
 *
 * Admin only. POST {}
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const finals = await base44.asServiceRole.entities.MatchResultFinal.list('-finalized_at', 1000);

        // Load all existing PRODE ledger entries once and dedupe in memory.
        const existingLedger = await base44.asServiceRole.entities.PointsLedger.filter({ mode: 'PRODE' });
        const scoredKeys = new Set(existingLedger.map(e => e.source_id));

        let totalScored = 0;
        let totalSkipped = 0;
        const perMatch = [];

        for (const finalResult of finals) {
            const matchId = finalResult.match_id;
            const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id: matchId });

            let scored = 0;
            let skipped = 0;

            for (const pred of predictions) {
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

                const sourceId = 'PRODE:MATCH:' + matchId + ':' + pred.user_id;
                if (scoredKeys.has(sourceId)) {
                    skipped++;
                    continue;
                }

                await base44.asServiceRole.entities.PointsLedger.create({
                    user_id: pred.user_id,
                    mode: 'PRODE',
                    source_type: 'MATCH',
                    source_id: sourceId,
                    points,
                    breakdown_json: JSON.stringify(breakdown)
                });
                scoredKeys.add(sourceId);
                scored++;
                await new Promise(r => setTimeout(r, 300));
            }

            totalScored += scored;
            totalSkipped += skipped;
            if (scored > 0 || skipped > 0) {
                perMatch.push({ match_id: matchId, scored, skipped });
            }
        }

        return Response.json({
            ok: true,
            finals_checked: finals.length,
            total_scored: totalScored,
            total_skipped: totalSkipped,
            per_match: perMatch
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});