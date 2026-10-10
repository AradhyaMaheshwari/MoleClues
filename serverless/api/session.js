const { generateSessionToken } = require('../../backend/api/session');
const { json, parseBody, supabaseRequest } = require('../shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON request body' });

  const puzzleId = String(body.puzzleId || '').trim();
  const teamName = String(body.teamName || '').trim();
  if (!puzzleId || teamName.length < 2 || teamName.length > 80) {
    return json(400, { error: 'Enter a team name between 2 and 80 characters.' });
  }

  try {
    const normalizedTeamName = teamName.normalize('NFKC').trim().toLocaleLowerCase();
    const { response: completedResponse, body: completedRows } = await supabaseRequest(
      `crossword_attempts?select=team_name&status=eq.submitted&all_correct=eq.true&puzzle_id=eq.${encodeURIComponent(puzzleId)}&limit=1000`,
      { method: 'GET' }
    );
    if (!completedResponse.ok || !Array.isArray(completedRows)) {
      console.error('Could not verify whether the team already completed:', completedRows);
      return json(503, { error: 'Could not verify team eligibility. Please retry in a moment.' });
    }
    const alreadyCompleted = completedRows.some(row =>
      String(row.team_name || '').normalize('NFKC').trim().toLocaleLowerCase() === normalizedTeamName
    );
    if (alreadyCompleted) {
      return json(409, { error: 'This team has already completed MoleClues. Continue to the final clue.' });
    }

    const session = generateSessionToken(puzzleId, teamName);
    const record = {
      session_id: session.sessionId,
      puzzle_id: puzzleId,
      team_name: teamName,
      started_at: new Date(session.startTime).toISOString(),
      status: 'in_progress',
      score: null,
      total: null,
      all_correct: false,
      time_seconds: null,
      submitted_at: null
    };

    const { response, body: dbBody } = await supabaseRequest('crossword_attempts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(record)
    });
    if (!response.ok) {
      console.error('Could not record team session:', dbBody);
      return json(503, { error: 'Could not register your attempt. Please retry in a moment.' });
    }

    return json(200, { sessionToken: session.sessionToken, startTime: session.startTime });
  } catch (error) {
    console.error('Session creation failed:', error.message);
    return json(500, { error: error.message || 'Could not start the session.' });
  }
};
