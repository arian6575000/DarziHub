import { FIELDS, LIST, GarmentDef, GarmentGroup } from './garmentData';
import type { Lang } from './i18n';
export { LIST };
export type { GarmentDef, GarmentGroup };

export const byKey: Record<string, GarmentDef> = Object.fromEntries(LIST.map((g) => [g.key, g]));
export const garmentName = (key: string, lang: Lang) => { const g = byKey[key]; return g ? (lang === 'ur' ? g.ur : g.en) : key; };
export const fieldLabel = (f: string, lang: Lang) => (FIELDS[f] ? FIELDS[f][lang === 'ur' ? 1 : 0] : f);
export const groupsFor = (gender?: string): GarmentGroup[] =>
  gender === 'gents' ? ['gents', 'other'] : gender === 'ladies' ? ['ladies', 'other'] : ['gents', 'ladies', 'other'];
export const itemsSummary = (items: { qty?: number; garment: string }[], lang: Lang) =>
  (items || []).map((i) => `${i.qty || 1}× ${garmentName(i.garment, lang)}`).join(', ');
