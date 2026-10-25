import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Plus, BarChart3, Menu, WifiOff } from 'lucide-react';

/** Phone navigation: the five places people go most, with the drawer behind "Menu". Hidden on desktop (CSS) and on editors that draw their own bar. */
export default function BottomNav({ onMenu }: { onMenu: () => void }) {
  const link = (to: string, Icon: typeof Menu, label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `bn-item${isActive ? ' on' : ''}`}><Icon size={22} aria-hidden="true" /><span>{label}</span></NavLink>
  );
  return (
    <nav className="bottom-nav" aria-label="Main">
      {link('/', LayoutDashboard, 'Home', true)}
      {link('/pages', FileText, 'Pages')}
      <NavLink to="/create" className="bn-create" aria-label="Create QR"><Plus size={26} aria-hidden="true" /></NavLink>
      {link('/analytics', BarChart3, 'Stats')}
      <button type="button" className="bn-item" onClick={onMenu}><Menu size={22} aria-hidden="true" /><span>Menu</span></button>
    </nav>
  );
}

/** The app shell works offline; the data does not. Say so instead of showing silent errors. */
export function OfflineBar() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online ? null : <div className="offline-bar" role="status"><WifiOff size={14} aria-hidden="true" /> You're offline. Showing what was loaded last; changes need a connection.</div>;
}
