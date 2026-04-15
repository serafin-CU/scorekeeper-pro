import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * WC Events & Lineups Sync - Fetches match events/lineups and creates FantasyMatchPlayerStats records
 * Processes finished matches to extract player performance data for fantasy scoring
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
    console.log(`[wcEventsLineupSync] GET ${url}`);
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

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { action, match_id } = body;

        // ── SYNC EVENTS FOR A SINGLE MATCH ──────────────────────────────────
        if (action === 'sync_match_events') {
            if (!match_id) {
                return Response.json({ error: 'match_id required' }, { status: 400 });
            }

            // Get our match
            const ourMatch = await base44.entities.Match.filter({ id: match_id });
            if (ourMatch.length === 0) {
                return Response.json({ error: `Match ${match_id} not found` }, { status: 404 });
            }

            const match = ourMatch[0];
            const homeTeam = await base44.entities.Team.filter({ id: match.home_team_id });
            const awayTeam = await base44.entities.Team.filter({ id: match.away_team_id });

            if (homeTeam.length === 0 || awayTeam.length === 0) {
                return Response.json({ error: 'Match teams not found' }, { status: 400 });
            }

            // Find API fixture by team names and kickoff time
            const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
            const apiFixture = fixtures.find(f => {
                const homeMatch = f.teams.home.name.toLowerCase() === homeTeam[0].name.toLowerCase();
                const awayMatch = f.teams.away.name.toLowerCase() === awayTeam[0].name.toLowerCase();
                const timeDiff = Math.abs(new Date(f.fixture.date) - new Date(match.kickoff_at)) / 60000;
                return homeMatch && awayMatch && timeDiff < 30;
            });

            if (!apiFixture) {
                return Response.json({ error: 'API fixture not found' }, { status: 404 });
            }

            // Fetch detailed fixture data with events and lineups
            const fixtureDetail = await apiFetch(`/fixtures?id=${apiFixture.fixture.id}`);
            if (fixtureDetail.length === 0) {
                return Response.json({ error: 'Fixture detail not found' }, { status: 404 });
            }

            const fixture = fixtureDetail[0];
            const events = fixture.events || [];
            const players = fixture.players || [];

            // Extract player stats from lineups and events
            const statsMap = {}; // player_name -> stats

            // Initialize from lineups (starters and bench)
            for (const teamSide of ['home', 'away']) {
                const teamId = teamSide === 'home' ? match.home_team_id : match.away_team_id;
                const lineup = fixture.lineups?.find(l => l.team.id === fixture.teams[teamSide].id);
                if (!lineup) continue;

                // Starters
                for (const player of (lineup.startXI || [])) {
                    statsMap[player.player.name] = {
                        team_id: teamId,
                        started: true,
                        substituted_in: false,
                        substituted_out: false,
                        minute_in: null,
                        minute_out: null,
                        minutes_played: 0,
                        goals: 0,
                        yellow_cards: 0,
                        red_cards: 0
                    };
                }

                // Bench
                for (const player of (lineup.substitutes || [])) {
                    statsMap[player.player.name] = {
                        team_id: teamId,
                        started: false,
                        substituted_in: false,
                        substituted_out: false,
                        minute_in: null,
                        minute_out: null,
                        minutes_played: 0,
                        goals: 0,
                        yellow_cards: 0,
                        red_cards: 0
                    };
                }
            }

            // Process events (goals, cards, substitutions)
            for (const event of events) {
                const playerName = event.player.name;
                if (!statsMap[playerName]) continue;

                if (event.type === 'Goal') {
                    statsMap[playerName].goals++;
                } else if (event.type === 'Card') {
                    if (event.detail === 'Yellow Card') {
                        statsMap[playerName].yellow_cards++;
                    } else if (event.detail === 'Red Card') {
                        statsMap[playerName].red_cards++;
                    }
                } else if (event.type === 'Subst') {
                    if (event.detail === 'Substitution Out') {
                        statsMap[playerName].substituted_out = true;
                        statsMap[playerName].minute_out = event.time.elapsed;
                    } else if (event.detail === 'Substitution In') {
                        statsMap[playerName].substituted_in = true;
                        statsMap[playerName].minute_in = event.time.elapsed;
                    }
                }
            }

            // Calculate minutes played
            const matchDuration = 90; // default
            for (const name in statsMap) {
                const stats = statsMap[name];
                if (stats.started) {
                    if (stats.minute_out) {
                        stats.minutes_played = stats.minute_out;
                    } else {
                        stats.minutes_played = matchDuration;
                    }
                } else if (stats.minute_in) {
                    if (stats.minute_out) {
                        stats.minutes_played = stats.minute_out - stats.minute_in;
                    } else {
                        stats.minutes_played = matchDuration - stats.minute_in;
                    }
                }
            }

            // Match player names to our Player records and create FantasyMatchPlayerStats
            const created = [];
            const skipped = [];

            for (const [playerName, stats] of Object.entries(statsMap)) {
                const ourPlayers = await base44.entities.Player.filter({
                    full_name: playerName,
                    team_id: stats.team_id
                });

                if (ourPlayers.length === 0) {
                    skipped.push(playerName);
                    continue;
                }

                const player = ourPlayers[0];

                // Check if already exists
                const existing = await base44.entities.FantasyMatchPlayerStats.filter({
                    match_id,
                    player_id: player.id
                });

                if (existing.length === 0) {
                    await base44.entities.FantasyMatchPlayerStats.create({
                        match_id,
                        player_id: player.id,
                        team_id: stats.team_id,
                        started: stats.started,
                        substituted_in: stats.substituted_in,
                        substituted_out: stats.substituted_out,
                        minute_in: stats.minute_in,
                        minute_out: stats.minute_out,
                        minutes_played: stats.minutes_played,
                        goals: stats.goals,
                        yellow_cards: stats.yellow_cards,
                        red_cards: stats.red_cards,
                        source: 'API_FOOTBALL'
                    });
                    created.push({ player_name: playerName, minutes: stats.minutes_played });
                }
            }

            return Response.json({
                ok: true,
                action: 'sync_match_events',
                match_id,
                stats_created: created.length,
                stats_skipped: skipped.length,
                created,
                skipped
            });
        }

        // ── SYNC ALL FINISHED MATCHES ────────────────────────────────────────
        if (action === 'sync_all_events') {
            const allMatches = await base44.entities.Match.filter({ status: 'FINAL' });

            let totalCreated = 0;
            let totalSkipped = 0;
            const results = [];

            for (const match of allMatches) {
                await sleep(300); // rate limit

                try {
                    const res = await base44.functions.invoke('wcEventsLineupSync', {
                        action: 'sync_match_events',
                        match_id: match.id
                    });

                    if (res.data.ok) {
                        totalCreated += res.data.stats_created;
                        totalSkipped += res.data.stats_skipped;
                        results.push({
                            match_id: match.id,
                            stats_created: res.data.stats_created,
                            stats_skipped: res.data.stats_skipped
                        });
                    }
                } catch (err) {
                    console.error(`Failed to sync events for match ${match.id}:`, err.message);
                }
            }

            return Response.json({
                ok: true,
                action: 'sync_all_events',
                matches_processed: allMatches.length,
                total_stats_created: totalCreated,
                total_stats_skipped: totalSkipped,
                results
            });
        }

        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    } catch (error) {
        console.error('[wcEventsLineupSync] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});