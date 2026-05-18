import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wipeBatch(entityClient, batchSize = 50, delayBetweenItems = 150) {
    let totalDeleted = 0;
    while (true) {
        const records = await entityClient.list('created_date', batchSize);
        if (!records || records.length === 0) break;
        for (const rec of records) {
            await entityClient.delete(rec.id);
            await sleep(delayBetweenItems);
        }
        totalDeleted += records.length;
        console.log(`[wipeData] Deleted batch of ${records.length} (total: ${totalDeleted})`);
        if (records.length < batchSize) break;
        await sleep(800);
    }
    return totalDeleted;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        if (body.action !== 'wipe_all') {
            return Response.json({ error: 'Unknown action' }, { status: 400 });
        }

        const db = base44.asServiceRole.entities;
        const counts = {};
        const BATCH = 50;
        const ITEM_DELAY = 150;

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

        for (const entityName of ENTITIES_IN_ORDER) {
            console.log(`[wipeData] Wiping ${entityName}...`);
            const deleted = await wipeBatch(db[entityName], BATCH, ITEM_DELAY);
            counts[entityName] = deleted;
            console.log(`[wipeData] ${entityName}: ${deleted} deleted`);
            await sleep(800);
        }

        // Log to AdminAuditLog
        await db.AdminAuditLog.create({
            admin_user_id: user.id,
            actor_type: 'ADMIN',
            action: 'WIPE_ALL_TOURNAMENT_DATA',
            entity_type: 'MULTI',
            entity_id: 'ALL',
            reason: 'Manual full tournament data wipe via admin panel',
            details_json: JSON.stringify(counts)
        });

        return Response.json({ ok: true, counts });

    } catch (error) {
        console.error('[wipeData] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});