import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Squad Reconcile — Admin-only utility
 *
 * Actions:
 *   detect_stale_squads    — read-only: reports FantasySquadPlayer rows with dead player_ids
 *   cleanup_duplicate_squads — dry_run (default true): deletes orphan FantasySquad duplicates
 *                              per (user_id, phase), keeping the most recent. Pass dry_run: false to execute.
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        // ── DETECT STALE SQUADS ─────────────────────────────────────────────
        // Read-only. Reports FantasySquadPlayer rows whose player_id no longer
        // exists in the Player table. No writes.
        if (action === 'detect_stale_squads') {
            const [allSquadPlayers, allPlayers] = await Promise.all([
                base44.asServiceRole.entities.FantasySquadPlayer.list(),
                base44.asServiceRole.entities.Player.list()
            ]);

            const livePlayerIds = new Set(allPlayers.map(p => p.id));
            const deadRows = allSquadPlayers.filter(sp => !livePlayerIds.has(sp.player_id));
            const affectedSquadIds = [...new Set(deadRows.map(sp => sp.squad_id))];

            console.log(`[detect_stale_squads] ${deadRows.length} dead rows across ${affectedSquadIds.length} squads`);

            return Response.json({
                ok: true,
                action: 'detect_stale_squads',
                total_squad_player_rows: allSquadPlayers.length,
                dead_rows: deadRows.length,
                affected_squad_count: affectedSquadIds.length,
                affected_squad_ids: affectedSquadIds,
                sample_dead: deadRows.slice(0, 10).map(sp => ({
                    squad_player_id: sp.id,
                    squad_id: sp.squad_id,
                    dead_player_id: sp.player_id,
                    api_player_id: sp.api_player_id || null,
                    slot_type: sp.slot_type,
                    starter_position: sp.starter_position || null
                }))
            });
        }

        // ── CLEANUP DUPLICATE SQUADS ────────────────────────────────────────
        // Groups FantasySquad by (user_id, phase). For each group with >1 record,
        // keeps the most recent (by created_date), marks the rest for deletion.
        // dry_run: true (default) — report only, no writes.
        // dry_run: false — deletes orphan FantasySquad rows + their FantasySquadPlayer children.
        if (action === 'cleanup_duplicate_squads') {
            const dry_run = body.dry_run !== false; // default true

            const allSquads = await base44.asServiceRole.entities.FantasySquad.list();

            // Group by (user_id, phase)
            const grouped = {};
            for (const sq of allSquads) {
                const key = `${sq.user_id}::${sq.phase}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(sq);
            }

            // Identify orphans: all but the most-recent per group
            const orphans = [];
            for (const squads of Object.values(grouped)) {
                if (squads.length <= 1) continue;
                squads.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
                orphans.push(...squads.slice(1));
            }

            const orphanSummary = orphans.map(s => ({
                id: s.id,
                phase: s.phase,
                user_id: s.user_id,
                status: s.status,
                created_date: s.created_date,
                total_cost: s.total_cost
            }));

            if (dry_run) {
                console.log(`[cleanup_duplicate_squads] DRY RUN — would delete ${orphans.length} orphan squads`);
                return Response.json({
                    ok: true,
                    action: 'cleanup_duplicate_squads',
                    dry_run: true,
                    orphan_squads_count: orphans.length,
                    orphan_squads: orphanSummary
                });
            }

            // Live run: delete FantasySquadPlayer children first, then the squad
            let deletedSquads = 0;
            let deletedPlayers = 0;
            const errors = [];

            for (const sq of orphans) {
                let children = [];
                try {
                    children = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: sq.id });
                } catch (err) {
                    const msg = `Failed to fetch children for squad ${sq.id}: ${err.message}`;
                    console.error(`[cleanup_duplicate_squads] ${msg}`);
                    errors.push(msg);
                    continue;
                }

                // Delete children one at a time with per-record try/catch
                for (const sp of children) {
                    try {
                        await base44.asServiceRole.entities.FantasySquadPlayer.delete(sp.id);
                        deletedPlayers++;
                    } catch (err) {
                        const msg = `Failed to delete FantasySquadPlayer ${sp.id}: ${err.message}`;
                        console.error(`[cleanup_duplicate_squads] ${msg}`);
                        errors.push(msg);
                    }
                }

                // Delete the squad record
                try {
                    await base44.asServiceRole.entities.FantasySquad.delete(sq.id);
                    deletedSquads++;
                    console.log(`[cleanup_duplicate_squads] Deleted squad ${sq.id} (phase=${sq.phase}, user=${sq.user_id})`);
                } catch (err) {
                    const msg = `Failed to delete FantasySquad ${sq.id}: ${err.message}`;
                    console.error(`[cleanup_duplicate_squads] ${msg}`);
                    errors.push(msg);
                }
            }

            return Response.json({
                ok: errors.length === 0,
                action: 'cleanup_duplicate_squads',
                dry_run: false,
                deleted_squads: deletedSquads,
                deleted_squad_players: deletedPlayers,
                errors
            });
        }

        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    } catch (error) {
        console.error('[squadReconcile] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});