// api.js - helpers for talking to the backend and remembering the logged-in user in the browser.
const USER_KEY = 'user';

// localStorage keeps small text values in the browser between visits. Only the user's display details are
// kept here; the real login is the HTTP-only session cookie.
export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function storeUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

// api(url, options) wraps fetch(): it sends JSON, includes the session cookie, and throws an Error with the
// server's message when the response is not OK. Pages call it with await inside try/catch.
export async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

