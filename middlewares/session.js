// middlewares/session.js - signed, HTTP-only cookie sessions (no extra dependency)
const crypto = require('crypto');

const COOKIE_NAME = 'sid';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
// Uses AUTH_SECRET from .env. Falls back to a random per-process secret, which logs everyone out on restart.
const SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

// Minimal cookie parser so we don't need cookie-parser
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

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

function setSession(res, userId) {
  res.cookie(COOKIE_NAME, createToken(userId), { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function getSessionUserId(req) {
  return readToken(getCookie(req, COOKIE_NAME));
}

module.exports = { setSession, clearSession, getSessionUserId };
