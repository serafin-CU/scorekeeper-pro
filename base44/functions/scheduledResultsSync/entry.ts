import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Scheduled wrapper that fetches finished fixture results and updates
 * MatchResultFinal, then scores Prode predictions. Runs on a schedule
 * (no logged-in user), so it uses service-role access exclusively.
 *
 * This mirrors the logic of wcFixtureResultsSync's 'sync_fixture_results'
 * action but without the admin-auth requirement, so it can run unattended.
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
    console.log(`[scheduledResultsSync] GET ${url}`);
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
        const svc = base44.asServiceRole;

        const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

        const ourTeams = await svc.entities.Team.list();
        const teamById = {};
        for (const t of ourTeams) teamById[t.id] = t;

        const ourMatches = await svc.entities.Match.list();

        let updated = 0;
        let finalized = 0;
        let prodeScored = 0;
        const errors = [];
        const results = [];

        for (const fixture of fixtures) {
            const f = fixture.fixture;
            const status = f.status.short;

            if (!['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(status)) continue;
            if (fixture.goals.home === null || fixture.goals.away === null) continue;

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

            if (!ourMatch) continue;

            if (ourMatch.status !== 'FINAL') {
                await svc.entities.Match.update(ourMatch.id, { status: 'FINAL' });
                updated++;
            }

            const existing = await svc.entities.MatchResultFinal.filter({ match_id: ourMatch.id });
            if (existing.length > 0 && existing[0].manually_overridden) continue;

            if (existing.length === 0) {
                let mvpPlayerId = null;
                if (fixture.players && fixture.players.length > 0) {
                    const momPlayer = fixture.players.find(p => p.statistics?.some(s => s.games?.rating >= 8));
                    if (momPlayer) {
                        const ourPlayers = await svc.entities.Player.filter({ full_name: momPlayer.player.name });
                        if (ourPlayers.length > 0) mvpPlayerId = ourPlayers[0].id;
                    }
                }

                const matchResult = await svc.entities.MatchResultFinal.create({
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

                try {
                    prodeScored += await scoreProdeForMatch(svc, ourMatch.id, matchResult);
                } catch (scoreErr) {
                    errors.push(`Prode scoring failed for ${ourMatch.id}: ${scoreErr.message}`);
                }
            }
        }

        return Response.json({
            ok: true,
            matches_updated: updated,
            results_finalized: finalized,
            prode_predictions_scored: prodeScored,
            errors: errors.length > 0 ? errors : undefined,
            results
        });
    } catch (error) {
        console.error('[scheduledResultsSync] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function scoreProdeForMatch(svc, matchId, finalResult) {
    const predictions = await svc.entities.ProdePrediction.filter({ match_id: matchId });
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
        const existing = await svc.entities.PointsLedger.filter({
            user_id: pred.user_id,
            source_id: sourceId
        });
        if (existing.length > 0) continue;

        await svc.entities.PointsLedger.create({
            user_id: pred.user_id,
            mode: 'PRODE',
            source_type: 'MATCH',
            source_id: sourceId,
            points,
            breakdown_json: JSON.stringify(breakdown)
        });
        scoredCount++;
        await new Promise(r => setTimeout(r, 300));
    }

    return scoredCount;
}