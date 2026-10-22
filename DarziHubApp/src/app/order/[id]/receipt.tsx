import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Loading, Muted, Row, Screen, Segmented } from '../../../ui/kit';
import { useApp } from '../../../ctx/AppContext';
import { Repo } from '../../../db/repo';
import type { Customer, Order, Payment } from '../../../db/types';
import { calcOrder } from '../../../lib/calc';
import { Fmt } from '../../../lib/format';
import { garmentName } from '../../../lib/garments';
import { Lang } from '../../../lib/i18n';
import { openWhatsApp } from '../../../lib/messages';
import { photoIO } from '../../../lib/photos';
import { PAPER_PX, ReceiptFmt, ReceiptView, buildReceiptHtml } from '../../../lib/receiptHtml';

let fontCache: string | null = null;
async function loadUrduFont(): Promise<string | null> {
  if (fontCache) return fontCache;
  try {
    const asset = Asset.fromModule(require('@expo-google-fonts/noto-nastaliq-urdu/400Regular/NotoNastaliqUrdu_400Regular.ttf'));
    await asset.downloadAsync();
    if (!asset.localUri) return null;
    fontCache = await new File(asset.localUri).base64();
    return fontCache;
  } catch { return null; }
}

export default function ReceiptScreen() {
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const { t, lang: appLang, settings, toast } = useApp();
  const [data, setData] = useState<{ order: Order; customer: Customer | null; payments: Payment[]; photos: string[] } | null>(null);
  const [view, setView] = useState<ReceiptView>((['slip', 'tag', 'fabric'].includes(String(viewParam)) ? viewParam : 'receipt') as ReceiptView);
  const [fmt, setFmt] = useState<ReceiptFmt>(settings.receiptFormat || 'thermal80');
  const [lang, setLang] = useState<Lang>(appLang);
  const [font, setFont] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const order = await Repo.getOrder(Number(id));
      if (!order) { router.back(); return; }
      const [customer, payments] = await Promise.all([Repo.getCustomer(order.customerId), Repo.listPaymentsForOrder(order.id)]);
      const photos: string[] = [];
      for (const p of order.photos.slice(0, 4)) { const u = await photoIO.toDataUrl(p); if (u) photos.push(u); }
      setData({ order, customer, payments, photos });
    })();
  }, [id]);
  useEffect(() => { if (lang === 'ur') loadUrduFont().then(setFont); }, [lang]);

  const build = (mode: 'preview' | 'print') => data ? buildReceiptHtml(
    { order: data.order, customer: data.customer, payments: data.payments, settings, photoDataUrls: data.photos },
    { view, fmt, lang, mode, fontBase64: lang === 'ur' ? font : null }) : '';
  const previewHtml = useMemo(() => build('preview'), [data, view, fmt, lang, font, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const print = async () => {
    setBusy(true);
    try { await Print.printAsync({ html: build('print'), ...(fmt === 'a4' ? {} : { width: Math.round(PAPER_PX[fmt] * 0.75) + 20 }) }); }
    catch (e: any) { if (!String(e?.message || e).toLowerCase().includes('cancel')) toast(t('printFailed'), 'error'); }
    finally { setBusy(false); }
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const size = fmt === 'a4' ? { width: 595, height: 842 } : { width: Math.round(PAPER_PX[fmt] * 0.75) + 20, height: 800 };
      const { uri } = await Print.printToFileAsync({ html: build('print'), ...size });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: data?.order.orderNumber, UTI: 'com.adobe.pdf' });
      else toast(t('shareFailed'), 'error');
    } catch { toast(t('shareFailed'), 'error'); }
    finally { setBusy(false); }
  };
  const whatsapp = async () => {
    if (!data) return;
    const { order: o, customer: c, payments } = data;
    const calc = calcOrder(o); const paid = payments.reduce((a, p) => a + p.amount, 0);
    const L = (k: string) => t(k, lang);
    const shop = lang === 'ur' ? settings.shopNameUr || settings.shopName : settings.shopName || settings.shopNameUr;
    const text = [
      `*${shop}*`, `${L('orderNo')}: ${o.orderNumber}`, `${L('customer')}: ${c ? c.name : ''}`, '',
      ...o.items.map((i) => `• ${garmentName(i.garment, lang)} × ${i.qty} — ${Fmt.money(i.qty * i.rate + (i.fabricAmount || 0))}`), '',
      calc.discount ? `${L('discount')}: ${Fmt.money(calc.discount)}` : null,
      `${L('total')}: ${Fmt.money(calc.total)}`, `${L('paid')}: ${Fmt.money(paid)}`, `*${L('balance')}: ${Fmt.money(calc.total - paid)}*`,
      o.deliveryDate ? `${L('deliveryDate')}: ${Fmt.date(o.deliveryDate, lang)}` : null, '', lang === 'ur' ? settings.footerUr : settings.footerEn,
    ].filter((x) => x !== null).join('\n');
    if (!(await openWhatsApp(c?.phone, text, settings.countryCode))) toast(c?.phone ? t('whatsappFail') : t('noPhone'), 'error');
  };

  const titles: Record<ReceiptView, string> = { receipt: t('receipt'), slip: t('measureSlip'), tag: t('tagView'), fabric: t('fabricSlip') };
  return (
    <Screen back title={titles[view]} scroll={false}>
      <View style={{ gap: 8, marginBottom: 10 }}>
        <Segmented value={view} onChange={setView} items={[['receipt', t('receipt')], ['slip', t('slipShort')], ['tag', t('tagView')], ['fabric', t('fabricShort')]]} />
        <Segmented value={fmt} onChange={setFmt} items={[['thermal80', t('thermal80')], ['thermal58', t('thermal58')], ['a4', 'A4']]} />
        <Segmented value={lang} onChange={setLang} items={[['ur', 'اردو'], ['en', 'English']]} />
      </View>
      <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eef1f8' }}>
        {data ? <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ backgroundColor: 'transparent' }} /> : <Loading />}
      </View>
      <Row style={{ marginTop: 10 }}>
        <Button block icon="print" label={t('print')} onPress={print} loading={busy} disabled={!data} />
        <Button block variant="ghost" icon="document" label="PDF" onPress={pdf} disabled={!data || busy} />
        <Button block variant="ghost" icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} disabled={!data} />
      </Row>
      <Muted style={{ marginTop: 6 }}>{t('pdfHint')}</Muted>
    </Screen>
  );
}
