const API = '';

function getToken() {
  return localStorage.getItem('panela_token');
}

function getUser() {
  const u = localStorage.getItem('panela_user');
  return u ? JSON.parse(u) : null;
}

function setAuth(token, user, refreshToken) {
  localStorage.setItem('panela_token', token);
  localStorage.setItem('panela_user', JSON.stringify(user));
  if (refreshToken) localStorage.setItem('panela_refresh', refreshToken);
}

function getRefreshToken() {
  return localStorage.getItem('panela_refresh');
}

function clearAuth() {
  localStorage.removeItem('panela_token');
  localStorage.removeItem('panela_user');
  localStorage.removeItem('panela_refresh');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + path, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    return null;
  }
  return res;
}

async function apiGet(path) {
  const res = await apiFetch(path);
  if (!res) return null;
  return res.json();
}

async function apiPost(path, body) {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res) return null;
  return res.json();
}

async function apiPut(path, body) {
  const res = await apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  if (!res) return null;
  return res.json();
}

async function apiDelete(path) {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res) return null;
  return res.json();
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function logout() {
  clearAuth();
  window.location.href = '/login';
}
