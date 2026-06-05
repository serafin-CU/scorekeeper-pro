import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_text:        { type: "string" },
          options:              { type: "array", items: { type: "string" } },
          correct_answer_index: { type: "integer", minimum: 0, maximum: 3 },
          category:             { type: "string", enum: ["HOST_2026","KNOCKOUT_HISTORY","GROUP_STAGE","PLAYERS_RECORDS","RULES_FORMAT"] },
          difficulty:           { type: "string", enum: ["EASY","MEDIUM","HARD"] },
          source_note:          { type: "string" }
        },
        required: ["question_text","options","correct_answer_index","category","difficulty"]
      }
    }
  },
  required: ["questions"]
};

const CATEGORIES = ["HOST_2026","KNOCKOUT_HISTORY","GROUP_STAGE","PLAYERS_RECORDS","RULES_FORMAT"];
const DIFFICULTIES = ["EASY","MEDIUM","HARD"];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Build array of YYYY-MM-DD date strings between start and end inclusive
function buildDateRange(startStr, endStr) {
  const dates = [];
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const startDate = body.start_date ?? today;
    const endDate   = body.end_date   ?? '2026-07-19';
    const batchSize = Number.isInteger(body.batch_size) && body.batch_size > 0 ? body.batch_size : 5;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return Response.json({ ok: false, error: 'start_date and end_date must be YYYY-MM-DD' }, { status: 400 });
    }

    const dates = buildDateRange(startDate, endDate);

    // Load existing questions once for idempotency check (by source_note containing date string)
    const existingQuestions = await base44.asServiceRole.entities.TriviaQuestion.list();
    const hasQuestions = (dateStr) =>
      existingQuestions.filter(q => q.source_note && q.source_note.includes(dateStr)).length >= 5;

    let daysProcessed = 0;
    let questionsCreated = 0;
    let skippedDays = 0;
    const errors = [];

    for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
      const dateStr = dates[dayIndex];

      // Idempotent re-run safety: skip dates already having 5+ questions for that date
      if (hasQuestions(dateStr)) {
        skippedDays++;
        continue;
      }

      // Cap each invocation at batchSize processed days to stay under the serverless timeout
      if (daysProcessed >= batchSize) {
        break;
      }

      const dayNumber = dayIndex + 6; // Days 1-5 are May 27-31
      const noteBase = `Day ${dayNumber} – ${dateStr} – FIFA World Cup 2026`;

      const prompt = `You are a World Cup trivia expert. Generate 5 unique, factually accurate multiple-choice trivia questions about the FIFA World Cup 2026 and football history.

Rules:
- Every question must have EXACTLY 4 answer options.
- Exactly ONE option is correct; the others are plausible but wrong.
- No opinion or prediction questions about 2026 tournament outcomes — only verifiable facts.
- Mix categories across: ${CATEGORIES.join(', ')}.
- Mix difficulties across: ${DIFFICULTIES.join(', ')}.
- correct_answer_index is 0-based (0 = first option, 3 = last option).
- Make questions genuinely distinct from each other.

Return only the JSON object. No markdown, no preamble.`;

      let result;
      try {
        result = await base44.integrations.Core.InvokeLLM({
          prompt,
          model: 'claude_sonnet_4_6',
          response_json_schema: QUESTION_SCHEMA
        });
      } catch (llmErr) {
        errors.push(`${dateStr}: LLM call failed — ${llmErr.message}`);
        await sleep(1500);
        continue;
      }

      const questions = (result?.questions ?? []).slice(0, 5);
      let createdForThisDate = 0;

      for (const q of questions) {
        if (
          !q.question_text ||
          !Array.isArray(q.options) || q.options.length !== 4 ||
          typeof q.correct_answer_index !== 'number' ||
          q.correct_answer_index < 0 || q.correct_answer_index > 3 ||
          !CATEGORIES.includes(q.category) ||
          !DIFFICULTIES.includes(q.difficulty)
        ) {
          errors.push(`${dateStr}: skipped malformed — "${String(q.question_text).slice(0, 50)}"`);
          continue;
        }

        try {
          await base44.asServiceRole.entities.TriviaQuestion.create({
            question_text:        q.question_text.trim(),
            options:              q.options.map(o => String(o).trim()),
            correct_answer_index: q.correct_answer_index,
            category:             q.category,
            difficulty:           q.difficulty,
            source_note:          noteBase,
            is_active:            true,
            times_used:           0
          });
          questionsCreated++;
          createdForThisDate++;
        } catch (writeErr) {
          errors.push(`${dateStr}: write failed — ${writeErr.message}`);
        }
      }

      // Reflect new questions in the in-memory list so remainingDays is accurate
      for (let i = 0; i < createdForThisDate; i++) {
        existingQuestions.push({ source_note: noteBase });
      }

      daysProcessed++;
      await sleep(1500); // pause between each day's LLM call to avoid rate limits
    }

    // Count dates across the full range that still have no complete question set
    const remainingDays = dates.filter(d => !hasQuestions(d)).length;

    return Response.json({
      ok: true,
      daysProcessed,
      questionsCreated,
      skippedDays,
      remainingDays,
      errors
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});