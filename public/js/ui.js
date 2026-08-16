function injectTabBar() {
  const path = window.location.pathname;
  const tabs = [
    { label: 'Dashboard', icon: '🏠', href: '/dashboard' },
    { label: 'Fechamento', icon: '📊', href: '/fechamento' },
    { label: 'Churrasco', icon: '🥩', href: '/churrasco' },
    { label: 'Lançamentos', icon: '📋', href: '/lancamentos' },
    { label: 'A Pagar', icon: '📅', href: '/contas-a-pagar' },
  ];

  let html = '<nav class="tab-bar" style="position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);display:flex;justify-content:space-around;padding:8px 0 max(8px,env(safe-area-inset-bottom));z-index:100">';
  tabs.forEach(t => {
    const active = path === t.href || (t.href !== '/' && path.startsWith(t.href));
    html += '<a href="' + t.href + '" class="tab-item" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0;text-decoration:none;' + (active ? 'color:var(--accent);' : 'color:var(--muted);') + 'font-size:10px;font-weight:510">' +
      '<div class="tab-icon" style="font-size:20px">' + t.icon + '</div><span>' + t.label + '</span></a>';
  });
  html += '</nav>';
  document.body.insertAdjacentHTML('beforeend', html);
}
