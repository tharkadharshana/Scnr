import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/** The three places of a restaurant (page) QR: its scan analytics, its menu and look, and its orders. One row at the very top of each, so it never moves between them. `children` sit beside it (an extra link). */
export default function QrTabs({ slug, active, editTo, children }: { slug: string; active: 'analytics' | 'menu' | 'orders'; editTo?: string; children?: ReactNode }) {
  const tab = (id: typeof active, to: string, label: string) => active === id
    ? <span aria-current="page" className="on">{label}</span>
    : <Link to={to}>{label}</Link>;
  return (
    <div className="qr-tabs-row no-print">
      <nav className="fb-tabs qr-tabs" aria-label="This restaurant">
        {tab('analytics', `/analytics/${slug}`, '▥ Analytics')}
        {tab('menu', editTo || `/pages/${slug}/edit`, '✎ Menu & kit')}
        {tab('orders', `/analytics/${slug}/orders`, '🧾 Orders')}
      </nav>
      {children}
    </div>
  );
}
