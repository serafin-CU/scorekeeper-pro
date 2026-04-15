import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * WC Standings Sync - Fetches group standings from API-Football
 * Stores data in a simple JSON format for display (not entity-based for performance)
 */

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 1;
const SEASON = 2026;

function apiHeaders() {
    return {
        'x-apisports-key': Deno.env.get('API_FUTBOL'),
        'Accept': 'application/json'
    };
}

async function apiFetch(path) {
    const url = `${API_BASE}${path}`;
    console.log(`[wcStandingsSync] GET ${url}`);
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText} for ${path}`);
    }
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
        throw new Error(`API error: ${JSON.stringify(json.errors)}`);
    }
    return json.response;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        if (action !== 'get_standings') {
            return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }

        // Fetch standings from API
        const standingsData = await apiFetch(`/standings?league=${LEAGUE_ID}&season=${SEASON}`);

        if (!Array.isArray(standingsData) || standingsData.length === 0) {
            return Response.json({ error: 'No standings data received from API' }, { status: 400 });
        }

        const leagueData = standingsData[0];
        const groups = leagueData.league.standings || [];

        // Format for frontend: array of groups
        const formattedGroups = groups.map((groupTeams, index) => {
            const groupName = groupTeams[0]?.group || `Group ${String.fromCharCode(65 + index)}`;
            return {
                name: groupName,
                teams: groupTeams.map(row => ({
                    rank: row.rank,
                    team_id: row.team.id,
                    team_name: row.team.name,
                    team_logo: row.team.logo,
                    played: row.all.played,
                    wins: row.all.win,
                    draws: row.all.draw,
                    losses: row.all.lose,
                    goals_for: row.all.goals.for,
                    goals_against: row.all.goals.against,
                    goal_diff: row.goalsDiff,
                    points: row.points,
                    form: row.form
                }))
            };
        });

        return Response.json({
            ok: true,
            timestamp: new Date().toISOString(),
            groups: formattedGroups
        });

    } catch (error) {
        console.error('[wcStandingsSync] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});