// Receipt / measurement slip / garment tags / fabric slip as HTML (preview in WebView, print, PDF).
import type { Customer, Order, Payment, Settings } from '../db/types';
import { calcOrder, itemAmount } from './calc';
import { Fmt } from './format';
import { byKey, fieldLabel, garmentName } from './garments';
import { Lang, translate } from './i18n';

export type ReceiptView = 'receipt' | 'slip' | 'tag' | 'fabric';
export type ReceiptFmt = 'thermal80' | 'thermal58' | 'a4';

export interface ReceiptCtx {
  order: Order; customer: Customer | null; payments: Payment[]; settings: Settings;
  photoDataUrls: string[]; // up to 4, for the slip
}
export interface ReceiptOpts { view: ReceiptView; fmt: ReceiptFmt; lang: Lang; mode: 'preview' | 'print'; fontBase64?: string | null }

export const PAPER_PX: Record<ReceiptFmt, number> = { thermal80: 302, thermal58: 210, a4: 794 };

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildReceiptHtml(ctx: ReceiptCtx, o: ReceiptOpts): string {
  const { lang } = o;
  const T = (k: string) => translate(k, lang);
  const { order, customer: c, settings: s } = ctx;
  const shop = lang === 'ur' ? (s.shopNameUr || s.shopName) : (s.shopName || s.shopNameUr);
  const date = (d: string, short = true) => Fmt.date(d, lang, short);

  const header = () => `${s.logo ? `<img class="logo" src="${s.logo}">` : ''}<h2>${esc(shop)}</h2>
    <div class="c muted">${esc([s.phone, s.address].filter(Boolean).join(' · '))}</div><hr>`;
  const meta = () => `<table>
    <tr><td>${T('orderNo')}</td><td class="num"><b>${esc(order.orderNumber)}</b></td></tr>
    <tr><td>${T('orderDate')}</td><td class="num">${date(order.orderDate)}</td></tr>
    <tr><td>${T('customer')}</td><td class="num">${esc(c ? c.name : '—')}</td></tr>
    ${c && c.phone ? `<tr><td>${T('phone')}</td><td class="num" dir="ltr">${esc(c.phone)}</td></tr>` : ''}
    <tr><td>${T('deliveryDate')}</td><td class="num"><b>${order.deliveryDate ? date(order.deliveryDate) : '—'}</b></td></tr></table><hr>`;

  const receipt = () => {
    const calc = calcOrder(order);
    const paid = ctx.payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const rows = order.items.map((i) => ({ n: garmentName(i.garment, lang), q: i.qty, note: i.notes, amt: itemAmount(i) }));
    const items = o.fmt === 'a4'
      ? `<table class="grid"><tr><th>${T('item')}</th><th class="num">${T('qty')}</th><th class="num">${T('amount')}</th></tr>
         ${rows.map((r) => `<tr><td>${esc(r.n)}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}</td><td class="num">${r.q}</td><td class="num">${Fmt.money(r.amt)}</td></tr>`).join('')}</table>`
      : `<table>${rows.map((r) => `<tr><td>${esc(r.n)} × ${r.q}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}</td><td class="num">${Fmt.money(r.amt)}</td></tr>`).join('')}</table>`;
    return `${header()}${meta()}${items}<hr><table>
      <tr><td>${T('subtotal')}</td><td class="num">${Fmt.money(calc.subtotal)}</td></tr>
      ${calc.discount ? `<tr><td>${T('discount')}</td><td class="num">- ${Fmt.money(calc.discount)}</td></tr>` : ''}
      <tr class="tot"><td>${T('total')}</td><td class="num">${Fmt.money(calc.total)}</td></tr>
      <tr><td>${T('paid')}</td><td class="num">${Fmt.money(paid)}</td></tr>
      <tr class="tot"><td>${T('balance')}</td><td class="num">${Fmt.money(calc.total - paid)}</td></tr></table><hr>
      <div class="c muted">${esc(lang === 'ur' ? s.footerUr : s.footerEn)}</div>`;
  };

  const slip = () => {
    const snap = order.measurements || {}, live = (c && c.measurements) || {};
    const blocks = order.items.map((i) => {
      const m = snap[i.garment] || live[i.garment]; const g = byKey[i.garment];
      return `<div style="margin-bottom:8px;"><b>${i.qty}× ${esc(garmentName(i.garment, lang))}</b>${i.notes ? ` <span class="muted">— ${esc(i.notes)}</span>` : ''}
        ${m && g ? `<div class="m-line">${g.fields.filter((f) => m.values[f] !== undefined && m.values[f] !== '').map((f) =>
          `<span>${esc(fieldLabel(f, lang))}: <b>${esc(m.values[f])}</b></span>`).join('')}</div>${m.style ? `<div class="muted">${esc(m.style)}</div>` : ''}`
          : `<div class="muted">${T('noMeasurementYet')}</div>`}<hr></div>`;
    }).join('');
    return `<h2>${T('measureSlip')}</h2><div class="c muted">${esc(shop)}</div><hr>${meta()}${blocks}
      ${order.notes ? `<div><b>${T('orderNotes')}:</b> ${esc(order.notes)}</div>` : ''}
      ${ctx.photoDataUrls.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${ctx.photoDataUrls.slice(0, 4).map((p) => `<img src="${p}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;">`).join('')}</div>` : ''}`;
  };

  const tags = () => {
    const out: string[] = [];
    order.items.forEach((i) => {
      for (let k = 1; k <= (Number(i.qty) || 1); k++) {
        out.push(`<div style="page-break-inside:avoid;border:1px dashed #777;padding:6px 8px;margin-bottom:8px;border-radius:6px;">
          <div><b>${esc(order.orderNumber)}</b>${order.urgent ? ' 🔥' : ''}</div><div>${esc(c ? c.name : '—')}</div>
          <div>${esc(garmentName(i.garment, lang))} (${k}/${i.qty})</div>
          <div class="muted">${T('deliveryDate')}: <b>${order.deliveryDate ? date(order.deliveryDate) : '—'}</b></div></div>`);
      }
    });
    return out.join('');
  };

  const fabric = () => `${header()}<div class="c"><b>${T('fabricSlip')}</b></div><hr>${meta()}
    ${order.fabricReceived || order.fabricMeters ? `<table>
      <tr><td>${T('customerFabric')}</td><td class="num">${esc(order.fabricReceived || '—')}</td></tr>
      <tr><td>${T('fabricMeters')}</td><td class="num"><b>${order.fabricMeters || '—'}</b></td></tr></table>` : `<div class="muted">${T('noFabric')}</div>`}
    <hr><div class="muted">${T('signature')}: ____________</div>`;

  const body = { receipt, slip, tag: tags, fabric }[o.view]();
  const W = PAPER_PX[o.fmt];
  const print = o.mode === 'print';
  const font = o.fontBase64 ? `@font-face{font-family:'NastaliqEmbedded';src:url(data:font/ttf;base64,${o.fontBase64}) format('truetype');}` : '';
  const family = lang === 'ur' ? `'NastaliqEmbedded','Noto Nastaliq Urdu',serif` : `-apple-system,Roboto,Helvetica,Arial,sans-serif`;
  const base = o.fmt === 'a4' ? 14 : o.fmt === 'thermal58' ? 12 : 13;
  return `<!doctype html><html lang="${lang}" dir="${lang === 'ur' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=${print ? 'device-width' : W + 28}, initial-scale=1">
