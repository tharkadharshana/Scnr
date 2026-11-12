import { Link } from 'react-router-dom';

/** The three places of a restaurant (page) QR: its scan analytics, its menu and look, and its orders. Shown at the top of each. */
export default function QrTabs({ slug, active, editTo }: { slug: string; active: 'analytics' | 'menu' | 'orders'; editTo?: string }) {
  const tab = (id: typeof active, to: string, label: string) => active === id
    ? <span aria-current="page" className="on">{label}</span>
    : <Link to={to}>{label}</Link>;
  return (
    <nav className="fb-tabs qr-tabs" aria-label="This restaurant">
      {tab('analytics', `/analytics/${slug}`, '▥ Analytics')}
      {tab('menu', editTo || `/pages/${slug}/edit`, '✎ Menu & kit')}
      {tab('orders', `/analytics/${slug}/orders`, '🧾 Orders')}
    </nav>
  );
}
