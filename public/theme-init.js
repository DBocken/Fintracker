// No-Flash-Theme-Initialisierung. Ausgelagert aus index.html, damit die
// Content-Security-Policy ohne `script-src 'unsafe-inline'` auskommt (Issue #32).
try {
  const saved = localStorage.getItem('color-scheme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
} catch (e) {
  // ignore
}
