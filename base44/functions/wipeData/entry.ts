import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CONFIRM_PHRASE = 'WIPE_UNITYCUP_PHASE2';

const ENTITIES_IN_ORDER = [
    'FantasyMatchPlayerStats',
    'MatchResultFinal',
    'MatchValidation',
    'MatchSourceLink',
    'IngestionEvent',
    'IngestionRun',
    'DataSource',
    'Player',
    'Match',
    'Team',
];

Deno.serve(async (req) => {
    const startMs = Date.now();
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();

        // --- COUNT action: returns how many records are in each entity ---
        if (body.action === 'count_all') {
            const db = base44.asServiceRole.entities;
            const counts = {};
            for (const entityName of ENTITIES_IN_ORDER) {
                try {
                    const records = await db[entityName].list('created_date', 1000);
                    counts[entityName] = records.length;
                } catch {
                    counts[entityName] = 0;
                }
            }
            return Response.json({ ok: true, counts });
        }

        // --- WIPE_BATCH action ---
        const { confirmation, entity: requestedEntity, batch_size: rawBatchSize, cumulative_deleted: cumulativeIn } = body;

        if (confirmation !== CONFIRM_PHRASE) {
            return Response.json({ error: 'Invalid confirmation phrase' }, { status: 403 });
        }

        const batchSize = Math.min(Math.max(parseInt(rawBatchSize) || 25, 1), 50);
        const db = base44.asServiceRole.entities;
        const cumulativeDeleted = cumulativeIn || {};

        // Determine which entity to process
        let targetEntity = requestedEntity || null;
        if (!targetEntity || !ENTITIES_IN_ORDER.includes(targetEntity)) {
            // Find first entity in order that still has records
            for (const e of ENTITIES_IN_ORDER) {
                const sample = await db[e].list('created_date', 1);
                if (sample && sample.length > 0) {
                    targetEntity = e;
                    break;
                }
            }
        }

        // If no entity has records — all done!
        if (!targetEntity) {
            // Write audit log
            await db.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'WIPE_ALL_TOURNAMENT_DATA',
                entity_type: 'MULTI',
                entity_id: 'ALL',
                reason: 'Manual full tournament data wipe via admin panel',
                details_json: JSON.stringify(cumulativeDeleted)
            });
            return Response.json({
                ok: true,
                has_more: false,
                all_done: true,
                cumulative_deleted: cumulativeDeleted,
                total_elapsed_ms: Date.now() - startMs
            });
        }

        // Fetch a batch from the target entity
        const records = await db[targetEntity].list('created_date', batchSize);

        let deletedInCall = 0;
        for (const rec of (records || [])) {
            try {
                await db[targetEntity].delete(rec.id);
                deletedInCall++;
            } catch (e) {
                console.warn(`[wipeData] Failed to delete ${targetEntity}:${rec.id}: ${e.message}`);
            }
            await sleep(80);
        }

        // Update cumulative
        cumulativeDeleted[targetEntity] = (cumulativeDeleted[targetEntity] || 0) + deletedInCall;

        // Check remaining in this entity
        const remainingCheck = await db[targetEntity].list('created_date', 1);
        const entityEmpty = !remainingCheck || remainingCheck.length === 0;

        // Determine next entity
        let nextEntity = targetEntity;
        if (entityEmpty) {
            const idx = ENTITIES_IN_ORDER.indexOf(targetEntity);
            nextEntity = null;
            for (let i = idx + 1; i < ENTITIES_IN_ORDER.length; i++) {
                const sample = await db[ENTITIES_IN_ORDER[i]].list('created_date', 1);
                if (sample && sample.length > 0) {
                    nextEntity = ENTITIES_IN_ORDER[i];
                    break;
                }
            }
        }

        const allDone = entityEmpty && nextEntity === null;

        if (allDone) {
            await db.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'WIPE_ALL_TOURNAMENT_DATA',
                entity_type: 'MULTI',
                entity_id: 'ALL',
                reason: 'Manual full tournament data wipe via admin panel',
                details_json: JSON.stringify(cumulativeDeleted)
            });
        }

        return Response.json({
            ok: true,
            entity_processed: targetEntity,
            deleted_in_this_call: deletedInCall,
            entity_now_empty: entityEmpty,
            next_entity: nextEntity,
            has_more: !allDone,
            all_done: allDone,
            cumulative_deleted: cumulativeDeleted,
            total_elapsed_ms: Date.now() - startMs
        });

    } catch (error) {
        console.error('[wipeData] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});