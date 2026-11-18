// middlewares/session.js - signed, HTTP-only cookie sessions (no extra dependency).
// After login the server gives the browser a cookie holding the user id plus an expiry time, signed so
// it cannot be edited. The browser sends the cookie back on every request.
const crypto = require('crypto'); // Node's built-in cryptography module

const COOKIE_NAME = 'sid';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
// Uses AUTH_SECRET from .env. Falls back to a random per-process secret, which logs everyone out on restart.
const SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

// HMAC-SHA256 is a keyed hash. Only someone who knows SECRET can produce the matching signature.
function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

// Builds "payload.signature". The payload is base64url-encoded JSON with the user id and expiry time.
function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// Checks the signature and expiry. Returns the user id, or null when the token is missing, forged or expired.
function readToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // timingSafeEqual compares in constant time so an attacker cannot learn the signature byte by byte.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

// Minimal cookie parser so we don't need cookie-parser.
// The Cookie header looks like "a=1; sid=abc"; this finds the value for one name.
function getCookie(req, name) {
  const header = req.get('cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

// httpOnly: page scripts cannot read the cookie. sameSite 'lax': not sent on cross-site POSTs.
// secure: only sent over HTTPS in production.
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

// Logs a user in by setting the cookie on the response.
function setSession(res, userId) {
  res.cookie(COOKIE_NAME, createToken(userId), { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

// Logs a user out by removing the cookie.
function clearSession(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

// Returns the logged-in user's id for a request, or null.
function getSessionUserId(req) {
  return readToken(getCookie(req, COOKIE_NAME));
}

module.exports = { setSession, clearSession, getSessionUserId };
