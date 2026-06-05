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
          category:             { type: "string", enum: ["HOST_2026","KNOCKOUT_HISTORY","GROUP_STAGE","PLAYERS_RECORDS","RULES_FORMAT","CULTURE_AND_FOOD"] },
          difficulty:           { type: "string", enum: ["EASY","MEDIUM","HARD"] },
          source_note:          { type: "string" }
        },
        required: ["question_text","options","correct_answer_index","category","difficulty"]
      }
    }
  },
  required: ["questions"]
};

const CATEGORIES = ["HOST_2026","KNOCKOUT_HISTORY","GROUP_STAGE","PLAYERS_RECORDS","RULES_FORMAT","CULTURE_AND_FOOD"];
const DIFFICULTIES = ["EASY","MEDIUM","HARD"];

// Fixed 39-day calendar. date is the 2026 calendar date.
const CALENDAR = [
  { day: 1,  date: "2026-05-27", phase: "Pre-tournament", theme: "Format & 48-team expansion" },
  { day: 2,  date: "2026-05-28", phase: "Pre-tournament", theme: "History — 2022 Qatar" },
  { day: 3,  date: "2026-05-29", phase: "Pre-tournament", theme: "Host nations (USA/CAN/MEX)" },
  { day: 4,  date: "2026-05-30", phase: "Pre-tournament", theme: "CookUnity Canada angle" },
  { day: 5,  date: "2026-05-31", phase: "Pre-tournament", theme: "Argentina history" },
  { day: 6,  date: "2026-06-11", phase: "Matchday 1",  theme: "Opening day — Group A/B" },
  { day: 7,  date: "2026-06-12", phase: "Matchday 2",  theme: "Group C/D" },
  { day: 8,  date: "2026-06-13", phase: "Matchday 3",  theme: "Group E/F" },
  { day: 9,  date: "2026-06-14", phase: "Matchday 4",  theme: "Group G/H" },
  { day: 10, date: "2026-06-15", phase: "Matchday 5",  theme: "Group I/J" },
  { day: 11, date: "2026-06-16", phase: "Matchday 6",  theme: "Group K/L" },
  { day: 12, date: "2026-06-17", phase: "Matchday 7",  theme: "Records & legends" },
  { day: 13, date: "2026-06-18", phase: "Matchday 8",  theme: "Iconic World Cup moments" },
  { day: 14, date: "2026-06-19", phase: "Matchday 9",  theme: "Host cities & stadiums" },
  { day: 15, date: "2026-06-20", phase: "Matchday 10", theme: "VAR & rules of the game" },
  { day: 16, date: "2026-06-21", phase: "Matchday 11", theme: "All-time top scorers" },
  { day: 17, date: "2026-06-22", phase: "Matchday 12", theme: "Group stage tiebreakers" },
  { day: 18, date: "2026-06-23", phase: "Matchday 13", theme: "Golden Boot history" },
  { day: 19, date: "2026-06-24", phase: "Matchday 14", theme: "Upsets & giant-killings" },
  { day: 20, date: "2026-06-25", phase: "Matchday 15", theme: "Ballon d'Or winners" },
  { day: 21, date: "2026-06-26", phase: "Matchday 16", theme: "Goalkeepers & clean sheets" },
  { day: 22, date: "2026-06-27", phase: "Matchday 17", theme: "Penalty shootout history" },
  { day: 23, date: "2026-06-28", phase: "Matchday 18", theme: "Group stage final day" },
  { day: 24, date: "2026-06-29", phase: "Round of 32", theme: "Knockout round rules" },
  { day: 25, date: "2026-06-30", phase: "Round of 32", theme: "Countries debuting in WC" },
  { day: 26, date: "2026-07-01", phase: "Round of 32", theme: "Most WC appearances" },
  { day: 27, date: "2026-07-02", phase: "Round of 32", theme: "Hat-tricks at World Cups" },
  { day: 28, date: "2026-07-03", phase: "Round of 16", theme: "Comeback matches" },
  { day: 29, date: "2026-07-04", phase: "Round of 16", theme: "Coaches & tactics" },
  { day: 30, date: "2026-07-05", phase: "Round of 16", theme: "WC final moments" },
  { day: 31, date: "2026-07-06", phase: "Quarterfinals", theme: "Legends of the game" },
  { day: 32, date: "2026-07-07", phase: "Quarterfinals", theme: "African/Asian teams history" },
  { day: 33, date: "2026-07-09", phase: "Semifinals", theme: "Top-5 goals ever" },
  { day: 34, date: "2026-07-10", phase: "Semifinals", theme: "WC records (fastest goal etc)" },
  { day: 35, date: "2026-07-12", phase: "3rd place", theme: "Third place match history" },
  { day: 36, date: "2026-07-13", phase: "Pre-final", theme: "All-time WC finals" },
  { day: 37, date: "2026-07-14", phase: "Rest day", theme: "CONCACAF history" },
  { day: 38, date: "2026-07-18", phase: "Pre-final", theme: "Argentina & Messi records" },
  { day: 39, date: "2026-07-19", phase: "Final day", theme: "Greatest WC moments ever" }
];

