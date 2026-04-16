import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * WC Data Sync - API-Football Integration
 * 
 * Uses league=1, season=2026 (FIFA World Cup 2026)
 * API key: API_FUTBOL env var
 * 
 * Actions:
 *   - sync_teams       : Fetch all 48 teams + create Team records
 *   - sync_fixtures    : Fetch all 104 matches + create Match records
 *   - sync_players     : Fetch player squads per team + create Player records
 *   - sync_results     : Fetch finished match results + auto-finalize
 *   - status           : Check API quota / subscription status
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
    console.log(`[wcDataSync] GET ${url}`);
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

// Map API-Football phase/round strings to our phase enum
function mapRoundToPhase(round) {
    if (!round) return 'GROUP_MD1';
    const r = round.toLowerCase();
    if (r.includes('group stage - 1')) return 'GROUP_MD1';
    if (r.includes('group stage - 2')) return 'GROUP_MD2';
    if (r.includes('group stage - 3')) return 'GROUP_MD3';
    if (r.includes('round of 32') || r.includes('1/16 finals')) return 'ROUND_OF_32';
    if (r.includes('round of 16') || r.includes('1/8 finals')) return 'ROUND_OF_16';
    if (r.includes('quarter')) return 'QUARTERFINALS';
    if (r.includes('semi')) return 'SEMIFINALS';
    if (r.includes('3rd') || r.includes('third')) return 'SEMIFINALS'; // third place
    if (r.includes('final')) return 'FINAL';
    return 'GROUP_MD1';
}

// Map API-Football fixture status to our status enum
function mapFixtureStatus(statusShort) {
    if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort)) return 'FINAL';
    if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(statusShort)) return 'LIVE';
    return 'SCHEDULED';
}

// Map API-Football position to our enum
function mapPosition(pos) {
    if (!pos) return 'MID';
    const p = pos.toUpperCase();
    if (p === 'GOALKEEPER' || p === 'G') return 'GK';
    if (p === 'DEFENDER' || p === 'D') return 'DEF';
    if (p === 'MIDFIELDER' || p === 'M') return 'MID';
    if (p === 'ATTACKER' || p === 'F') return 'FWD';
    return 'MID';
}

