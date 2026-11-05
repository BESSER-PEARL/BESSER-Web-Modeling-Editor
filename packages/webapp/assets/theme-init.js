// Apply the saved theme before first paint (index.tsx re-applies it with the full palette).
// A file of its own because the Content-Security-Policy allows no inline script.
try {
  var dark = localStorage.getItem('besser_userThemePreference') === 'dark';
  var root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.classList.toggle('dark', dark);
  if (dark) document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0d1017');
} catch (e) {}
