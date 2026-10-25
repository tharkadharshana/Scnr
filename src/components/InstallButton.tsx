import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useUI } from '../shared/UIContext';

const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** "Install app" menu item. Chrome and Edge offer a real prompt; Safari on iPhone has none, so it gets the Add to Home Screen steps. Hidden once installed. */
export default function InstallButton() {
  const { showToast } = useUI();
  const [evt, setEvt] = useState<any>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', () => setEvt(null));
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (standalone() || (!evt && !ios())) return null;
  const install = async () => {
    if (!evt) return showToast('success', 'Tap the Share button, then "Add to Home Screen".');
    evt.prompt();
    await evt.userChoice.catch(() => null);
    setEvt(null);
  };
  return (
    <div className="nav-item" role="button" tabIndex={0} onClick={install} onKeyDown={e => { if (e.key === 'Enter') install(); }}>
      <Download className="nav-icon" size={16} aria-hidden="true" />
      Install app
    </div>
  );
}