// Default price by position
function defaultPrice(position) {
    const prices = { GK: 6, DEF: 7, MID: 8, FWD: 9 };
    return prices[position] || 8;
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

        // ── STATUS ──────────────────────────────────────────────────────────
        if (action === 'status') {
            const res = await fetch(`${API_BASE}/status`, { headers: apiHeaders() });
            const data = await res.json();
            return Response.json({ ok: true, data: data.response });
        }

        // ── SYNC TEAMS ───────────────────────────────────────────────────────
        if (action === 'sync_teams') {
            const teams = await apiFetch(`/teams?league=${LEAGUE_ID}&season=${SEASON}`);

            // Clear existing teams
            const existingTeams = await base44.asServiceRole.entities.Team.list();
            for (const t of existingTeams) {
                await base44.asServiceRole.entities.Team.delete(t.id);
            }

            const created = [];
            for (const item of teams) {
                const t = item.team;
                const team = await base44.asServiceRole.entities.Team.create({
                    name: t.name,
                    fifa_code: (t.code || t.name.substring(0, 3)).toUpperCase().substring(0, 3),
                    is_qualified: true,
                    logo_url: item.team?.logo || null,
                });
                created.push({ id: team.id, name: t.name, api_id: t.id, fifa_code: t.code, logo_url: item.team?.logo });
            }

            return Response.json({
                ok: true,
                action: 'sync_teams',
                teams_created: created.length,
                teams: created
            });
        }

        // ── SYNC FIXTURES ────────────────────────────────────────────────────
        if (action === 'sync_fixtures') {
            const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

            // Build team lookup: api_id -> our team record
            // We need to match by name since we don't store api_id
            const ourTeams = await base44.asServiceRole.entities.Team.list();
            const teamByName = {};
            for (const t of ourTeams) {
                teamByName[t.name.toLowerCase()] = t;
            }

            // Also pass api team id map from the request if provided
            const apiTeamMap = body.api_team_map || {}; // { "api_id": "our_team_id" }

            // Clear existing matches
            const existingMatches = await base44.asServiceRole.entities.Match.list();
            for (const m of existingMatches) {
                await base44.asServiceRole.entities.Match.delete(m.id);
            }

            const created = [];
            const skipped = [];

            for (const item of fixtures) {
                const f = item.fixture;
                const homeApiId = String(item.teams.home.id);
                const awayApiId = String(item.teams.away.id);

                // Try to find teams: by api_team_map first, then by name
                let homeTeam = apiTeamMap[homeApiId]
                    ? ourTeams.find(t => t.id === apiTeamMap[homeApiId])
                    : teamByName[item.teams.home.name.toLowerCase()];
                let awayTeam = apiTeamMap[awayApiId]
                    ? ourTeams.find(t => t.id === apiTeamMap[awayApiId])
                    : teamByName[item.teams.away.name.toLowerCase()];

                if (!homeTeam || !awayTeam) {
                    skipped.push({
                        fixture_id: f.id,
                        home: item.teams.home.name,
                        away: item.teams.away.name,
                        reason: `Team not found: ${!homeTeam ? item.teams.home.name : ''} ${!awayTeam ? item.teams.away.name : ''}`
                    });
                    continue;
                }

                const phase = mapRoundToPhase(item.league.round);
                const status = mapFixtureStatus(f.status.short);

                const match = await base44.asServiceRole.entities.Match.create({
                    phase,
                    kickoff_at: f.date,
                    home_team_id: homeTeam.id,
                    away_team_id: awayTeam.id,
                    status,
                    venue: item.fixture.venue?.name || null
                });

                // If match is already FINAL, also create MatchResultFinal
                if (status === 'FINAL' && item.goals.home !== null && item.goals.away !== null) {
                    const existingResult = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: match.id });
                    if (existingResult.length === 0) {
                        await base44.asServiceRole.entities.MatchResultFinal.create({
                            match_id: match.id,
                            home_goals: item.goals.home,
                            away_goals: item.goals.away,
                            finalized_at: new Date().toISOString()
                        });
                    }
                }

                created.push({
                    id: match.id,
                    fixture_api_id: f.id,
                    home: item.teams.home.name,
                    away: item.teams.away.name,
                    phase,
                    status,
                    kickoff: f.date
                });
            }

            return Response.json({
                ok: true,
                action: 'sync_fixtures',
                fixtures_created: created.length,
                fixtures_skipped: skipped.length,
                skipped,
                fixtures: created
            });
        }

        // Helper: sleep ms
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        // ── SYNC PLAYERS ─────────────────────────────────────────────────────
        // Processes teams in batches of 10 to avoid timeouts.
        // Call repeatedly with offset=0, 10, 20, 30, 40 to cover all 48 teams.
        // Pass clear_first=true only on the first batch (offset=0).
        if (action === 'sync_players') {
            const offset = body.offset || 0;
            const batchSize = body.batch_size || 10;
            const clearFirst = body.clear_first !== false && offset === 0;

            const ourTeams = await base44.asServiceRole.entities.Team.list();
            if (ourTeams.length === 0) {
                return Response.json({ ok: false, error: 'No teams found — run sync_teams first' });
            }

            // Get API team IDs
            const apiTeams = await apiFetch(`/teams?league=${LEAGUE_ID}&season=${SEASON}`);
            const apiTeamByName = {};
            for (const item of apiTeams) {
                apiTeamByName[item.team.name.toLowerCase()] = item.team.id;
            }

            // Clear existing players only on first batch
            if (clearFirst) {
                const existingPlayers = await base44.asServiceRole.entities.Player.list();
                for (const p of existingPlayers) {
                    await base44.asServiceRole.entities.Player.delete(p.id);
                }
            }

            const batch = ourTeams.slice(offset, offset + batchSize);
            const allCreated = [];
            const errors = [];

            for (const ourTeam of batch) {
                const apiTeamId = apiTeamByName[ourTeam.name.toLowerCase()];
                if (!apiTeamId) {
                    errors.push(`No API team ID found for: ${ourTeam.name}`);
                    continue;
                }

                try {
                    await sleep(500);
                    const squads = await apiFetch(`/players/squads?team=${apiTeamId}`);
                    if (!squads || squads.length === 0) continue;

                    const squad = squads[0];
                    const playersBulk = [];
                    for (const player of (squad.players || [])) {
                        const position = mapPosition(player.position);
                        playersBulk.push({
                            full_name: player.name,
                            team_id: ourTeam.id,
                            position,
                            price: defaultPrice(position),
                            is_active: true
                        });
                    }
                    if (playersBulk.length > 0) {
                        const created = await base44.asServiceRole.entities.Player.bulkCreate(playersBulk);
                        allCreated.push(...playersBulk.map(p => ({ name: p.full_name, team: ourTeam.name, position: p.position })));
                    }
                } catch (err) {
                    errors.push(`Failed: ${ourTeam.name}: ${err.message}`);
                }
            }

            return Response.json({
                ok: true,
                action: 'sync_players',
                offset,
                batch_size: batchSize,
                teams_in_batch: batch.length,
                players_created: allCreated.length,
                total_teams: ourTeams.length,
                has_more: offset + batchSize < ourTeams.length,
                next_offset: offset + batchSize,
                errors
            });
        }

        // ── SYNC RESULTS ─────────────────────────────────────────────────────
        if (action === 'sync_results') {
            // Fetch all fixtures
            const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

            // Build our match lookup: we'll match by kickoff time + team names
            const ourMatches = await base44.asServiceRole.entities.Match.list();
            const ourTeams = await base44.asServiceRole.entities.Team.list();
            const teamById = {};
            for (const t of ourTeams) teamById[t.id] = t;

            let updated = 0;
            let finalized = 0;
            let skipped = 0;
            const results = [];

            for (const item of fixtures) {
                const f = item.fixture;
                const status = mapFixtureStatus(f.status.short);

                // Only process finished matches
                if (status !== 'FINAL') {
                    skipped++;
                    continue;
                }

                const kickoffIso = f.date;
                const kickoffDate = new Date(kickoffIso);

                // Find our match by kickoff proximity (within 30 min) and home/away team names
                const homeApiName = item.teams.home.name.toLowerCase();
                const awayApiName = item.teams.away.name.toLowerCase();

                const ourMatch = ourMatches.find(m => {
                    const mHome = teamById[m.home_team_id];
                    const mAway = teamById[m.away_team_id];
                    if (!mHome || !mAway) return false;

                    const mHomeName = mHome.name.toLowerCase();
                    const mAwayName = mAway.name.toLowerCase();

                    const nameMatch = mHomeName === homeApiName && mAwayName === awayApiName;
                    const timeDiff = Math.abs(new Date(m.kickoff_at) - kickoffDate) / 60000; // minutes
                    return nameMatch && timeDiff < 30;
                });

                if (!ourMatch) {
                    skipped++;
                    continue;
                }

                // Update match status if needed
                if (ourMatch.status !== 'FINAL') {
                    await base44.asServiceRole.entities.Match.update(ourMatch.id, { status: 'FINAL' });
                    updated++;
                }

                // Create/update MatchResultFinal
                if (item.goals.home !== null && item.goals.away !== null) {
                    const existingResult = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: ourMatch.id });
                    if (existingResult.length === 0) {
                        await base44.asServiceRole.entities.MatchResultFinal.create({
                            match_id: ourMatch.id,
                            home_goals: item.goals.home,
                            away_goals: item.goals.away,
                            finalized_at: new Date().toISOString()
                        });
                        finalized++;
                        results.push({
                            match_id: ourMatch.id,
                            home: item.teams.home.name,
                            away: item.teams.away.name,
                            score: `${item.goals.home}-${item.goals.away}`
                        });
                    }
                }
            }

            return Response.json({
                ok: true,
                action: 'sync_results',
                matches_updated: updated,
                results_finalized: finalized,
                matches_skipped: skipped,
                results
            });
        }

        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    } catch (error) {
        console.error('[wcDataSync] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});