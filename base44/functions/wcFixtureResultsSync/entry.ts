import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * WC Fixture Results Sync - Fetches finished fixture results and updates MatchResultFinal
 * Handles MVP player assignment if available from API
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
    console.log(`[wcFixtureResultsSync] GET ${url}`);
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) {
        throw new Error(`API request failed: ${res.status} ${res.statusText}`);
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

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        // ── SYNC FIXTURE RESULTS ────────────────────────────────────────────
        if (action === 'sync_fixture_results') {
            // Fetch all fixtures
            const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

            // Get all our teams and matches
            const ourTeams = await base44.entities.Team.list();
            const teamById = {};
            for (const t of ourTeams) teamById[t.id] = t;

            const ourMatches = await base44.entities.Match.list();

            let updated = 0;
            let finalized = 0;
            let errors = [];
            const results = [];

            for (const fixture of fixtures) {
                const f = fixture.fixture;
                const status = f.status.short;

                // Only process finished matches
                if (!['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) {
                    continue;
                }

                if (fixture.goals.home === null || fixture.goals.away === null) {
                    continue;
                }

                // Find our match by team names and kickoff
                const kickoffDate = new Date(f.date);
                const homeApiName = fixture.teams.home.name.toLowerCase();
                const awayApiName = fixture.teams.away.name.toLowerCase();

                const ourMatch = ourMatches.find(m => {
                    const mHome = teamById[m.home_team_id];
                    const mAway = teamById[m.away_team_id];
                    if (!mHome || !mAway) return false;

                    const nameMatch = 
                        mHome.name.toLowerCase() === homeApiName && 
                        mAway.name.toLowerCase() === awayApiName;
                    const timeDiff = Math.abs(new Date(m.kickoff_at) - kickoffDate) / 60000;
                    return nameMatch && timeDiff < 30;
                });

                if (!ourMatch) {
                    errors.push(`No match found for ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
                    continue;
                }

                // Update match status if needed
                if (ourMatch.status !== 'FINAL') {
                    await base44.entities.Match.update(ourMatch.id, { status: 'FINAL' });
                    updated++;
                }

                // Create/update MatchResultFinal
                const existing = await base44.entities.MatchResultFinal.filter({ match_id: ourMatch.id });
                if (existing.length === 0) {
                    // Try to find MVP player if available
                    let mvpPlayerId = null;
                    if (fixture.players && fixture.players.length > 0) {
                        // Find player with "MoM" (Man of the Match) award
                        const momPlayer = fixture.players.find(p => p.statistics?.some(s => s.games?.rating >= 8));
                        if (momPlayer) {
                            const ourPlayers = await base44.entities.Player.filter({
                                full_name: momPlayer.player.name
                            });
                            if (ourPlayers.length > 0) {
                                mvpPlayerId = ourPlayers[0].id;
                            }
                        }
                    }

                    await base44.entities.MatchResultFinal.create({
                        match_id: ourMatch.id,
                        home_goals: fixture.goals.home,
                        away_goals: fixture.goals.away,
                        mvp_player_id: mvpPlayerId,
                        finalized_at: new Date().toISOString()
                    });
                    finalized++;
                    results.push({
                        match_id: ourMatch.id,
                        home: fixture.teams.home.name,
                        away: fixture.teams.away.name,
                        score: `${fixture.goals.home}-${fixture.goals.away}`
                    });
                }
            }

            return Response.json({
                ok: true,
                action: 'sync_fixture_results',
                matches_updated: updated,
                results_finalized: finalized,
                errors: errors.length > 0 ? errors : undefined,
                results
            });
        }

        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    } catch (error) {
        console.error('[wcFixtureResultsSync] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});