async function askIA(texto) {
  if (!texto || !texto.trim()) return null;
  try {
    const data = await apiPost('/api/ia/texto', { texto: texto.trim() });
    return data;
  } catch (e) {
    console.error('IA error:', e);
    return { erro: 'Erro ao processar IA: ' + e.message };
  }
}

function debounceIA(fn, ms = 1000) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
