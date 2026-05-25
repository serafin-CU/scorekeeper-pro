import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Purge Fantasy Demo Data — Admin-only
 *
 * action: 'detect'  — dry run, returns counts + sample rows (no writes)
 * action: 'purge'   — deletes: FantasySquadPlayer → FantasySquad → PointsLedger(mode=FANTASY)
 *                     Does NOT touch: Player, Team, ProdePrediction, PointsLedger(mode=PRODE)
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

        // Load all data needed for both actions
        const [allSquads, allSquadPlayers, fantasyLedger] = await Promise.all([
            base44.asServiceRole.entities.FantasySquad.list(),
            base44.asServiceRole.entities.FantasySquadPlayer.list(),
            base44.asServiceRole.entities.PointsLedger.filter({ mode: 'FANTASY' })
        ]);

        // ── DETECT (dry run) ────────────────────────────────────────────────
        if (action === 'detect') {
            return Response.json({
                ok: true,
                action: 'detect',
                dry_run: true,
                counts: {
                    fantasy_squads: allSquads.length,
                    fantasy_squad_players: allSquadPlayers.length,
                    fantasy_ledger_entries: fantasyLedger.length
                },
                samples: {
                    fantasy_squads: allSquads.slice(0, 3).map(s => ({
                        id: s.id,
                        user_id: s.user_id,
                        phase: s.phase,
                        status: s.status,
                        created_date: s.created_date
                    })),
                    fantasy_squad_players: allSquadPlayers.slice(0, 3).map(sp => ({
                        id: sp.id,
                        squad_id: sp.squad_id,
                        player_id: sp.player_id,
                        slot_type: sp.slot_type
                    })),
                    fantasy_ledger_entries: fantasyLedger.slice(0, 3).map(e => ({
                        id: e.id,
                        user_id: e.user_id,
                        mode: e.mode,
                        points: e.points,
                        source_id: e.source_id
                    }))
                }
            });
        }

        // ── PURGE (live run) ────────────────────────────────────────────────
        if (action === 'purge') {
            let deletedSquadPlayers = 0, deletedSquads = 0, deletedLedger = 0;
            const errors = [];

            const sleep = (ms) => new Promise(r => setTimeout(r, ms));

            // Step 1: delete FantasySquadPlayer rows (sequential, 120ms pause, try/catch per record)
            for (const sp of allSquadPlayers) {
                try {
                    await base44.asServiceRole.entities.FantasySquadPlayer.delete(sp.id);
                    deletedSquadPlayers++;
                    await sleep(120);
                } catch (err) {
                    const msg = `FantasySquadPlayer ${sp.id}: ${err.message}`;
                    console.error(`[purge] ${msg}`);
                    errors.push(msg);
                    await sleep(300); // longer pause on rate limit
                }
            }

            // Step 2: delete FantasySquad rows
            for (const sq of allSquads) {
                try {
                    await base44.asServiceRole.entities.FantasySquad.delete(sq.id);
                    deletedSquads++;
                    await sleep(120);
                } catch (err) {
                    const msg = `FantasySquad ${sq.id}: ${err.message}`;
                    console.error(`[purge] ${msg}`);
                    errors.push(msg);
                    await sleep(300);
                }
            }

            // Step 3: delete FANTASY-mode PointsLedger entries
            for (const e of fantasyLedger) {
                try {
                    await base44.asServiceRole.entities.PointsLedger.delete(e.id);
                    deletedLedger++;
                    await sleep(120);
                } catch (err) {
                    const msg = `PointsLedger ${e.id}: ${err.message}`;
                    console.error(`[purge] ${msg}`);
                    errors.push(msg);
                    await sleep(300);
                }
            }

            return Response.json({
                ok: errors.length === 0,
                action: 'purge',
                dry_run: false,
                deleted: {
                    fantasy_squad_players: deletedSquadPlayers,
                    fantasy_squads: deletedSquads,
                    fantasy_ledger_entries: deletedLedger
                },
                errors
            });
        }

        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    } catch (error) {
        console.error('[purgeFantasyDemoData] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});