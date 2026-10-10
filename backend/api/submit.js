/**
 * Validate a crossword submission without exposing answer strings.
 * Persistence is handled by backend/server.js locally and Supabase in Netlify Functions.
 */
const { verifySessionToken } = require('./session');

function loadAnswersConfig() {
  try {
    return require('../answers.json');
  } catch (_) {
    if (process.env.ANSWERS_JSON) {
      try { return JSON.parse(process.env.ANSWERS_JSON); } catch (_) { /* return empty */ }
    }
  }
  return { puzzleId: 'cell-bio-crossword-2026', answers: {} };
}

function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, body: { error: 'Invalid request body' } };
  }

  const secretConfig = loadAnswersConfig();
  const { puzzleId, sessionToken, answers } = body;
  if (!puzzleId || puzzleId !== secretConfig.puzzleId) {
    return { status: 400, body: { error: 'Invalid or unknown puzzle ID' } };
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { status: 400, body: { error: 'Malformed answers payload' } };
  }

  const session = verifySessionToken(sessionToken, puzzleId);
  if (!session) {
    return { status: 401, body: { error: 'Invalid or missing session. Refresh the page and start again.' } };
  }

  const secretAnswers = secretConfig.answers || {};
  const wordIds = Object.keys(secretAnswers);
  if (wordIds.length === 0) {
    return { status: 503, body: { error: 'The private answer key is not configured on the server.' } };
  }

  let score = 0;
  for (const id of wordIds) {
    const expected = String(secretAnswers[id]).trim().toUpperCase();
    const submitted = answers[id];
    if (typeof submitted === 'string' && submitted.trim().toUpperCase() === expected) score++;
  }

  const timeSeconds = Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));
  return {
    status: 200,
    session,
    body: {
      status: 'success',
      score,
      total: wordIds.length,
      allCorrect: score === wordIds.length,
      timeSeconds
    }
  };
}

module.exports = { validateSubmission };
