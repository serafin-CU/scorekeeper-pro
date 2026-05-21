import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_BASE = 'https://v3.football.api-sports.io';

function apiHeaders() {
    return {
        'x-apisports-key': Deno.env.get('API_FUTBOL'),
        'Accept': 'application/json'
    };
}

async function apiFetch(path) {
    const url = `${API_BASE}${path}`;
    console.log(`[leaguesCheck] GET ${url}`);
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Check what league=1 actually is
        const league1Data = await apiFetch('/leagues?id=1&season=2026');
        
        // Search for World Cup league ID
        const worldCupSearch = await apiFetch('/leagues?search=World Cup&season=2026');
        
        // Also check FIFA World Cup specifically
        const fifaWorldCup = await apiFetch('/leagues?name=FIFA World Cup&season=2026');
        
        return Response.json({
            league_id_1: league1Data.response?.[0] || null,
            world_cup_search: worldCupSearch.response || [],
            fifa_world_cup: fifaWorldCup.response || []
        });
        
    } catch (error) {
        console.error('[leaguesCheck] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});