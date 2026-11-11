import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { reloadOnce } from './lib/reloadOnce';
import { installInputGuards } from './lib/inputs';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

installInputGuards();
window.addEventListener('vite:preloadError', e => { if (reloadOnce()) e.preventDefault(); });