<style>${font}
*{box-sizing:border-box}
body{margin:0;background:${print ? '#fff' : '#eef1f8'};padding:${print ? '0' : '14px'};font-family:${family};}
.paper{background:#fff;color:#000;margin:0 auto;padding:${o.fmt === 'a4' ? '28px' : '14px'};border-radius:${print ? '0' : '8px'};
  ${print ? '' : 'box-shadow:0 8px 30px rgba(31,40,80,.15);'}width:${print ? '100%' : W + 'px'};font-size:${base}px;line-height:${lang === 'ur' ? 2 : 1.6};}
.paper h2{font-size:17px;text-align:center;margin:0 0 2px}.c{text-align:center}.muted{color:#555;font-size:.9em}
hr{border:none;border-top:1px dashed #777;margin:8px 0}table{width:100%;border-collapse:collapse}
td,th{padding:3px 0;vertical-align:top;text-align:start}td.num,th.num{text-align:end;white-space:nowrap}
table.grid th,table.grid td{border:1px solid #bbb;padding:6px 8px}table.grid th{background:#f2f4fa}
.logo{display:block;margin:0 auto 4px;max-height:54px;max-width:120px;object-fit:contain}
.tot td{font-weight:700}.m-line{display:flex;flex-wrap:wrap;gap:2px 14px}
</style></head><body><div class="paper">${body}</div></body></html>`;
}
