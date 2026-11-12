import { Link } from 'react-router-dom';

/** The three places of a restaurant (page) QR: its scan analytics, its menu and look, and its orders. Shown at the top of each. */
export default function QrTabs({ slug, active, editTo }: { slug: string; active: 'analytics' | 'menu' | 'orders'; editTo?: string }) {
  const tab = (id: typeof active, to: string, label: string) => active === id
    ? <span role="tab" aria-selected="true" className="on">{label}</span>
    : <Link role="tab" aria-selected="false" to={to}>{label}</Link>;
  return (
    <div className="fb-tabs qr-tabs" role="tablist">
      {tab('analytics', `/analytics/${slug}`, '▥ Analytics')}
      {tab('menu', editTo || `/pages/${slug}/edit`, '✎ Menu & kit')}
      {tab('orders', `/analytics/${slug}/orders`, '🧾 Orders')}
    </div>
  );
}
