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
    console.log(`[apiProbe] GET ${url}`);
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText} for ${path}`);
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

        // PART B: Live API probe - league-wide players endpoint
        console.log('[apiProbe] Fetching page 1...');
        const page1Response = await apiFetch('/players?league=1&season=2026&page=1');
        
        const resultsCount = page1Response.results || 0;
        const pagingCurrent = page1Response.paging?.current || 1;
        const pagingTotal = page1Response.paging?.total || 1;
        
        console.log(`[apiProbe] Page 1: ${resultsCount} results, paging: ${pagingCurrent}/${pagingTotal}`);
        
        // First 5 players
        const first5 = (page1Response.response || []).slice(0, 5);
        const first5Data = first5.map(p => ({
            player_id: p.player?.id,
            player_name: p.player?.name,
            nationality: p.player?.nationality,
            team_name: p.statistics?.[0]?.team?.name
        }));
        
        console.log('[apiProbe] First 5 players:', JSON.stringify(first5Data, null, 2));
        
        // Target players to find
        const targets = {
            154: 'Messi',
            874: 'Ronaldo',
            278: 'Mbappe',
            184: 'Kane',
            1100: 'Haaland'
        };
        
        const found = {};
        const teamCounts = {};
        
        // Search all pages
        for (let page = 1; page <= pagingTotal; page++) {
            console.log(`[apiProbe] Searching page ${page}/${pagingTotal}...`);
            const response = await apiFetch(`/players?league=1&season=2026&page=${page}`);
            const players = response.response || [];
            
            // Count teams
            for (const p of players) {
                const teamName = p.statistics?.[0]?.team?.name;
                if (teamName) {
                    teamCounts[teamName] = (teamCounts[teamName] || 0) + 1;
                }
            }
            
            // Check for targets
            for (const p of players) {
                const playerId = p.player?.id;
                if (targets[playerId] && !found[playerId]) {
                    found[playerId] = {
                        id: playerId,
                        name: p.player?.name,
                        nationality: p.player?.nationality,
                        team_name: p.statistics?.[0]?.team?.name,
                        position: p.player?.position,
                        age: p.player?.age
                    };
                    console.log(`[apiProbe] FOUND: ${targets[playerId]} (ID:${playerId}) - ${p.player?.name} @ ${p.statistics?.[0]?.team?.name}`);
                }
            }
        }
        
        // Report missing
        const missing = [];
        for (const [id, name] of Object.entries(targets)) {
            if (!found[id]) {
                missing.push(`${name}(ID:${id})`);
            }
        }
        
        const distinctTeams = Object.keys(teamCounts);
        const teamDistribution = Object.entries(teamCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([team, count]) => `${team}: ${count} players`);
        
        return Response.json({
            part_b_results: {
                page_1_count: resultsCount,
                paging: { current: pagingCurrent, total: pagingTotal },
                first_5_players: first5Data,
                target_players: {
                    found: Object.values(found),
                    missing: missing
                },
                team_stats: {
                    distinct_teams: distinctTeams.length,
                    top_20_distribution: teamDistribution
                }
            }
        });
        
    } catch (error) {
        console.error('[apiProbe] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});