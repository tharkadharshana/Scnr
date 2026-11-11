import type { Design } from '../designs.js';

// STUB: replaced by the real pixel-exact design (see docs/kit-designs.md).
const d: Design = { id: 'showcase-4', name: 'showcase-4', css: '', html: '<main><h1>{{name}}</h1>{{#allitems}}<p>{{item.name}} {{item.price}}</p>{{/#allitems}}</main>',
  sample: { name: 'Café Lagoon', tagline: 'Good Food. Good Vibes.', sections: [{ name: 'Coffee', items: [{ name: 'Cappuccino', price: '$4.50' }] }] } };
export default d;
