import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Scheduler-safe: keeps a rolling window of upcoming daily trivia sets filled.
// Runs without a user (service role). Idempotent — only creates missing dates.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow manual admin invocation too, but do NOT require a user (scheduled runs have none).
    let caller = null;
    try { caller = await base44.auth.me(); } catch (_e) { /* scheduled run, no user */ }
    if (caller && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const lookAheadDays = Number.isInteger(body.lookAheadDays) ? body.lookAheadDays : 7;

    // Build the rolling window: today .. today + lookAheadDays (UTC)
    const start = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const wantedDates = [];
    for (let i = 0; i <= lookAheadDays; i++) {
      wantedDates.push(new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
    }

    const existing = new Set(
      (await base44.asServiceRole.entities.TriviaDailySet.list('date', 600)).map(s => s.date)
    );
    const missing = wantedDates.filter(d => !existing.has(d));

    if (missing.length === 0) {
      return Response.json({ ok: true, created: 0, missing: [], message: 'All upcoming sets already exist.' });
    }

    // Load active pool once, balanced by category, least-used first.
    const allActive = await base44.asServiceRole.entities.TriviaQuestion.filter({ is_active: true });
    if (allActive.length < 5) {
      throw new Error(`Not enough active questions (need 5, have ${allActive.length}).`);
    }

    const byCat = {};
    for (const q of allActive) (byCat[q.category] = byCat[q.category] || []).push(q);
    const cats = Object.keys(byCat).sort();

    const used = {};
    allActive.forEach(q => { used[q.id] = q.times_used ?? 0; });

    const pickFive = () => {
      const pools = {};
      for (const c of cats) pools[c] = [...byCat[c]].sort((a, b) => (used[a.id] || 0) - (used[b.id] || 0));
      const chosen = [];
      let ci = 0;
      while (chosen.length < 5 && ci < 2000) {
        const pool = pools[cats[ci % cats.length]];
        const next = pool.find(q => !chosen.includes(q));
        if (next) { chosen.push(next); used[next.id] = (used[next.id] || 0) + 1; }
        ci++;
      }
      return chosen;
    };

    const now = new Date().toISOString();
    const created = [];

    for (const date of missing) {
      const picks = pickFive();
      if (new Set(picks.map(q => q.id)).size !== 5) {
        console.warn(`[ensureDailyTrivia] could not assemble 5 unique for ${date}, skipping`);
        continue;
      }
      try {
        await base44.asServiceRole.entities.TriviaDailySet.create({
          date,
          question_ids: picks.map(q => q.id),
          generated_at: now
        });
        created.push(date);
        await sleep(120); // gentle on rate limits
      } catch (writeErr) {
        // race / duplicate — fine, another run created it
        console.warn(`[ensureDailyTrivia] create failed for ${date}: ${writeErr.message}`);
      }
    }

    return Response.json({ ok: true, created: created.length, dates: created, window: wantedDates });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});