import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Job Runner
 * Processes ScoringJob records for various modes
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin-only job
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { job_id } = await req.json();

        if (!job_id) {
            return Response.json({ error: 'job_id required' }, { status: 400 });
        }

        // Fetch the job
        const job = await base44.asServiceRole.entities.ScoringJob.get(job_id);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Check if already done
        if (job.status === 'DONE') {
            return Response.json({ status: 'ALREADY_DONE', job_id });
        }

        // Check if stuck in RUNNING (older than 30 min)
        if (job.status === 'RUNNING') {
            const updatedAt = new Date(job.updated_date);
            const now = new Date();
            const ageMinutes = (now - updatedAt) / (1000 * 60);
            if (ageMinutes < 30) {
                return Response.json({ status: 'ALREADY_RUNNING', job_id });
            }
            // Allow retry
        }

        // Mark as RUNNING
        await base44.asServiceRole.entities.ScoringJob.update(job_id, {
            status: 'RUNNING'
        });

        try {
            let result = null;

            if (job.mode === 'PRODE') {
                result = await handleProdeScoring(base44, job);
            } else {
                throw new Error(`Unsupported job mode: ${job.mode}`);
            }

            // Mark as DONE
            await base44.asServiceRole.entities.ScoringJob.update(job_id, {
                status: 'DONE'
            });

            return Response.json({
                status: 'SUCCESS',
                job_id,
                result
            });

        } catch (error) {
            // Mark as FAILED
            await base44.asServiceRole.entities.ScoringJob.update(job_id, {
                status: 'FAILED',
                error_message: error.message
            });

            return Response.json({
                status: 'FAILED',
                job_id,
                error: error.message
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Job runner error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function handleProdeScoring(base44, job) {
    // Extract match_id from source_id (format: "MATCH:123")
    const match_id = job.source_id.split(':')[1];
    if (!match_id) {
        throw new Error('Invalid source_id format for PRODE job');
    }

    // Fetch the finalized match result
    const results = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id });
    if (results.length === 0) {
        throw new Error('No MatchResultFinal found for match ' + match_id);
    }
    const finalResult = results[0];

    // Fetch all predictions for this match
    const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id });

    let scored_count = 0;
    let skipped_count = 0;

    for (const pred of predictions) {
        let points = 0;
        const breakdown = { exact_score: 0, correct_outcome: 0, mvp_bonus: 0, total: 0 };

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

        if (pred.pred_mvp_player_id && finalResult.mvp_player_id &&
            pred.pred_mvp_player_id === finalResult.mvp_player_id) {
            breakdown.mvp_bonus = 2;
            points += 2;
        }

        breakdown.total = points;

        const source_id = 'PRODE:MATCH:' + match_id + ':' + pred.user_id;

        // Idempotency check
        const existing = await base44.asServiceRole.entities.PointsLedger.filter({
            user_id: pred.user_id,
            source_id
        });

        if (existing.length > 0) {
            skipped_count++;
            continue;
        }

        await base44.asServiceRole.entities.PointsLedger.create({
            user_id: pred.user_id,
            mode: 'PRODE',
            source_type: 'MATCH',
            source_id,
            points,
            breakdown_json: JSON.stringify(breakdown)
        });
        scored_count++;
    }

    return { match_id, predictions_scored: scored_count, predictions_skipped: skipped_count };
}