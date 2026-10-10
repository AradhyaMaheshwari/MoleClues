/** HMAC-signed team session token; team identity cannot be changed at submission time. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadSecretConfig() {
  if (process.env.ANSWERS_JSON) {
    try { return JSON.parse(process.env.ANSWERS_JSON); } catch (_) { /* try local file */ }
  }
  try {
    // Read dynamically so Netlify can bundle this module when the private file is gitignored.
    const privatePath = path.join(__dirname, '../answers.json');
    return JSON.parse(fs.readFileSync(privatePath, 'utf8'));
  } catch (_) {
    return {};
  }
}

function getSecretSalt() {
  const config = loadSecretConfig();
  const salt = process.env.SESSION_SECRET || config.secretSalt;
  if (typeof salt !== 'string' || salt.trim().length < 16) {
    throw new Error('Set SESSION_SECRET (at least 16 characters) or provide a private secretSalt in ANSWERS_JSON.');
  }
  return salt;
}

function signedPayload({ sessionId, startTime, puzzleId, teamName }) {
  return `${sessionId}:${startTime}:${puzzleId}:${teamName}`;
}

function generateSessionToken(puzzleId, teamName) {
  const cleanTeamName = String(teamName || '').trim();
  if (!puzzleId || cleanTeamName.length < 2 || cleanTeamName.length > 80) {
    throw new Error('A valid puzzle ID and team name are required.');
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const startTime = Date.now();
  const data = { sessionId, startTime, puzzleId, teamName: cleanTeamName };
  const signature = crypto.createHmac('sha256', getSecretSalt())
    .update(signedPayload(data))
    .digest('hex');

  const sessionToken = Buffer.from(JSON.stringify({ ...data, signature })).toString('base64');
  return { sessionToken, startTime, sessionId, ...data };
}

function verifySessionToken(tokenString, expectedPuzzleId) {
  if (!tokenString || typeof tokenString !== 'string') return null;
  try {
    const data = JSON.parse(Buffer.from(tokenString, 'base64').toString('utf8'));
    const { sessionId, startTime, puzzleId, teamName, signature } = data;
    if (!sessionId || !Number.isFinite(Number(startTime)) || !puzzleId ||
        typeof teamName !== 'string' || !teamName.trim() || typeof signature !== 'string') return null;
    if (expectedPuzzleId && puzzleId !== expectedPuzzleId) return null;

    const expected = crypto.createHmac('sha256', getSecretSalt())
      .update(signedPayload({ sessionId, startTime, puzzleId, teamName }))
      .digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

    return {
      sessionId,
      startTime: Number(startTime),
      puzzleId,
      teamName
    };
  } catch (_) {
    return null;
  }
}

module.exports = { generateSessionToken, verifySessionToken };
