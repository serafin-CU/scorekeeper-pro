import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CATEGORIES = ["GROUP_STAGE", "KNOCKOUT_HISTORY", "PLAYERS_RECORDS", "HOST_2026", "RULES_FORMAT"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_text:        { type: "string" },
          options:              { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correct_answer_index: { type: "integer", minimum: 0, maximum: 3 },
          category:             { type: "string", enum: ["GROUP_STAGE","KNOCKOUT_HISTORY","PLAYERS_RECORDS","HOST_2026","RULES_FORMAT"] },
          difficulty:           { type: "string", enum: ["EASY","MEDIUM","HARD"] },
          source_note:          { type: "string" }
        },
        required: ["question_text","options","correct_answer_index","category","difficulty"]
      }
    }
  },
  required: ["questions"]
};

const VERIFIED_FACTS = `
=== FIFA WORLD CUP 2026 — VERIFIED FORMAT FACTS (USE THESE EXACTLY) ===
- The 2026 tournament has 48 teams (expanded from 32).
- There are EXACTLY 12 groups, labeled A through L (so Groups I and J exist for the first time).
- Each group contains EXACTLY 4 teams. (NOT 3 — the 3-team-per-group idea was an ABANDONED proposal and is FALSE.)
- 4 teams per group x 12 groups = 48 teams total.
- The top 2 teams from each of the 12 groups advance = 24 teams.
- The 8 best third-placed teams ALSO advance = 8 teams. Total advancing = 32 teams (a Round of 32).
- 12 groups produce 12 third-placed teams; only 8 advance, so EXACTLY 4 third-placed teams are eliminated.
- The knockout stage begins with a Round of 32 (new round, did not exist in the 32-team format).
- The tournament has 104 matches in total.
- Hosts: United States, Canada, and Mexico (three host nations).
- The final will be held at MetLife Stadium, East Rutherford, New Jersey, USA.

=== HISTORICAL FORMAT TIMELINE (VERIFIED) ===
- The 32-team format with 8 groups of 4 was first used at the 1998 FIFA World Cup (France).
- The 24-team format was used from 1982 to 1994.
- The 2026 World Cup is the FIRST to use 48 teams / 12 groups of 4.

=== VERIFIED HISTORICAL FACTS ===
- 1986 World Cup opening match: Italy 1-1 Bulgaria, at Estadio Azteca, Mexico City, 31 May 1986.
- 1958 final: Brazil 5-2 Sweden (Pele, aged 17).
- 1966 final: England beat West Germany 4-2 (a.e.t.); Geoff Hurst hat-trick; linesman Tofiq Bahramov.
- 2014 final: Germany 1-0 Argentina; Mario Gotze scored in the 113th minute from Andre Schurrle's cross.
- 2022 final: Argentina beat France (3-3 a.e.t., 4-2 on penalties); Messi scored in the final.
=== END VERIFIED FACTS ===
`.trim();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetCount  = body.target_count   ?? 50;
    const perCallBatch = body.per_call_batch  ?? 12;
    const model        = body.model           ?? 'claude_sonnet_4_6';

    // Load existing question_text values for dedup (idempotent re-run safety)
    const existingRows = await base44.asServiceRole.entities.TriviaQuestion.list();
    const existingTexts = new Set(existingRows.map(q => q.question_text.trim().toLowerCase()));

    let generated = 0;
    let skippedDuplicates = 0;
    let creditsUsed = 0;
    const errors = [];

    const totalBatches = Math.ceil(targetCount / perCallBatch);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const soFar = generated + skippedDuplicates;
      if (soFar >= targetCount) break;

      const batchSize = Math.min(perCallBatch, targetCount - soFar + 3); // +3 buffer for dedup loss

      const cat  = CATEGORIES[batchIdx % CATEGORIES.length];
      const diff = DIFFICULTIES[batchIdx % DIFFICULTIES.length];

      const prompt = `You are a World Cup trivia expert. Generate ${batchSize} unique, factually accurate multiple-choice trivia questions about the FIFA World Cup 2026 and football history.

Focus this batch on category: ${cat}, difficulty: ${diff}.

CRITICAL — SOURCE OF TRUTH:
You are given a VERIFIED FACTS sheet below. For ANY question touching the 2026 format, group structure, advancement rules, host nations, match counts, or the historical facts listed, you MUST use ONLY the verified facts. Your own internal knowledge about the 2026 format is UNRELIABLE and likely WRONG — defer to the facts sheet. In particular: the 2026 World Cup has 12 groups of EXACTLY 4 teams each (NEVER 3). If a verified fact contradicts what you "remember", the verified fact wins. Do NOT invent facts not derivable from the sheet for 2026/format topics.

${VERIFIED_FACTS}

Rules:
- Every question must have EXACTLY 4 answer options.
- Exactly ONE option is correct. The others are plausible but wrong.
- No opinion or prediction questions — only verifiable facts.
- For HOST_2026: focus on the 2026 host cities, stadiums, and format changes — use the verified facts (48 teams, 12 groups of 4, 104 matches, Round of 32).
- For GROUP_STAGE: group stage rules, format, tiebreakers, advancement criteria — for 2026 use the verified facts exactly.
- For KNOCKOUT_HISTORY: historical WC knockout results, records, upsets since 1930.
- For PLAYERS_RECORDS: goalscorers, caps, awards, Ballon d'Or, Golden Boot, individual records.
- For RULES_FORMAT: FIFA Laws of the Game, VAR, offside, card rules, substitutions, extra time.
- correct_answer_index is 0-based (0 = first option, 3 = last option).
- source_note: one line, e.g. "FIFA.com — 2026 format announcement" or "FIFA Records — all-time top scorers".
- Do NOT ask prediction questions about 2026 tournament outcomes.
- Make questions genuinely distinct from each other.

Return only the JSON object. No markdown, no preamble.`;

      let result;
      try {
        result = await base44.integrations.Core.InvokeLLM({
          prompt,
          model,
          response_json_schema: QUESTION_SCHEMA
        });
        creditsUsed++;
      } catch (llmErr) {
        errors.push(`Batch ${batchIdx} (${cat}/${diff}): LLM call failed — ${llmErr.message}`);
        await sleep(1500);
        continue;
      }

      const questions = result?.questions ?? [];

      for (const q of questions) {
        // Structural validation
        if (
          !q.question_text ||
          !Array.isArray(q.options) || q.options.length !== 4 ||
          typeof q.correct_answer_index !== 'number' ||
          q.correct_answer_index < 0 || q.correct_answer_index > 3 ||
          !CATEGORIES.includes(q.category) ||
          !DIFFICULTIES.includes(q.difficulty)
        ) {
          errors.push(`Batch ${batchIdx}: skipped malformed — "${String(q.question_text).slice(0, 50)}"`);
          continue;
        }

        // Dedup check by question_text
        const normalised = q.question_text.trim().toLowerCase();
        if (existingTexts.has(normalised)) {
          skippedDuplicates++;
          continue;
        }
        existingTexts.add(normalised);

        try {
          await base44.asServiceRole.entities.TriviaQuestion.create({
            question_text:        q.question_text.trim(),
            options:              q.options.map(o => String(o).trim()),
            correct_answer_index: q.correct_answer_index,
            category:             q.category,
            difficulty:           q.difficulty,
            source_note:          q.source_note ?? '',
            is_active:            true,
            times_used:           0
          });
          generated++;
          await sleep(100);
        } catch (writeErr) {
          errors.push(`Batch ${batchIdx}: write failed — ${writeErr.message}`);
          await sleep(400);
        }
      }

      await sleep(600); // pause between LLM calls
    }

    return Response.json({
      ok: true,
      generated,
      skipped_duplicates: skippedDuplicates,
      llm_calls_made: creditsUsed,
      errors
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});