// Format YYYY-MM-DD -> "May 27" (matches "{date}" in the source_note spec)
function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function noteFor(entry) {
  return `Day ${entry.day} – ${prettyDate(entry.date)} – ${entry.theme}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Normalize a question text for dedup comparison
function normText(t) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '');
}

// Robustly pull the questions array out of whatever shape InvokeLLM returns.
function extractQuestions(result) {
  if (!result) return [];
  let data = result;
  if (typeof data === 'string') {
    let text = data.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { data = JSON.parse(text); } catch { return []; }
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.questions)) return data.questions;
  if (Array.isArray(data?.response?.questions)) return data.response.questions;
  if (Array.isArray(data?.data?.questions)) return data.data.questions;
  if (Array.isArray(data?.result?.questions)) return data.result.questions;
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Number.isInteger(body.batch_size) && body.batch_size > 0 ? body.batch_size : 5;
    const wipe = body.wipe === true;

    // Optional full wipe before regenerating
    if (wipe) {
      const all = await base44.asServiceRole.entities.TriviaQuestion.list();
      for (const q of all) {
        await base44.asServiceRole.entities.TriviaQuestion.delete(q.id);
      }
      return Response.json({ ok: true, wiped: all.length, remainingDays: CALENDAR.length });
    }

    // Load existing questions once: used for idempotency + global dedup of question_text
    const existing = await base44.asServiceRole.entities.TriviaQuestion.list();
    const usedTexts = new Set(existing.map(q => normText(q.question_text)));
    const dayHasFive = (entry) =>
      existing.filter(q => q.source_note && q.source_note.includes(`Day ${entry.day} –`)).length >= 5;

    let daysProcessed = 0;
    let questionsCreated = 0;
    let skippedDays = 0;
    const errors = [];

    for (const entry of CALENDAR) {
      if (dayHasFive(entry)) { skippedDays++; continue; }
      if (daysProcessed >= batchSize) break;

      const note = noteFor(entry);

      // Give the model the questions already used so it never repeats them
      const usedList = Array.from(usedTexts).slice(-150);
      const avoidBlock = usedList.length
        ? `\n\nDo NOT repeat or paraphrase any of these already-used questions:\n${usedList.map(t => `- ${t}`).join('\n')}`
        : '';

      const prompt = `You are a World Cup trivia expert. Generate EXACTLY 5 unique, factually accurate multiple-choice trivia questions for ONE day of a daily quiz.

This day's theme: "${entry.theme}" (Phase: ${entry.phase}, ${prettyDate(entry.date)} 2026).
All 5 questions must genuinely fit this specific theme.

Rules:
- Each question has EXACTLY 4 options, with exactly ONE correct answer; wrong options must be plausible.
- Only verifiable facts — no predictions about the 2026 tournament outcome.
- correct_answer_index is 0-based (0 = first option, 3 = last option).
- The 5 questions must be distinct from one another.
- Pick a "category" per question from: ${CATEGORIES.join(', ')}.
- Mix difficulties across: ${DIFFICULTIES.join(', ')}.${avoidBlock}

Return only the JSON object. No markdown, no preamble.`;

      let result;
      try {
        result = await base44.integrations.Core.InvokeLLM({
          prompt,
          model: 'claude_sonnet_4_6',
          response_json_schema: QUESTION_SCHEMA
        });
      } catch (llmErr) {
        errors.push(`Day ${entry.day}: LLM call failed — ${llmErr.message}`);
        await sleep(1500);
        continue;
      }

      const questions = extractQuestions(result);
      let createdForThisDay = 0;

      for (const q of questions) {
        if (createdForThisDay >= 5) break;
        if (
          !q.question_text ||
          !Array.isArray(q.options) || q.options.length !== 4 ||
          typeof q.correct_answer_index !== 'number' ||
          q.correct_answer_index < 0 || q.correct_answer_index > 3 ||
          !CATEGORIES.includes(q.category) ||
          !DIFFICULTIES.includes(q.difficulty)
        ) {
          errors.push(`Day ${entry.day}: skipped malformed — "${String(q.question_text).slice(0, 50)}"`);
          continue;
        }

        const key = normText(q.question_text);
        if (usedTexts.has(key)) {
          errors.push(`Day ${entry.day}: skipped duplicate — "${String(q.question_text).slice(0, 50)}"`);
          continue;
        }

        try {
          await base44.asServiceRole.entities.TriviaQuestion.create({
            question_text:        q.question_text.trim(),
            options:              q.options.map(o => String(o).trim()),
            correct_answer_index: q.correct_answer_index,
            category:             q.category,
            difficulty:           q.difficulty,
            source_note:          note,
            is_active:            true,
            times_used:           0
          });
          usedTexts.add(key);
          existing.push({ source_note: note, question_text: q.question_text });
          questionsCreated++;
          createdForThisDay++;
        } catch (writeErr) {
          errors.push(`Day ${entry.day}: write failed — ${writeErr.message}`);
        }
      }

      if (createdForThisDay < 5) {
        errors.push(`Day ${entry.day}: only created ${createdForThisDay}/5 unique questions`);
      }

      daysProcessed++;
      await sleep(1500);
    }

    const remainingDays = CALENDAR.filter(e => !dayHasFive(e)).length;

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