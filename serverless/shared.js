const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  try {
    const raw = event && event.body ? event.body : '{}';
    const text = event.isBase64Encoded
      ? Buffer.from(raw, 'base64').toString('utf8')
      : raw;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Server database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY).');
  return { url, key };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...options.headers
  };
  // Current sb_secret_* keys belong in apikey only. Legacy JWT service_role keys
  // also need Authorization: Bearer for PostgREST compatibility.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = { message: text }; }
  return { response, body };
}

function safePasswordMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function loadAnswersConfig() {
  if (process.env.ANSWERS_JSON) {
    try { return JSON.parse(process.env.ANSWERS_JSON); } catch (_) {}
  }
  try {
    // Read the gitignored local secret dynamically, so the function bundle does not
    // require the private file to exist in the public repository.
    const privatePath = path.join(__dirname, '../backend/answers.json');
    return JSON.parse(fs.readFileSync(privatePath, 'utf8'));
  } catch (_) {}
  return null;
}

module.exports = { json, parseBody, supabaseRequest, safePasswordMatch, loadAnswersConfig };
