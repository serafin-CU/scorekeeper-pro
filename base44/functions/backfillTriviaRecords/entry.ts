import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Pull all existing attempts and records
        const [attempts, existingRecords] = await Promise.all([
            base44.asServiceRole.entities.TriviaAttempt.list('-completed_at', 10000),
            base44.asServiceRole.entities.TriviaRecord.list('-date', 10000)
        ]);

        // Build a set of existing user_id|date keys to avoid duplicates
        const existingKeys = new Set(
            existingRecords.map(r => `${r.user_id}|${r.date}`)
        );

        let created = 0;
        let skipped = 0;

        for (const a of attempts) {
            if (!a.user_id || !a.daily_set_date) { skipped++; continue; }
            const key = `${a.user_id}|${a.daily_set_date}`;
            if (existingKeys.has(key)) { skipped++; continue; }

            const total = Array.isArray(a.answers) ? a.answers.length : 5;
            await base44.asServiceRole.entities.TriviaRecord.create({
                user_id: a.user_id,
                date: a.daily_set_date,
                score: a.total_points ?? 0,
                correct_answers: a.correct_count ?? 0,
                total_questions: total,
                completed_at: a.completed_at || new Date().toISOString()
            });

            existingKeys.add(key);
            created++;
        }

        return Response.json({
            success: true,
            attempts_scanned: attempts.length,
            records_created: created,
            skipped
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});