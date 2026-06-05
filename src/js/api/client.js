/* Minimal fetch wrapper for the backend API.
  Reads VITE_API_BASE_URL and attaches the JWT header.
  Normalizes legacy /api/* paths to the root-mounted backend routes. */

export const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
const BASE = apiBase;

function normalizePath(path) {
  const clean = path.startsWith('/api/') ? path.slice(4) : path;
  return clean.startsWith('/') ? clean : '/' + clean;
}

function authHeader() {
  const token = localStorage.getItem('naas.jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${normalizePath(path)}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get:    (p)        => request(p),
  post:   (p, body)  => request(p, { method: 'POST', body }),
  patch:  (p, body)  => request(p, { method: 'PATCH', body }),
  delete: (p)        => request(p, { method: 'DELETE' }),
};
