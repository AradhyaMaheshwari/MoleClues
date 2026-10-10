/** Local development server with private answer validation and a local attempt ledger. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateSessionToken, verifySessionToken } = require('./api/session');
const { validateSubmission } = require('./api/submit');

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const ATTEMPTS_FILE = path.join(__dirname, 'attempts.json');
const LOCAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'moleclues-local-admin';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch (_) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function readAttempts() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ATTEMPTS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed.map(item => ({
      ...item,
      team_name: item.team_name || [item.participant_name, item.participant_id].filter(Boolean).join(' / ') || 'Legacy team'
    })) : [];
  } catch (_) {
    return [];
  }
}

function writeAttempts(attempts) {
  const temp = `${ATTEMPTS_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(attempts, null, 2), { mode: 0o600 });
  fs.renameSync(temp, ATTEMPTS_FILE);
}

function safePasswordMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'POST' && pathname === '/api/session') {
    try {
      const body = await readJsonBody(req);
      const puzzleId = String(body.puzzleId || '').trim();
      const teamName = String(body.teamName || '').trim();
      if (!puzzleId || teamName.length < 2 || teamName.length > 80) {
        return send(res, 400, { error: 'Enter a team name between 2 and 80 characters.' });
      }

      const attempts = readAttempts();
      const normalizedTeamName = teamName.normalize('NFKC').trim().toLocaleLowerCase();
      const alreadyCompleted = attempts.some(item =>
        String(item.team_name || '').normalize('NFKC').trim().toLocaleLowerCase() === normalizedTeamName &&
        item.status === 'submitted' && item.all_correct === true
      );
      if (alreadyCompleted) {
        return send(res, 409, { error: 'This team has already completed MoleClues. Continue to the final clue.' });
      }

      const session = generateSessionToken(puzzleId, teamName);
      attempts.push({
        session_id: session.sessionId,
        puzzle_id: puzzleId,
        team_name: teamName,
        started_at: new Date(session.startTime).toISOString(),
        submitted_at: null,
        status: 'in_progress',
        score: null,
        total: null,
        all_correct: false,
        time_seconds: null
      });
      writeAttempts(attempts);
      return send(res, 200, { sessionToken: session.sessionToken, startTime: session.startTime });
    } catch (err) {
      console.error('Session creation error:', err.message);
      return send(res, 500, { error: 'Could not start the official session. Verify the private answer configuration and retry.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/submit') {
    try {
      const body = await readJsonBody(req);
      const result = validateSubmission(body);
      if (result.status !== 200) return send(res, result.status, result.body);

      const attempts = readAttempts();
      const index = attempts.findIndex(item => item.session_id === result.session.sessionId);
      if (index < 0 || attempts[index].status !== 'in_progress') {
        return send(res, 409, { error: 'This session has already been submitted or is not registered.' });
      }

      const isCorrect = result.body.allCorrect;
      if (isCorrect) {
        const normalizedTeamName = String(attempts[index].team_name || '').normalize('NFKC').trim().toLocaleLowerCase();
        const anotherCompletedSession = attempts.some((item, itemIndex) => itemIndex !== index &&
          String(item.team_name || '').normalize('NFKC').trim().toLocaleLowerCase() === normalizedTeamName &&
          item.status === 'submitted' && item.all_correct === true);
        if (anotherCompletedSession) {
          return send(res, 409, { error: 'This team has already completed MoleClues.' });
        }
      }
      attempts[index] = {
        ...attempts[index],
        status: isCorrect ? 'submitted' : 'in_progress',
        submitted_at: isCorrect ? new Date().toISOString() : null,
        score: result.body.score,
        total: result.body.total,
        all_correct: isCorrect,
        time_seconds: result.body.timeSeconds
      };
      writeAttempts(attempts);
      return send(res, 200, result.body);
    } catch (err) {
      console.error('Submission error:', err.message);
      const code = err.message === 'Request body too large' ? 413 : 400;
      return send(res, code, { error: code === 413 ? 'Request body too large' : 'Malformed request' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const received = req.headers['x-admin-password'];
    if (!safePasswordMatch(received, LOCAL_ADMIN_PASSWORD)) {
      return send(res, 401, { error: 'Incorrect administrator password.' });
    }
    const attempts = readAttempts().sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    return send(res, 200, { attempts });
  }

  if (req.method === 'GET' && (pathname === '/' || !pathname.startsWith('/api/'))) {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const resolved = path.resolve(FRONTEND_DIR, relative);
    if (resolved !== FRONTEND_DIR && !resolved.startsWith(FRONTEND_DIR + path.sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(resolved, (err, content) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
    return;
  }

  send(res, 404, { error: 'Not found' });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`MoleClues local server running at http://localhost:${PORT}`);
    console.log(`Administrator page: http://localhost:${PORT}/admin.html`);
    console.log(`Local admin password: ${LOCAL_ADMIN_PASSWORD}`);
    console.log('Local attempt records are stored in backend/attempts.json (keep this file private).');
  });
}

module.exports = server;
