const { json, supabaseRequest, safePasswordMatch } = require('../shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' }, { Allow: 'GET' });
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const receivedPassword = event.headers && (event.headers['x-admin-password'] || event.headers['X-Admin-Password']);
  if (!safePasswordMatch(receivedPassword, expectedPassword)) {
    return json(401, { error: 'Incorrect administrator password.' });
  }

  try {
    const query = 'crossword_attempts?select=team_name,puzzle_id,started_at,submitted_at,status,score,total,all_correct,time_seconds&order=started_at.desc&limit=1000';
    const { response, body } = await supabaseRequest(query, { method: 'GET' });
    if (!response.ok) {
      console.error('Leaderboard read failed:', body);
      return json(503, { error: 'Could not load leaderboard data.' });
    }
    return json(200, { attempts: Array.isArray(body) ? body : [] });
  } catch (error) {
    console.error('Leaderboard request failed:', error.message);
    return json(503, { error: 'Leaderboard storage is not configured correctly.' });
  }
};
