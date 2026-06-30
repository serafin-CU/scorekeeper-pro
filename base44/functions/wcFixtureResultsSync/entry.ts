import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * WC Fixture Results Sync - Fetches finished fixture results and updates MatchResultFinal
 * Handles MVP player assignment if available from API
 */

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 1;
const SEASON = 2026;

// Canonicalizes team names that differ between our DB and the api-sports feed.
const TEAM_NAME_ALIASES = {
"czechia": "czech republic",
"czech republic": "czech republic",
};
function normalizeTeamName(name) {
const lower = (name || "").toLowerCase().trim();
return TEAM_NAME_ALIASES[lower] || lower;
}

function apiHeaders() {
    return {
        'x-apisports-key': Deno.env.get('API_FUTBOL'),
        'Accept': 'application/json'
    };
}

async function apiFetch(path) {
    const url = `${API_BASE}${path}`;
    // Up to 3 attempts with backoff to ride out api-sports per-minute rate limits
    // (other syncs sharing the same key can saturate the minute window).
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[wcFixtureResultsSync] GET ${url} (attempt ${attempt})`);
        const res = await fetch(url, { headers: apiHeaders() });
        const json = await res.json().catch(() => ({}));
        const rateLimited = res.status === 429 ||
            (json.errors && JSON.stringify(json.errors).toLowerCase().includes('rate'));

        if (rateLimited && attempt < maxAttempts) {
            const waitMs = attempt * 20000; // 20s, then 40s
            console.log(`[wcFixtureResultsSync] Rate limited, waiting ${waitMs}ms before retry`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
        }
        if (!res.ok) {
            throw new Error(`API request failed: ${res.status} ${res.statusText}`);
        }
        if (json.errors && Object.keys(json.errors).length > 0) {
            throw new Error(`API error: ${JSON.stringify(json.errors)}`);
        }
        return json.response;
    }
    throw new Error('API request failed after retries (rate limited)');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Allow admin manual runs; allow unattended automation runs (no user).
        let user = null;
        try { user = await base44.auth.me(); } catch (_) { /* unattended automation */ }
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Default to sync_fixture_results when invoked with no body (scheduled automation).
        let body = {};
        try { body = await req.json(); } catch (_) { /* no body — scheduled run */ }
        const action = body.action || 'sync_fixture_results';

        // ── DIAGNOSE (temporary) — inspect raw API fixtures for a team substring ──
        if (action === 'diagnose') {
            const needle = (body.team || 'german').toLowerCase();
            const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
            const hits = fixtures
                .filter(f => f.teams.home.name.toLowerCase().includes(needle) || f.teams.away.name.toLowerCase().includes(needle))
                .map(f => ({
                    home: f.teams.home.name,
                    away: f.teams.away.name,
                    date: f.fixture.date,
                    status: f.fixture.status.short,
                    goals: f.goals
                }));
            return Response.json({ ok: true, total: fixtures.length, hits });
        }

        // ── SYNC FIXTURE RESULTS ────────────────────────────────────────────
        if (action === 'sync_fixture_results') {
            // Fetch all fixtures
            const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

            // Get all our teams and matches
            const ourTeams = await base44.asServiceRole.entities.Team.list();
            const teamById = {};
            for (const t of ourTeams) teamById[t.id] = t;

            const ourMatches = await base44.asServiceRole.entities.Match.list();

            // Index our (non-final) matches by the normalized "home|away" team-name pair.
            // Matching purely on the team pair (not kickoff time) makes the sync resilient to
            // reschedules / timezone drift — the bug that left matches like GER-PAR unsynced.
            const matchByPair = {};
            for (const m of ourMatches) {
                const mHome = teamById[m.home_team_id];
                const mAway = teamById[m.away_team_id];
                if (!mHome || !mAway) continue;
                const key = `${normalizeTeamName(mHome.name)}|${normalizeTeamName(mAway.name)}`;
                // Prefer a not-yet-final match if duplicates exist
                if (!matchByPair[key] || matchByPair[key].status === 'FINAL') {
                    matchByPair[key] = m;
                }
            }

            // Load all finalized results once and index by match_id — avoids a per-match
            // .filter() call (the rate-limit saturation that auto-paused this automation).
            const allResults = await base44.asServiceRole.entities.MatchResultFinal.list();
            const resultByMatchId = {};
            for (const r of allResults) resultByMatchId[r.match_id] = r;

            let updated = 0;
            let finalized = 0;
            let prodeScored = 0;
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

                // Match by team pair only (kickoff time ignored — see matchByPair above).
                const homeApiName = normalizeTeamName(fixture.teams.home.name);
                const awayApiName = normalizeTeamName(fixture.teams.away.name);
                const ourMatch = matchByPair[`${homeApiName}|${awayApiName}`];

                if (!ourMatch) {
                    errors.push(`No match found for ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
                    continue;
                }

                // Update match status if needed
                if (ourMatch.status !== 'FINAL') {
                    await base44.asServiceRole.entities.Match.update(ourMatch.id, { status: 'FINAL' });
                    updated++;
                }

                // Create/update MatchResultFinal — skip if an admin has manually overridden this result
                const existing = resultByMatchId[ourMatch.id];
                if (existing && existing.manually_overridden) {
                    console.log(`[wcFixtureResultsSync] Skipping ${fixture.teams.home.name} vs ${fixture.teams.away.name} — manually overridden by admin`);
                    continue;
                }
                if (!existing) {
                    // Try to find MVP player if available
                    let mvpPlayerId = null;
                    if (fixture.players && fixture.players.length > 0) {
                        // Find player with "MoM" (Man of the Match) award
                        const momPlayer = fixture.players.find(p => p.statistics?.some(s => s.games?.rating >= 8));
                        if (momPlayer) {
                            const ourPlayers = await base44.asServiceRole.entities.Player.filter({
                                full_name: momPlayer.player.name
                            });
                            if (ourPlayers.length > 0) {
                                mvpPlayerId = ourPlayers[0].id;
                            }
                        }
                    }

                    const matchResult = await base44.asServiceRole.entities.MatchResultFinal.create({
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

                    // Prode scoring is handled exclusively by the backfillProdeScoring safety-net automation (runs every ~10 min) to avoid inline timeouts.
                }
            }

            return Response.json({
                ok: true,
                action: 'sync_fixture_results',
                matches_updated: updated,
                results_finalized: finalized,
                prode_predictions_scored: prodeScored,
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

/**
 * Score all Prode predictions for a finalized match. Idempotent per user+match.
 * Mirrors the scoring rules in jobRunner: exact score = 5, correct outcome = 3.
 */
async function scoreProdeForMatch(base44, matchId, finalResult) {
    const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id: matchId });
    let scoredCount = 0;

    for (const pred of predictions) {
        let points = 0;
        const breakdown = { exact_score: 0, correct_outcome: 0, total: 0 };

        if (pred.pred_home_goals === finalResult.home_goals &&
            pred.pred_away_goals === finalResult.away_goals) {
            breakdown.exact_score = 5;
            points += 5;
        } else {
            const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'home' :
                pred.pred_home_goals < pred.pred_away_goals ? 'away' : 'draw';
            const actualWinner = finalResult.home_goals > finalResult.away_goals ? 'home' :
                finalResult.home_goals < finalResult.away_goals ? 'away' : 'draw';
            if (predWinner === actualWinner) {
                breakdown.correct_outcome = 3;
                points += 3;
            }
        }
        breakdown.total = points;

        const sourceId = 'PRODE:MATCH:' + matchId + ':' + pred.user_id;
        const existing = await base44.asServiceRole.entities.PointsLedger.filter({
            user_id: pred.user_id,
            source_id: sourceId
        });
        if (existing.length > 0) continue;

        await base44.asServiceRole.entities.PointsLedger.create({
            user_id: pred.user_id,
            mode: 'PRODE',
            source_type: 'MATCH',
            source_id: sourceId,
            points,
            breakdown_json: JSON.stringify(breakdown)
        });
        scoredCount++;
    }

    return scoredCount;
}