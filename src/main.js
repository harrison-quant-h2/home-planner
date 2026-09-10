import './style.css';
try {
  await import('./app.js');
} catch (error) {
  console.error(error);
  const loading = document.getElementById('loading');
  loading.hidden = false;
  loading.textContent =
    'The planner could not start. Check that WebGL is available, then reload. Your saved browser checkpoint is retained.';
}
