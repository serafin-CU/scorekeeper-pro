import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * syncKnockoutFixtures — Idempotent importer for knockout-stage fixtures.
 *
 * Unlike wcDataSync.sync_fixtures (which wipes & recreates ALL matches), this
 * function ONLY ADDS new knockout matches that the API has published and that
 * don't already exist in our DB. It never deletes or overwrites existing
 * matches, so manually-corrected kickoff times and prediction references stay
 * intact.
 *
 * Matching rule: a match is considered "already in DB" if a Match exists with
 * the same home & away team (by name) in the same phase. Group stage and
 * already-present knockout fixtures are skipped.
 *
 * Designed to run unattended on a schedule. Auth: allows admin manual calls,
 * and unattended (no-user) automation runs.
 */

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 1;
const SEASON = 2026;

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
    console.log(`[syncKnockoutFixtures] GET ${url}`);
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
        throw new Error(`API error: ${JSON.stringify(json.errors)}`);
    }
    return json.response;
}

// Map API round string to our phase enum (knockout only)
function mapRoundToPhase(round) {
    const r = (round || '').toLowerCase();
    if (r.includes('round of 32') || r.includes('1/16')) return 'ROUND_OF_32';
    if (r.includes('round of 16') || r.includes('1/8')) return 'ROUND_OF_16';
    if (r.includes('quarter')) return 'QUARTERFINALS';
    if (r.includes('3rd') || r.includes('third')) return 'THIRD_PLACE';
    if (r.includes('semi')) return 'SEMIFINALS';
    if (r.includes('final')) return 'FINAL';
    return null; // not a knockout round we import here
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Allow admin manual runs; allow unattended automation runs (no user).
        let user = null;
        try { user = await base44.auth.me(); } catch (_) { /* unattended */ }
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

        // Existing teams (name -> record) and existing matches (for dedupe)
        const ourTeams = await base44.asServiceRole.entities.Team.list();
        const teamByName = {};
        for (const t of ourTeams) teamByName[normalizeTeamName(t.name)] = t;
        const teamById = {};
        for (const t of ourTeams) teamById[t.id] = t;

        const ourMatches = await base44.asServiceRole.entities.Match.list();
        // Dedupe key: phase | homeName | awayName
        const existingKeys = new Set(
            ourMatches.map(m => {
                const h = teamById[m.home_team_id];
                const a = teamById[m.away_team_id];
                if (!h || !a) return null;
                return `${m.phase}|${normalizeTeamName(h.name)}|${normalizeTeamName(a.name)}`;
            }).filter(Boolean)
        );

        const created = [];
        const skippedExisting = [];
        const skippedUnknownTeam = [];

        for (const item of fixtures) {
            const phase = mapRoundToPhase(item.league.round);
            if (!phase || phase === 'ROUND_OF_32') continue; // R32 already loaded manually; only newer rounds

            const homeName = normalizeTeamName(item.teams.home.name);
            const awayName = normalizeTeamName(item.teams.away.name);

            const key = `${phase}|${homeName}|${awayName}`;
            if (existingKeys.has(key)) { skippedExisting.push(key); continue; }

            const homeTeam = teamByName[homeName];
            const awayTeam = teamByName[awayName];
            if (!homeTeam || !awayTeam) {
                skippedUnknownTeam.push(`${item.teams.home.name} vs ${item.teams.away.name} (${phase})`);
                continue;
            }

            const statusShort = item.fixture.status.short;
            const status = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort)
                ? 'FINAL'
                : ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(statusShort)
                    ? 'LIVE' : 'SCHEDULED';

            const match = await base44.asServiceRole.entities.Match.create({
                phase,
                kickoff_at: item.fixture.date,
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                status,
                venue: item.fixture.venue?.name || null
            });
            existingKeys.add(key);
            created.push({
                id: match.id,
                phase,
                home: item.teams.home.name,
                away: item.teams.away.name,
                kickoff: item.fixture.date,
                status
            });
        }

        return Response.json({
            ok: true,
            created_count: created.length,
            created,
            skipped_existing: skippedExisting.length,
            skipped_unknown_team: skippedUnknownTeam.length > 0 ? skippedUnknownTeam : undefined
        });

    } catch (error) {
        console.error('[syncKnockoutFixtures] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});