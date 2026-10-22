import { Linking } from 'react-native';
import type { Customer, Order, Settings } from '../db/types';
import type { Lang } from './i18n';
import { Fmt, waNumber } from './format';

const fill = (tpl: string, v: Record<string, string>) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

export function buildMessage(kind: 'ready' | 'due', s: Settings, c: Customer | null, o: Order | null, balance: number, lang: Lang) {
  const tpl = (s as any)[`${kind}Msg${lang === 'ur' ? 'Ur' : 'En'}`] as string;
  return fill(tpl, {
    name: c ? c.name : '', order: o ? o.orderNumber : '', balance: Fmt.money(balance),
    shop: lang === 'ur' ? (s.shopNameUr || s.shopName) : (s.shopName || s.shopNameUr),
  });
}

/** Opens WhatsApp with a prefilled message. Returns false if no number / can't open. */
export async function openWhatsApp(phone: string | undefined, text: string, cc: string): Promise<boolean> {
  const n = waNumber(phone, cc);
  if (!n) return false;
  const q = `text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(`whatsapp://send?phone=${n}&${q}`); return true; } catch { /* fall through */ }
  try { await Linking.openURL(`https://wa.me/${n}?${q}`); return true; } catch { return false; }
}
export const callPhone = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => {});
