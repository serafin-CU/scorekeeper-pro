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
    console.log(`[deepProbe] GET ${url}`);
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

        // Get all teams
        const teamsResponse = await apiFetch('/teams?league=1&season=2026');
        const teams = teamsResponse.response || [];
        
        console.log(`[deepProbe] Found ${teams.length} teams`);
        
        // Check squad endpoint for a few teams
        const sampleTeamIds = [1, 2, 26, 10]; // Belgium, France, Argentina, England
        const squadData = [];
        
        for (const teamId of sampleTeamIds) {
            try {
                const squads = await apiFetch(`/players/squads?team=${teamId}`);
                const teamName = teams.find(t => t.team?.id === teamId)?.team?.name || `Team ${teamId}`;
                
                const playerCount = squads?.[0]?.players?.length || 0;
                const samplePlayers = (squads?.[0]?.players || []).slice(0, 3);
                
                squadData.push({
                    team_id: teamId,
                    team_name: teamName,
                    player_count: playerCount,
                    sample_players: samplePlayers.map(p => ({
                        id: p.id,
                        name: p.name,
                        position: p.position,
                        age: p.age,
                        nationality: p.nationality
                    }))
                });
            } catch (err) {
                squadData.push({
                    team_id: teamId,
                    team_name: `Error: ${err.message}`
                });
            }
        }
        
        // Check /players endpoint for these teams
        const playersData = [];
        for (const teamId of sampleTeamIds) {
            try {
                const players = await apiFetch(`/players?team=${teamId}&season=2026&page=1`);
                const teamName = teams.find(t => t.team?.id === teamId)?.team?.name || `Team ${teamId}`;
                
                const playerCount = players.length || 0;
                const samplePlayers = (players || []).slice(0, 3).map(p => ({
                    player_id: p.player?.id,
                    player_name: p.player?.name,
                    has_statistics: !!p.statistics?.[0],
                    team_name: p.statistics?.[0]?.team?.name,
                    rating: p.statistics?.[0]?.games?.rating,
                    goals: p.statistics?.[0]?.goals?.total,
                    apps: p.statistics?.[0]?.games?.appearences
                }));
                
                playersData.push({
                    team_id: teamId,
                    team_name: teamName,
                    players_returned: playerCount,
                    sample: samplePlayers
                });
            } catch (err) {
                playersData.push({
                    team_id: teamId,
                    team_name: `Error: ${err.message}`
                });
            }
        }
        
        return Response.json({
            total_teams: teams.length,
            teams_list: teams.map(t => ({ id: t.team.id, name: t.team.name })),
            squad_endpoint_data: squadData,
            players_endpoint_data: playersData
        });
        
    } catch (error) {
        console.error('[deepProbe] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});