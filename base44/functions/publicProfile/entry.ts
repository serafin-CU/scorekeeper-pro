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

        const [ledger, badges, posts, teams] = await Promise.all([
            base44.asServiceRole.entities.PointsLedger.filter({ user_id }),
            base44.asServiceRole.entities.BadgeAward.filter({ user_id }),
            base44.asServiceRole.entities.FeedPost.filter({ author_id: user_id }, '-created_date', 10),
            target.preferred_team_id
                ? base44.asServiceRole.entities.Team.filter({ id: target.preferred_team_id })
                : Promise.resolve([])
        ]);

        const prodePoints = ledger.filter(e => e.mode === 'PRODE').reduce((s, e) => s + (e.points || 0), 0);

        const profile = {
            id: target.id,
            display_name: target.display_name || target.full_name || 'Anonymous',
            department: target.department || '',
            avatar_url: target.avatar_url || '',
            favorite_team: teams?.[0] ? { name: teams[0].name, fifa_code: teams[0].fifa_code } : null,
            prode_points: prodePoints,
            badges: badges.map(b => ({ badge_type: b.badge_type, awarded_at: b.awarded_at })),
            posts: posts.map(p => ({
                id: p.id,
                content: p.content,
                created_date: p.created_date,
                like_count: p.like_count || 0,
                comment_count: p.comment_count || 0
            }))
        };

        return Response.json({ profile });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});