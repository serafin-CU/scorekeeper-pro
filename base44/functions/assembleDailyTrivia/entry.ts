import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
    const date  = body.date ?? today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ ok: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    // Step 1: Return existing set if already assembled for this date (idempotent)
    const existing = await base44.asServiceRole.entities.TriviaDailySet.filter({ date });
    if (existing.length > 0) {
      return Response.json({
        ok: true,
        date,
        question_ids: existing[0].question_ids,
        already_existed: true
      });
    }

    // Step 2: Sample questions — 2 EASY, 2 MEDIUM, 1 HARD — lowest times_used first
    const pickByDifficulty = async (difficulty, count) => {
      const pool = await base44.asServiceRole.entities.TriviaQuestion.filter({
        difficulty,
        is_active: true
      });
      if (pool.length < count) {
        throw new Error(
          `Not enough ${difficulty} questions in pool (need ${count}, have ${pool.length}). ` +
          `Run generateTriviaQuestions first.`
        );
      }
      pool.sort((a, b) => (a.times_used ?? 0) - (b.times_used ?? 0));
      // Pick randomly within the lowest-usage tier for variety
      const targetUsage = pool[count - 1].times_used ?? 0;
      const leastUsed = pool.filter(q => (q.times_used ?? 0) <= targetUsage);
      const shuffled = leastUsed.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };

    const easyPick   = await pickByDifficulty('EASY', 2);
    const mediumPick = await pickByDifficulty('MEDIUM', 2);
    const hardPick   = await pickByDifficulty('HARD', 1);

    const selected = [...easyPick, ...mediumPick, ...hardPick];
    const ids = selected.map(q => q.id);

    if (new Set(ids).size !== 5) {
      return Response.json(
        { ok: false, error: 'Duplicate questions selected — pool too small across difficulty tiers' },
        { status: 500 }
      );
    }

    // Step 3: Write TriviaDailySet (with race condition fallback)
    let dailySet;
    try {
      dailySet = await base44.asServiceRole.entities.TriviaDailySet.create({
        date,
        question_ids: ids,
        generated_at: new Date().toISOString()
      });
    } catch (writeErr) {
      // Concurrent write race — re-read and return the winning row
      console.warn(`[assembleDailyTrivia] Write conflict on date=${date}, re-reading. Error: ${writeErr.message}`);
      const recheck = await base44.asServiceRole.entities.TriviaDailySet.filter({ date });
      if (recheck.length > 0) {
        return Response.json({
          ok: true,
          date,
          question_ids: recheck[0].question_ids,
          already_existed: true,
          race_resolved: true
        });
      }
      throw writeErr; // genuine error, not a race
    }

    // Step 4: Increment times_used on each selected question (sequential, try/catch per row)
    for (const q of selected) {
      try {
        await base44.asServiceRole.entities.TriviaQuestion.update(q.id, {
          times_used: (q.times_used ?? 0) + 1
        });
        await sleep(80);
      } catch (updateErr) {
        // Non-fatal — times_used is a soft variety counter
        console.warn(`[assembleDailyTrivia] times_used update failed for ${q.id}: ${updateErr.message}`);
      }
    }

    return Response.json({
      ok: true,
      date,
      question_ids: ids,
      already_existed: false
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});