import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { start = 0, size = 10 } = await req.json().catch(() => ({}));

        // Load all questions (sorted stable by created_date) so the range is deterministic
        const all = await base44.asServiceRole.entities.TriviaQuestion.list('created_date', 1000);
        const total = all.length;
        const batch = all.slice(start, start + size);

        if (batch.length === 0) {
            return Response.json({ ok: true, total_questions: total, checked_range: [start, start], next_start: start, has_more: false, flagged_count: 0, flagged: [] });
        }

        const flagged = [];

        for (const q of batch) {
            const optionsList = q.options.map((o, i) => `${i}: ${o}`).join('\n');
            const markedAnswer = q.options[q.correct_answer_index];

            const prompt = `You are a meticulous FIFA World Cup fact-checker. Verify the following multiple-choice trivia question.

Question: ${q.question_text}

Options:
${optionsList}

The currently marked correct answer is index ${q.correct_answer_index} ("${markedAnswer}").

Use authoritative, verifiable facts. Determine:
1. Is the question itself factually sound (no false premise)?
2. Is the marked answer actually correct?

Respond strictly in the JSON schema. If everything is correct, set "is_correct" to true. If the marked answer is wrong but one of the OTHER options is correct, set "is_correct" to false and provide "correct_index". If the question has a false premise or NO option is correct, set "is_correct" to false and "correct_index" to null.`;

            const res = await base44.integrations.Core.InvokeLLM({
                prompt,
                model: 'gemini_3_flash',
                add_context_from_internet: true,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        is_correct: { type: 'boolean' },
                        correct_index: { type: ['integer', 'null'] },
                        reason: { type: 'string' }
                    },
                    required: ['is_correct', 'reason']
                }
            });

            if (res && res.is_correct === false) {
                let shouldBe = 'NONE_CORRECT';
                if (typeof res.correct_index === 'number' && q.options[res.correct_index] !== undefined) {
                    shouldBe = q.options[res.correct_index];
                }
                flagged.push({
                    id: q.id,
                    question: q.question_text,
                    options: q.options,
                    marked: markedAnswer,
                    should_be: shouldBe,
                    correct_index: typeof res.correct_index === 'number' ? res.correct_index : null,
                    reason: res.reason
                });
            }
        }

        const nextStart = start + batch.length;
        return Response.json({
            ok: true,
            total_questions: total,
            checked_range: [start, nextStart],
            next_start: nextStart,
            has_more: nextStart < total,
            flagged_count: flagged.length,
            flagged
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});