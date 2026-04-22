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

// Compute player_score (1-100) from API stats object
// Uses: rating, goals, assists, appearances, age
function computePlayerScore(stats, position, age) {
    let score = 40; // baseline

    // Rating (0-10 scale from API)
    const rating = parseFloat(stats?.games?.rating) || 0;
    if (rating > 0) score += Math.round((rating / 10) * 35); // up to +35

    // Goals (weighted by position)
    const goals = stats?.goals?.total || 0;
    const posGoalWeight = { GK: 5, DEF: 4, MID: 3, FWD: 2 };
    score += Math.min(goals * (posGoalWeight[position] || 3), 15);

    // Assists
    const assists = stats?.goals?.assists || 0;
    score += Math.min(assists * 2, 8);

    // Appearances
    const apps = stats?.games?.appearences || 0;
    if (apps >= 30) score += 5;
    else if (apps >= 20) score += 3;
    else if (apps >= 10) score += 1;

    // Age penalty/bonus (peak 24-30)
    if (age >= 24 && age <= 30) score += 3;
    else if (age > 35) score -= 5;
    else if (age < 22) score -= 3;

    return Math.max(1, Math.min(100, score));
}

// Derive fantasy price from player_score (1-18 scale)
function scoreToPrice(score, position) {
    // Base range by position: GK 4-10, DEF 5-12, MID 5-14, FWD 5-18
    const ranges = {
        GK:  { min: 4, max: 10 },
        DEF: { min: 5, max: 12 },
        MID: { min: 5, max: 14 },
        FWD: { min: 5, max: 18 }
    };
    const r = ranges[position] || { min: 5, max: 14 };
    const price = Math.round(r.min + ((score - 1) / 99) * (r.max - r.min));
    return Math.max(r.min, Math.min(r.max, price));
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
        // Fetches squad + season stats for each team.
        // Stats endpoint: /players?team=X&season=SEASON  (gives rating, goals, assists, etc.)
        // Call repeatedly with offset=0, 5, 10, ... to cover all teams (5 per batch to stay under timeout).
        // Pass clear_first=true only on the first batch (offset=0).
        if (action === 'sync_players') {
            const offset = body.offset || 0;
            const batchSize = body.batch_size || 5;
            const clearFirst = body.clear_first !== false && offset === 0;

            const ourTeams = await base44.asServiceRole.entities.Team.list();
            if (ourTeams.length === 0) {
                return Response.json({ ok: false, error: 'No teams found — run sync_teams first' });
            }

            // Build API team ID lookup by name
            const apiTeams = await apiFetch(`/teams?league=${LEAGUE_ID}&season=${SEASON}`);
            const apiTeamByName = {};
            for (const item of apiTeams) {
                apiTeamByName[item.team.name.toLowerCase()] = {
                    id: item.team.id,
                    name: item.team.name
                };
            }

            // Clear existing players only on first batch
            if (clearFirst) {
                console.log('[sync_players] Clearing existing players...');
                let existingPlayers = await base44.asServiceRole.entities.Player.list('created_date', 200);
                while (existingPlayers.length > 0) {
                    for (const p of existingPlayers) {
                        await base44.asServiceRole.entities.Player.delete(p.id);
                    }
                    existingPlayers = await base44.asServiceRole.entities.Player.list('created_date', 200);
                }
            }

            const batch = ourTeams.slice(offset, offset + batchSize);
            const allCreated = [];
            const errors = [];

            for (const ourTeam of batch) {
                const apiEntry = apiTeamByName[ourTeam.name.toLowerCase()];
                if (!apiEntry) {
                    errors.push(`No API team ID found for: ${ourTeam.name}`);
                    continue;
                }
                const apiTeamId = apiEntry.id;

                try {
                    await sleep(800);

                    // Fetch squad (for position, photo, age, nationality)
                    const squads = await apiFetch(`/players/squads?team=${apiTeamId}`);
                    if (!squads || squads.length === 0) {
                        errors.push(`No squad data for: ${ourTeam.name}`);
                        continue;
                    }

                    const squadPlayers = squads[0]?.players || [];

                    // Fetch stats for all players in this team for WC season
                    // API paginates, fetch page 1 (usually enough for a squad of ~26)
                    await sleep(500);
                    let statsMap = {};
                    try {
                        const statsResp = await apiFetch(`/players?team=${apiTeamId}&season=${SEASON}&page=1`);
                        for (const entry of (statsResp || [])) {
                            if (entry.player?.id) {
                                statsMap[entry.player.id] = entry.statistics?.[0] || null;
                            }
                        }
                        // If there's a page 2, fetch it too
                        if (statsResp?.length === 20) {
                            await sleep(500);
                            const statsResp2 = await apiFetch(`/players?team=${apiTeamId}&season=${SEASON}&page=2`);
                            for (const entry of (statsResp2 || [])) {
                                if (entry.player?.id) {
                                    statsMap[entry.player.id] = entry.statistics?.[0] || null;
                                }
                            }
                        }
                    } catch (statsErr) {
                        console.log(`[sync_players] Stats fetch failed for ${ourTeam.name}: ${statsErr.message}, using squad-only data`);
                    }

                    const playersBulk = [];
                    for (const player of squadPlayers) {
                        const position = mapPosition(player.position);
                        const age = player.age || 0;
                        const stats = statsMap[player.id] || null;
                        const playerScore = computePlayerScore(stats, position, age);
                        const price = scoreToPrice(playerScore, position);

                        playersBulk.push({
                            full_name: player.name,
                            team_id: ourTeam.id,
                            nationality: ourTeam.name, // national team = team they represent
                            position,
                            age: age || null,
                            photo_url: player.photo || null,
                            api_player_id: player.id || null,
                            player_score: playerScore,
                            price,
                            is_active: true
                        });
                    }

                    if (playersBulk.length > 0) {
                        await base44.asServiceRole.entities.Player.bulkCreate(playersBulk);
                        allCreated.push(...playersBulk.map(p => ({
                            name: p.full_name,
                            team: ourTeam.name,
                            position: p.position,
                            score: p.player_score,
                            price: p.price
                        })));
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
                errors,
                players: allCreated
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