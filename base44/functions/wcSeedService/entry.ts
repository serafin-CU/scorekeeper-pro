import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();

        if (!['seed_wc2026', 'reseed_matches', 'reset_test_data', 'purge_stale_ledger'].includes(body.action)) {
            return Response.json({ error: 'Invalid action. Use reset_test_data or purge_stale_ledger' }, { status: 400 });
        }

        // ── DEPRECATED: seed_wc2026 and reseed_matches ──
        // Hard-coded fixture data has been removed. API-Football is the single source of truth.
        if (body.action === 'seed_wc2026' || body.action === 'reseed_matches') {
            return Response.json({
                error: 'seed_wc2026 is deprecated. Use /AdminWCDataSync (API-Football is the single source of truth for fixture data).',
                ok: false,
            }, { status: 410 });
        }

        // ── purge_stale_ledger: delete all PointsLedger entries except those created in the last 30 minutes ──
        if (body.action === 'purge_stale_ledger') {
            console.log('Purging stale PointsLedger entries...');
            const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            const allEntries = await base44.asServiceRole.entities.PointsLedger.list();
            const toDelete = allEntries.filter(e => e.created_date < cutoff);

            for (let i = 0; i < toDelete.length; i += 20) {
                const chunk = toDelete.slice(i, i + 20);
                await Promise.all(chunk.map(e => base44.asServiceRole.entities.PointsLedger.delete(e.id)));
                if (i + 20 < toDelete.length) await new Promise(r => setTimeout(r, 300));
            }

            console.log(`Purged ${toDelete.length} stale ledger entries, kept ${allEntries.length - toDelete.length} recent ones.`);
            return Response.json({
                success: true,
                message: `Purged ${toDelete.length} stale PointsLedger entries (kept ${allEntries.length - toDelete.length} from last 30 min)`,
                deleted: toDelete.length,
                kept: allEntries.length - toDelete.length,
            });
        }

        // ── reset_test_data: wipe scores/squads/badges, reset match statuses ──
        if (body.action === 'reset_test_data') {
            console.log('Resetting test data...');

            async function deleteAll(entity) {
                const items = await entity.list();
                for (let i = 0; i < items.length; i += 20) {
                    const chunk = items.slice(i, i + 20);
                    await Promise.all(chunk.map(x => entity.delete(x.id)));
                    if (i + 20 < items.length) await new Promise(r => setTimeout(r, 300));
                }
                return items.length;
            }

            const [
                pointsDeleted,
                badgesDeleted,
                scoringJobsDeleted,
                matchResultsDeleted,
                playerStatsDeleted,
                matchValidationsDeleted,
                squadPlayersDeleted,
                squadsDeleted,
            ] = await Promise.all([
                deleteAll(base44.asServiceRole.entities.PointsLedger),
                deleteAll(base44.asServiceRole.entities.BadgeAward),
                deleteAll(base44.asServiceRole.entities.ScoringJob),
                deleteAll(base44.asServiceRole.entities.MatchResultFinal),
                deleteAll(base44.asServiceRole.entities.FantasyMatchPlayerStats),
                deleteAll(base44.asServiceRole.entities.MatchValidation),
                deleteAll(base44.asServiceRole.entities.FantasySquadPlayer),
                deleteAll(base44.asServiceRole.entities.FantasySquad),
            ]);

            // Reset all match statuses to SCHEDULED
            const allMatches = await base44.asServiceRole.entities.Match.list();
            for (let i = 0; i < allMatches.length; i += 20) {
                const chunk = allMatches.slice(i, i + 20);
                await Promise.all(chunk.map(m => base44.asServiceRole.entities.Match.update(m.id, { status: 'SCHEDULED' })));
                if (i + 20 < allMatches.length) await new Promise(r => setTimeout(r, 300));
            }

            console.log('Reset complete.');

            return Response.json({
                success: true,
                message: 'Test data reset successfully',
                summary: {
                    points_ledger_deleted: pointsDeleted,
                    badges_deleted: badgesDeleted,
                    scoring_jobs_deleted: scoringJobsDeleted,
                    match_results_deleted: matchResultsDeleted,
                    player_stats_deleted: playerStatsDeleted,
                    match_validations_deleted: matchValidationsDeleted,
                    squad_players_deleted: squadPlayersDeleted,
                    squads_deleted: squadsDeleted,
                    matches_reset_to_scheduled: allMatches.length,
                },
            });
        }

    } catch (error) {
        console.error('wcSeedService error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});