// What each restaurant design shows and supports, kept apart from the design files (they are never edited). The self-check in ../kitTemplates.ts compares this
// with each design's own HTML, so a wrong entry fails a test instead of misleading an editor. `premium` is read by the plan gate (a later phase).
export interface DesignInfo { name: string; uses: string[]; orders: boolean; premium: boolean }
const d = (name: string, uses: string[], orders = true): DesignInfo => ({ name, uses, orders, premium: false });
export const DESIGN_INFO: Record<string, DesignInfo> = {
  'showcase-1': d('Café Lagoon Home List', ['name', 'tagline', 'description', 'price', 'image']),
  'showcase-2': d('Café Lagoon Dark Grid', ['name', 'tagline', 'price', 'image']),
  'showcase-3': d('Café Lagoon Refresh', ['name', 'tagline', 'price', 'image']),
  'showcase-4': d('Café Lagoon Side Rail', ['name', 'description', 'price', 'image']),
  'showcase-5': d('Café Lagoon Product Detail', ['description', 'price', 'image']),
  'showcase-6': d('Café Lagoon Food & Desserts', ['name', 'price', 'image']),
  'showcase-7': d('Café Lagoon Table Order', ['name', 'price', 'image']),
  'showcase-8': d('Café Lagoon Snacks & Checkout', ['description', 'price', 'image']),
  'classic-1': d('Café Lagoon List', ['name', 'tagline', 'description', 'price', 'image']),
  'classic-2': d('Café Lagoon Grid', ['name', 'price', 'image']),
  'boba-1': d('Bubble Tea: Home menu', ['name', 'price', 'image']),
  'boba-2': d('Bubble Tea: Drink detail', ['description', 'price', 'image']),
  'plate-1': d('Healthy Plate: Popular dishes', ['name', 'tagline', 'description', 'price', 'image'], false), // no cart hooks in this design, so guests cannot order from it
  'plate-2': d('Healthy Plate: Dish details', ['description', 'price', 'image']),
  // The first Kit page look (a coloured header, an offer, link buttons and Wi-Fi). It has no menu, so it takes no orders.
  original: d('Original', ['name', 'tagline', 'offer', 'buttons', 'wifi'], false),
};
