const API_URL = '';

function getToken() {
  return localStorage.getItem('panela_token');
}

function isVisitante() {
  return localStorage.getItem('panela_visitante') === '1';
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('panela_user')); } catch { return null; }
}

function setToken(t) {
  localStorage.setItem('panela_token', t);
}

function setUser(u) {
  localStorage.setItem('panela_user', JSON.stringify(u));
}

function clearAuth() {
  localStorage.removeItem('panela_token');
  localStorage.removeItem('panela_user');
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/login'; return false; }
  return true;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const res = await fetch(API_URL + path, { ...options, headers, signal: AbortSignal.timeout(15000) });
    if (res.status === 401) { clearAuth(); window.location.href = '/login'; return null; }
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Modo visitante: apenas visualização.');
      return null;
    }
    return res;
  } catch (e) {
    console.error('apiFetch error:', e);
    return null;
  }
}

async function apiGet(path) {
  const res = await apiFetch(path);
  return res ? res.json() : null;
}

async function apiPost(path, body) {
  if (isVisitante()) { alert('Modo visitante: apenas visualização.'); return null; }
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  return res ? res.json() : null;
}

async function apiPut(path, body) {
  if (isVisitante()) { alert('Modo visitante: apenas visualização.'); return null; }
  const res = await apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  return res ? res.json() : null;
}

async function apiDelete(path) {
  if (isVisitante()) { alert('Modo visitante: apenas visualização.'); return null; }
  const res = await apiFetch(path, { method: 'DELETE' });
  return res ? res.json() : null;
}

function apiBlockedByVisitante() {
  return isVisitante();
}

function hideEditButtons() {
  if (isVisitante()) {
    document.querySelectorAll('[data-acao], [data-toggle], .btn-editar, .btn-excluir, .btn-novo').forEach(el => el.style.display = 'none');
  }
}

function showVisitanteBanner() {
  if (isVisitante()) {
    const b = document.createElement('div');
    b.id = 'visitante-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#c95f1e;color:#fff;text-align:center;padding:6px 12px;font-size:12px;font-weight:600;letter-spacing:.02em;';
    b.textContent = 'MODO VISITANTE — apenas visualização. Para editar, faça login com sua conta.';
    document.body.prepend(b);
  }
}

showVisitanteBanner();
document.addEventListener('DOMContentLoaded', hideEditButtons);

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function logout() {
  clearAuth();
  window.location.href = '/login';
}

function showLoading(el) {
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)"><div style="font-size:32px;margin-bottom:12px">⏳</div><div>Carregando...</div></div>';
}

function showEmpty(el, msg, cta) {
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)"><div style="font-size:40px;margin-bottom:12px;opacity:0.5">📋</div><div style="font-size:15px;margin-bottom:16px">' + (msg || 'Nenhum dado encontrado') + '</div>' + (cta || '') + '</div>';
}

function showError(el, msg) {
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--vermelho)"><div style="font-size:32px;margin-bottom:12px">⚠️</div><div>' + (msg || 'Erro ao carregar') + '</div></div>';
}
