import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Trivia Leaderboard - resolves real user names/departments server-side.
 *
 * Regular app users cannot list other users (Base44 security rule), so the
 * frontend cannot resolve names on its own. This function uses service-role
 * to read all users and returns ready-to-render leaderboard rows.
 *
 * POST { date?: "YYYY-MM-DD" }
 * Returns { today: [...], allTime: [...] }
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const date = typeof body.date === 'string' && body.date
            ? body.date
            : new Date().toISOString().slice(0, 10);

        const [attempts, users, allRecords] = await Promise.all([
            base44.asServiceRole.entities.TriviaAttempt.filter({ daily_set_date: date }),
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.TriviaRecord.list('-date', 5000)
        ]);

        const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
        const nameOf = (u, fallbackId) =>
            u?.display_name || u?.full_name || (u?.email ? u.email.split('@')[0] : null) || fallbackId.slice(-6);

        // Aggregate TriviaRecords per user: count of sets completed + current streak
        const recordsByUser = {};
        for (const r of allRecords) {
            if (!r.user_id || !r.date) continue;
            (recordsByUser[r.user_id] = recordsByUser[r.user_id] || []).push(r.date);
        }

        // Current consecutive-day streak ending at `date` (the requested/today date)
        function computeStreak(dates) {
            if (!dates || dates.length === 0) return 0;
            const set = new Set(dates);
            let streak = 0;
            const cursor = new Date(date + 'T00:00:00Z');
            // Allow streak to count even if today not yet played: start from today, but if
            // today missing, start from yesterday.
            if (!set.has(cursor.toISOString().slice(0, 10))) {
                cursor.setUTCDate(cursor.getUTCDate() - 1);
            }
            while (set.has(cursor.toISOString().slice(0, 10))) {
                streak++;
                cursor.setUTCDate(cursor.getUTCDate() - 1);
            }
            return streak;
        }

        const statsOf = (uid) => {
            const dates = recordsByUser[uid] || [];
            return { sets_completed: dates.length, streak: computeStreak(dates) };
        };

        const today = attempts
            .map(a => {
                const u = usersMap[a.user_id];
                const s = statsOf(a.user_id);
                return {
                    user_id: a.user_id,
                    display_name: nameOf(u, a.user_id),
                    department: u?.department || '—',
                    points: a.total_points,
                    correct: a.correct_count,
                    sets_completed: s.sets_completed,
                    streak: s.streak
                };
            })
            .sort((a, b) => b.points - a.points);

        const allTime = users
            .filter(u => (u.engagement_points ?? 0) > 0)
            .map(u => {
                const s = statsOf(u.id);
                return {
                    user_id: u.id,
                    display_name: nameOf(u, u.id),
                    department: u.department || '—',
                    points: u.engagement_points ?? 0,
                    sets_completed: s.sets_completed,
                    streak: s.streak
                };
            })
            .sort((a, b) => b.points - a.points);

        return Response.json({ today, allTime });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});