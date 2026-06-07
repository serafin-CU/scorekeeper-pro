import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const me = await base44.auth.me();
        if (!me) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { user_id } = await req.json();
        if (!user_id) {
            return Response.json({ error: 'user_id is required' }, { status: 400 });
        }

        // Fetch target user (service role: regular users can't list other users)
        const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
        const target = users?.[0];
        if (!target) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        const [ledger, badges, posts, teams, triviaAttempts, predictions] = await Promise.all([
            base44.asServiceRole.entities.PointsLedger.filter({ user_id }),
            base44.asServiceRole.entities.BadgeAward.filter({ user_id }),
            base44.asServiceRole.entities.FeedPost.filter({ author_id: user_id }, '-created_date', 10),
            target.preferred_team_id
                ? base44.asServiceRole.entities.Team.filter({ id: target.preferred_team_id })
                : Promise.resolve([]),
            base44.asServiceRole.entities.TriviaAttempt.filter({ user_id }),
            base44.asServiceRole.entities.ProdePrediction.filter({ user_id })
        ]);

        const prodePoints = ledger.filter(e => e.mode === 'PRODE').reduce((s, e) => s + (e.points || 0), 0);

        // Official launch date — pre-launch attempts are excluded from the public breakdown
        const TRIVIA_START_DATE = '2026-06-05';
        const countedAttempts = triviaAttempts.filter(a => (a.daily_set_date || '') >= TRIVIA_START_DATE);
        const triviaPoints = countedAttempts.reduce((s, a) => s + (a.total_points || 0), 0);

        // Parse the theme from a TriviaQuestion source_note. Format:
        //   "Day {N} – {date} – {theme}" using en-dash (–) separators.
        // The theme is everything after the SECOND separator (may contain em-dash —).
        function parseThemeFromSourceNote(sourceNote) {
            if (!sourceNote) return null;
            const firstSep = sourceNote.indexOf('–');
            if (firstSep === -1) return null;
            const afterDay = sourceNote.slice(firstSep + 1);
            const secondSep = afterDay.indexOf('–');
            if (secondSep === -1) return null;
            return afterDay.slice(secondSep + 1).trim() || null;
        }

        // Look up each played day's theme via its TriviaDailySet -> first TriviaQuestion's source_note
        const playedDates = [...new Set(countedAttempts.map(a => a.daily_set_date).filter(Boolean))];
        const themeByDate = {};
        await Promise.all(playedDates.map(async (date) => {
            const sets = await base44.asServiceRole.entities.TriviaDailySet.filter({ date });
            const set = sets?.[0];
            const firstQId = set?.question_ids?.[0];
            if (!firstQId) return;
            const qs = await base44.asServiceRole.entities.TriviaQuestion.filter({ id: firstQId });
            themeByDate[date] = parseThemeFromSourceNote(qs?.[0]?.source_note);
        }));

        // Per-day breakdown (date, theme, points, correct count) sorted newest first
        const triviaHistory = countedAttempts
            .map(a => ({
                date: a.daily_set_date,
                theme: themeByDate[a.daily_set_date] || null,
                total_points: a.total_points || 0,
                correct_count: a.correct_count ?? 0,
                question_count: Array.isArray(a.answers) ? a.answers.length : 5
            }))
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        // Past predictions — ONLY for matches whose result is already known (no spoilers)
        let pastPredictions = [];
        if (predictions.length > 0) {
            const results = await base44.asServiceRole.entities.MatchResultFinal.list('', 1000);
            const resultByMatch = {};
            results.forEach(r => { resultByMatch[r.match_id] = r; });

            const finishedMatchIds = predictions
                .map(p => p.match_id)
                .filter(mid => resultByMatch[mid]);

            if (finishedMatchIds.length > 0) {
                const allMatches = await base44.asServiceRole.entities.Match.list('', 1000);
                const matchById = {};
                allMatches.forEach(m => { matchById[m.id] = m; });

                const teamIds = new Set();
                finishedMatchIds.forEach(mid => {
                    const m = matchById[mid];
                    if (m) { teamIds.add(m.home_team_id); teamIds.add(m.away_team_id); }
                });
                const allTeams = await base44.asServiceRole.entities.Team.list('', 1000);
                const teamById = {};
                allTeams.forEach(t => { teamById[t.id] = { name: t.name, fifa_code: t.fifa_code }; });

                pastPredictions = predictions
                    .filter(p => resultByMatch[p.match_id] && matchById[p.match_id])
                    .map(p => {
                        const m = matchById[p.match_id];
                        const r = resultByMatch[p.match_id];
                        return {
                            match_id: p.match_id,
                            kickoff_at: m.kickoff_at,
                            home_team: teamById[m.home_team_id] || { name: '?', fifa_code: '?' },
                            away_team: teamById[m.away_team_id] || { name: '?', fifa_code: '?' },
                            pred_home_goals: p.pred_home_goals,
                            pred_away_goals: p.pred_away_goals,
                            actual_home_goals: r.home_goals,
                            actual_away_goals: r.away_goals
                        };
                    })
                    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));
            }
        }

        const profile = {
            id: target.id,
            display_name: target.display_name || target.full_name || 'Anonymous',
            department: target.department || '',
            avatar_url: target.avatar_url || '',
            favorite_team: teams?.[0] ? { name: teams[0].name, fifa_code: teams[0].fifa_code } : null,
            prode_points: prodePoints,
            trivia_points: triviaPoints,
            trivia_games: countedAttempts.length,
            trivia_history: triviaHistory,
            badges: badges.map(b => ({ badge_type: b.badge_type, awarded_at: b.awarded_at })),
            posts: posts.map(p => ({
                id: p.id,
                content: p.content,
                created_date: p.created_date,
                like_count: p.like_count || 0,
                comment_count: p.comment_count || 0
            })),
            past_predictions: pastPredictions
        };

        return Response.json({ profile });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});