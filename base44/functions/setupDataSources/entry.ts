import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        return Response.json({
            ok: false,
            error: 'setupDataSources is deprecated. API-Football is the single source of truth. DataSource/MatchSourceLink infrastructure is not used in v1 (UnityCup WC 2026).'
        }, { status: 410 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});