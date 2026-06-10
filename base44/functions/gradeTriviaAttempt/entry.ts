import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Stepped scoring for a 30-second timer.
// Points are awarded only for correct answers; speed determines the tier.
function scoreAnswer(isCorrect, responseTimeMs) {
  if (!isCorrect || responseTimeMs === null || responseTimeMs === undefined) return 0;
  const remainingMs = 30000 - responseTimeMs;
  if (remainingMs >= 25000) return 20; // 25-30s remaining
  if (remainingMs >= 20000) return 16; // 20-24s remaining
  if (remainingMs >= 15000) return 12; // 15-19s remaining
  if (remainingMs >= 10000) return 8;  // 10-14s remaining
  if (remainingMs >= 5000)  return 4;  // 5-9s remaining
  if (remainingMs >= 0)     return 1;  // 0-4s remaining
  return 0;                            // timeout
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ ok: false, error: 'Request body required' }, { status: 400 });
    }

    const { date, answers } = body;

    // Input validation
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ ok: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (!Array.isArray(answers) || answers.length !== 5) {
      return Response.json({ ok: false, error: 'answers must be an array of exactly 5 items' }, { status: 400 });
    }
    for (let i = 0; i < 5; i++) {
      const a = answers[i];
      if (!a.question_id || typeof a.question_id !== 'string') {
        return Response.json({ ok: false, error: `answers[${i}].question_id is required` }, { status: 400 });
      }
      if (
        a.selected_index !== null &&
        a.selected_index !== undefined &&
        (!Number.isInteger(a.selected_index) || a.selected_index < 0 || a.selected_index > 3)
      ) {
        return Response.json({ ok: false, error: `answers[${i}].selected_index must be 0-3 or null` }, { status: 400 });
      }
      if (!Number.isInteger(a.response_time_ms) || a.response_time_ms < 0) {
        return Response.json({ ok: false, error: `answers[${i}].response_time_ms must be a non-negative integer` }, { status: 400 });
      }
    }

    const userId = caller.id;

    // Step 1: Idempotency guard — reject double submissions
    const existingAttempts = await base44.asServiceRole.entities.TriviaAttempt.filter({
      user_id: userId,
      daily_set_date: date
    });
    if (existingAttempts.length > 0) {
      const prev = existingAttempts[0];
      return Response.json({
        ok: false,
        already_attempted: true,
        previous_attempt: {
          total_points:  prev.total_points,
          correct_count: prev.correct_count,
          completed_at:  prev.completed_at
        }
      }, { status: 409 });
    }

    // Step 2: Load and validate TriviaDailySet
    const sets = await base44.asServiceRole.entities.TriviaDailySet.filter({ date });
    if (sets.length === 0) {
      return Response.json({
        ok: false,
        error: `No daily set found for ${date}. Call assembleDailyTrivia first.`
      }, { status: 404 });
    }
    const dailySet = sets[0];

    // Validate submitted question_ids match the daily set exactly (order-sensitive)
    for (let i = 0; i < 5; i++) {
      if (answers[i].question_id !== dailySet.question_ids[i]) {
        return Response.json({
          ok: false,
          error: `answers[${i}].question_id mismatch: expected ${dailySet.question_ids[i]}, got ${answers[i].question_id}`
        }, { status: 400 });
      }
    }

    // Step 3: Grade each answer (sequential fetches)
    const gradedAnswers = [];
    let totalPoints = 0;
    let correctCount = 0;

    for (let i = 0; i < 5; i++) {
      const answer = answers[i];
      const qRows = await base44.asServiceRole.entities.TriviaQuestion.filter({ id: answer.question_id });
      if (qRows.length === 0) {
        return Response.json({ ok: false, error: `TriviaQuestion not found: ${answer.question_id}` }, { status: 404 });
      }
      const question = qRows[0];

      const selectedIndex = (answer.selected_index !== null && answer.selected_index !== undefined)
        ? answer.selected_index
        : null;
      const isCorrect = selectedIndex !== null && selectedIndex === question.correct_answer_index;
      const pointsEarned = scoreAnswer(isCorrect, answer.response_time_ms);

      if (isCorrect) correctCount++;
      totalPoints += pointsEarned;

      gradedAnswers.push({
        question_id:      answer.question_id,
        selected_index:   selectedIndex,
        response_time_ms: answer.response_time_ms,
        is_correct:       isCorrect,
        points_earned:    pointsEarned
      });
    }

    // Step 5: Write TriviaAttempt (single insert)
    const attempt = await base44.asServiceRole.entities.TriviaAttempt.create({
      user_id:        userId,
      daily_set_date: date,
      answers:        gradedAnswers,
      total_points:   totalPoints,
      correct_count:  correctCount,
      completed_at:   new Date().toISOString()
    });

    // Step 5b: Write TriviaRecord (idempotent per user+date)
    try {
      const existingRecords = await base44.asServiceRole.entities.TriviaRecord.filter({
        user_id: userId,
        date
      });
      if (existingRecords.length === 0) {
        await base44.asServiceRole.entities.TriviaRecord.create({
          user_id:         userId,
          date,
          score:           totalPoints,
          correct_answers: correctCount,
          total_questions: gradedAnswers.length,
          completed_at:    new Date().toISOString()
        });
      }
    } catch (recordErr) {
      console.warn(`[gradeTriviaAttempt] TriviaRecord not written: ${recordErr.message}`);
    }

    // Step 6: Write PointsLedger entry (only if points were earned)
    let ledgerEntry = null;
    if (totalPoints > 0) {
      ledgerEntry = await base44.asServiceRole.entities.PointsLedger.create({
        user_id:        userId,
        mode:           'ENGAGEMENT',
        source_type:    'ENGAGEMENT_EVENT',
        source_id:      attempt.id,
        points:         totalPoints,
        breakdown_json: JSON.stringify({
          reason:        `Trivia ${date}: ${correctCount}/5 correct`,
          correct_count: correctCount,
          date
        })
      });
    }

    // Step 7: Increment User.engagement_points (read-then-write, non-fatal on failure)
    let newEngagementPoints = null;
    let engagementWarning = null;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      if (users.length > 0) {
        const user = users[0];
        const current = typeof user.engagement_points === 'number' ? user.engagement_points : 0;
        newEngagementPoints = current + totalPoints;
        await base44.asServiceRole.entities.User.update(userId, {
          engagement_points: newEngagementPoints
        });
      } else {
        engagementWarning = 'User record not found for engagement_points update';
        console.warn(`[gradeTriviaAttempt] ${engagementWarning} user_id=${userId}`);
      }
    } catch (userUpdateErr) {
      engagementWarning = `engagement_points not updated: ${userUpdateErr.message}`;
      console.warn(`[gradeTriviaAttempt] ${engagementWarning} — attempt_id=${attempt.id} ledger_id=${ledgerEntry?.id}`);
    }

    // Step 8: Return result
    const response = {
      ok:                    true,
      total_points:          totalPoints,
      correct_count:         correctCount,
      breakdown:             gradedAnswers,
      new_engagement_points: newEngagementPoints,
      attempt_id:            attempt.id
    };
    if (engagementWarning) response.warning = engagementWarning;
    return Response.json(response);

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});