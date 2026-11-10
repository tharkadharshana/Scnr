import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// After a deploy an open tab may ask for a chunk that no longer exists: reload to pick up the new build. At most once per 10 s, and never when storage is unreadable, so a chunk that stays unreachable (offline) cannot cause a reload loop.
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem('scnr_reloaded') || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('scnr_reloaded', String(Date.now()));
  } catch { return; }
  window.location.reload();
});
