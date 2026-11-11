// Registry of Kit designs (one file per screen).
import showcase_1 from './showcase-1.js';
import showcase_2 from './showcase-2.js';
import showcase_3 from './showcase-3.js';
import showcase_4 from './showcase-4.js';
import showcase_5 from './showcase-5.js';
import showcase_6 from './showcase-6.js';
import showcase_7 from './showcase-7.js';
import showcase_8 from './showcase-8.js';
import classic_1 from './classic-1.js';
import classic_2 from './classic-2.js';
import boba_1 from './boba-1.js';
import boba_2 from './boba-2.js';
import plate_1 from './plate-1.js';
import plate_2 from './plate-2.js';
import { finishDesign, type Design } from '../designs.js';

const ALL: Record<string, Design> = { 'showcase-1': showcase_1, 'showcase-2': showcase_2, 'showcase-3': showcase_3, 'showcase-4': showcase_4, 'showcase-5': showcase_5, 'showcase-6': showcase_6, 'showcase-7': showcase_7, 'showcase-8': showcase_8, 'classic-1': classic_1, 'classic-2': classic_2, 'boba-1': boba_1, 'boba-2': boba_2, 'plate-1': plate_1, 'plate-2': plate_2 };

export const DESIGNS: Record<string, Design> = Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, finishDesign(v)]));
