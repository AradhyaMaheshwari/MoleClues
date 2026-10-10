const { verifySessionToken } = require('../../backend/api/session');
const { json, parseBody, supabaseRequest, loadAnswersConfig } = require('../shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON request body' });

  const config = loadAnswersConfig();
  if (!config || !config.answers || !Object.keys(config.answers).length) {
    return json(503, { error: 'The private answer key is not configured on the server.' });
  }
  if (body.puzzleId !== config.puzzleId) return json(400, { error: 'Invalid or unknown puzzle ID' });
  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
    return json(400, { error: 'Malformed answers payload' });
  }

  const session = verifySessionToken(body.sessionToken, body.puzzleId);
  if (!session) return json(401, { error: 'Invalid or expired session. Refresh and start the crossword again.' });

  let score = 0;
  const answerEntries = Object.entries(config.answers);
  for (const [id, expectedValue] of answerEntries) {
    const expected = String(expectedValue).trim().toUpperCase();
    const submitted = body.answers[id];
    if (typeof submitted === 'string' && submitted.trim().toUpperCase() === expected) score++;
  }

  const now = Date.now();
  const timeSeconds = Math.max(0, Math.floor((now - session.startTime) / 1000));
  const allCorrect = score === answerEntries.length;

  if (allCorrect) {
    const normalizedTeamName = String(session.teamName || '').normalize('NFKC').trim().toLocaleLowerCase();
    const { response: completedResponse, body: completedRows } = await supabaseRequest(
      `crossword_attempts?select=session_id,team_name&status=eq.submitted&all_correct=eq.true&puzzle_id=eq.${encodeURIComponent(body.puzzleId)}&limit=1000`,
      { method: 'GET' }
    );
    if (!completedResponse.ok || !Array.isArray(completedRows)) {
      console.error('Could not verify duplicate completion:', completedRows);
      return json(503, { error: 'Could not verify team eligibility. Please retry.' });
    }
    const anotherCompletedSession = completedRows.some(row =>
      row.session_id !== session.sessionId &&
      String(row.team_name || '').normalize('NFKC').trim().toLocaleLowerCase() === normalizedTeamName
    );
    if (anotherCompletedSession) {
      return json(409, { error: 'This team has already completed MoleClues. Continue to the final clue.' });
    }
  }

  const resultRecord = {
    status: allCorrect ? 'submitted' : 'in_progress',
    submitted_at: allCorrect ? new Date(now).toISOString() : null,
    score,
    total: answerEntries.length,
    all_correct: allCorrect,
    time_seconds: timeSeconds
  };

  try {
    const { response, body: dbBody } = await supabaseRequest(
      `crossword_attempts?session_id=eq.${encodeURIComponent(session.sessionId)}&status=eq.in_progress`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(resultRecord)
      }
    );
    if (!response.ok) {
      console.error('Could not record submission:', dbBody);
      return json(503, { error: 'Could not save your result. Please retry.' });
    }
    if (!Array.isArray(dbBody) || dbBody.length === 0) {
      return json(409, { error: 'This session has already been submitted or is not registered.' });
    }
    return json(200, {
      status: 'success',
      score,
      total: answerEntries.length,
      allCorrect,
      timeSeconds
    });
  } catch (error) {
    console.error('Submission save failed:', error.message);
    return json(503, { error: 'Could not save your result. Please retry.' });
  }
};
