(function () {
  // Dark is the default theme; keep in sync with DEFAULT_THEME in src/lib/theme.ts.
  var t = localStorage.getItem('theme') || 'dark'
  if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
})()
