import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { reloadOnce } from './lib/reloadOnce';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

window.addEventListener('vite:preloadError', e => { if (reloadOnce()) e.preventDefault(); });
