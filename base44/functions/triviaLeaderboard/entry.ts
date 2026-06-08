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

        const [attempts, users] = await Promise.all([
            base44.asServiceRole.entities.TriviaAttempt.filter({ daily_set_date: date }),
            base44.asServiceRole.entities.User.list()
        ]);

        const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
        const nameOf = (u, fallbackId) =>
            u?.display_name || u?.full_name || (u?.email ? u.email.split('@')[0] : null) || fallbackId.slice(-6);

        const today = attempts
            .map(a => {
                const u = usersMap[a.user_id];
                return {
                    user_id: a.user_id,
                    display_name: nameOf(u, a.user_id),
                    department: u?.department || '—',
                    points: a.total_points,
                    correct: a.correct_count
                };
            })
            .sort((a, b) => b.points - a.points);

        const allTime = users
            .filter(u => (u.engagement_points ?? 0) > 0)
            .map(u => ({
                user_id: u.id,
                display_name: nameOf(u, u.id),
                department: u.department || '—',
                points: u.engagement_points ?? 0
            }))
            .sort((a, b) => b.points - a.points);

        return Response.json({ today, allTime });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});