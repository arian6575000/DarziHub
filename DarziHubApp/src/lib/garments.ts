import { FIELDS, LIST, GarmentDef, GarmentGroup } from './garmentData';
import type { Lang } from './i18n';
export { LIST };
export type { GarmentDef, GarmentGroup };

export const byKey: Record<string, GarmentDef> = Object.fromEntries(LIST.map((g) => [g.key, g]));
export const garmentName = (key: string, lang: Lang) => { const g = byKey[key]; return g ? (lang === 'ur' ? g.ur : g.en) : key; };
export const fieldLabel = (f: string, lang: Lang) => (FIELDS[f] ? FIELDS[f][lang === 'ur' ? 1 : 0] : f);
// The shop type (Settings) wins over the customer's type: a gents-only shop never sees ladies garments.
let shopType: string = 'both';
export const setShopType = (t?: string) => { shopType = t === 'gents' || t === 'ladies' ? t : 'both'; };
export const groupsFor = (gender?: string): GarmentGroup[] => {
  const g = shopType !== 'both' ? shopType : gender;
  return g === 'gents' ? ['gents', 'other'] : g === 'ladies' ? ['ladies', 'other'] : ['gents', 'ladies', 'other'];
};
/** Garments visible for this shop (and optionally this customer). */
export const visibleGarments = (gender?: string) => { const gs = groupsFor(gender); return LIST.filter((x) => gs.includes(x.group)); };
export const itemsSummary = (items: { qty?: number; garment: string }[], lang: Lang) =>
  (items || []).map((i) => `${i.qty || 1}× ${garmentName(i.garment, lang)}`).join(', ');
