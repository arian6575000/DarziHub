import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Badge, Button, Card, IconButton, KV, ListItem, Loading, Muted, Row, Screen, SectionLabel, Sheet, T } from '../../../ui/kit';
import { MessageSheet, PaymentSheet } from '../../../ui/sheets';
import { useApp } from '../../../ctx/AppContext';
import { Repo } from '../../../db/repo';
import { FLOW, Status } from '../../../db/types';
import { calcOrder, itemAmount } from '../../../lib/calc';
import { Fmt } from '../../../lib/format';
import { garmentName } from '../../../lib/garments';
import { useLoad } from '../../../lib/hooks';
import { buildMessage, openWhatsApp } from '../../../lib/messages';
import { deletePhotoFiles, photoUri } from '../../../lib/photos';
import { C, STATUS_COLORS } from '../../../lib/theme';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const oid = Number(id);
  const { t, lang, settings, toast, confirm, refreshReminders } = useApp();
  const [menu, setMenu] = useState(false);
  const [pay, setPay] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ready' | 'due'; text: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const [d, reload] = useLoad(async () => {
    const o = await Repo.getOrder(oid);
    if (!o) return null;
    const [c, pays] = await Promise.all([Repo.getCustomer(o.customerId), Repo.listPaymentsForOrder(oid)]);
    return { o, c, pays };
  }, [oid]);

  if (!d) return <Screen back title=" "><Loading /></Screen>;
  const { o, c, pays } = d;
  const calc = calcOrder(o);
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  const balance = calc.total - paid;

  const offer = (kind: 'ready' | 'due') => {
    if (!c || !c.phone) return;
    setMsg({ kind, text: buildMessage(kind, settings, c, o, balance, lang) });
  };
  const setStatus = async (s: Status) => {
    await Repo.setOrderStatus(oid, s);
    refreshReminders();
    if (s === 'delivered' && balance > 0) toast(`${t('balanceDue')}: ${Fmt.money(balance)}`);
    await reload();
    if (s === 'ready') offer('ready');
  };
  const cancel = async () => { setMenu(false); await Repo.setOrderStatus(oid, 'cancelled'); refreshReminders(); reload(); };
  const remove = async () => {
    setMenu(false);
    if (!(await confirm(t('deleteOrderMsg'), { danger: true, okLabel: t('delete') }))) return;
    deletePhotoFiles(await Repo.deleteOrder(oid)); refreshReminders(); toast(t('deleted'), 'success'); router.back();
  };
  const delPay = async (pid: number) => {
    if (!(await confirm(t('deletePaymentMsg'), { danger: true, okLabel: t('delete') }))) return;
    await Repo.deletePayment(pid); toast(t('deleted'), 'success'); reload();
  };
  const openReceipt = (view?: string) => router.push({ pathname: '/order/[id]/receipt', params: { id: String(oid), ...(view ? { view } : {}) } });

  return (
    <Screen back title={o.orderNumber} onRefresh={reload} right={<IconButton icon="ellipsis-horizontal" onPress={() => setMenu(true)} />}>
      <Card onPress={() => router.push(`/customer/${o.customerId}`)}>
        <Row gap={14}>
          <Avatar text={Fmt.initials(c?.name)} size={56} />
          <View style={{ flex: 1 }}>
            <T bold size={19}>{c?.name || '—'}</T>
            <Muted>{c?.phone || ''}</Muted>
            <View style={{ marginTop: 6 }}><Badge status={o.status} label={t('st_' + o.status)} /></View>
          </View>
        </Row>
      </Card>

      <Card>
        <KV k={t('orderDate')} v={Fmt.date(o.orderDate, lang)} />
        <KV k={t('deliveryDate')} v={o.deliveryDate ? Fmt.date(o.deliveryDate, lang) : '—'} />
        {o.trialDate ? <KV k={t('trialDate')} v={Fmt.date(o.trialDate, lang)} /> : null}
        {o.urgent ? <KV k={t('urgent')} v={<Ionicons name="flame" size={18} color={C.danger} />} /> : null}
        {o.deliveredAt ? <KV k={t('deliveredOn')} v={Fmt.date(o.deliveredAt, lang)} /> : null}
      </Card>

      <SectionLabel>{t('status')}</SectionLabel>
      <Card>
        <Row wrap gap={8}>
          {FLOW.map((s) => {
            const on = o.status === s; const col = STATUS_COLORS[s];
            return (
              <Pressable key={s} onPress={() => setStatus(s)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: on ? col.fg : col.bg }}>
                <T bold size={13} color={on ? '#fff' : col.fg}>{t('st_' + s)}</T>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <SectionLabel>{t('items')}</SectionLabel>
      <Card flush>
        {o.items.map((i, k) => (
          <ListItem key={k} last={k === o.items.length - 1}
            title={`${i.qty}× ${garmentName(i.garment, lang)}`}
            sub={`${t('stitchRate')}: ${Fmt.money(i.rate)}${i.fabricAmount ? ` · ${t('fabricAmount')}: ${Fmt.money(i.fabricAmount)}` : ''}`}
            sub2={i.notes ? <T size={13} color={C.soft}>{i.notes}</T> : undefined}
            trail={<T bold size={14}>{Fmt.money(itemAmount(i))}</T>} />
        ))}
      </Card>

      <Card>
        <TotalRow k={t('subtotal')} v={Fmt.money(calc.subtotal)} />
        {calc.discount ? <TotalRow k={t('discount')} v={`- ${Fmt.money(calc.discount)}`} /> : null}
        <TotalRow k={t('total')} v={Fmt.money(calc.total)} grand />
        <TotalRow k={t('paid')} v={Fmt.money(paid)} color={C.success} />
        <TotalRow k={t('balance')} v={Fmt.money(balance)} color={balance > 0 ? C.danger : C.success} bold />
      </Card>

      <SectionLabel right={<Button small icon="add" label={t('receivePayment')} onPress={() => setPay(true)} />}>{t('payments')}</SectionLabel>
      <Card flush>
        {pays.length ? pays.map((p, i) => (
          <ListItem key={p.id} last={i === pays.length - 1} onPress={() => delPay(p.id)}
            title={<T bold size={15} color={C.success}>{Fmt.money(p.amount)}</T>}
            sub={`${Fmt.date(p.date, lang, true)}${p.method === 'online' ? ' · ' + (lang === 'ur' ? 'آن لائن' : 'Online') : ''}${p.note ? ' · ' + (p.note === 'advance' ? t('advance') : p.note) : ''}`} />
        )) : <Muted style={{ paddingVertical: 18 }}>{t('noPayments')}</Muted>}
      </Card>

      {o.fabricReceived || o.fabricMeters ? <Card><KV k={t('customerFabric')} v={`${o.fabricReceived || '—'}${o.fabricMeters ? ` · ${o.fabricMeters} ${t('u_meter')}` : ''}`} /></Card> : null}
      {o.photos.length ? (
        <>
          <SectionLabel>{t('photos')}</SectionLabel>
          <Row wrap gap={8} style={{ marginBottom: 12 }}>
            {o.photos.map((p) => <Pressable key={p} onPress={() => setPhoto(p)}><Image source={{ uri: photoUri(p) }} style={{ width: 96, height: 96, borderRadius: 14 }} /></Pressable>)}
          </Row>
        </>
      ) : null}
      {o.notes ? <Card><KV k={t('orderNotes')} v={o.notes} /></Card> : null}

      <Row style={{ marginTop: 6 }}>
        <Button block icon="print" label={t('receiptPrint')} onPress={() => openReceipt()} />
        <Button block variant="ghost" icon="resize" label={t('measureSlip')} onPress={() => openReceipt('slip')} />
      </Row>
      <Row style={{ marginTop: 10 }}>
        <Button block variant="ghost" icon="pricetag" label={t('tagView')} onPress={() => openReceipt('tag')} />
        <Button block variant="ghost" icon="shirt" label={t('fabricSlip')} onPress={() => openReceipt('fabric')} />
      </Row>
      {c && c.phone ? <Button style={{ marginTop: 10 }} variant="ghost" icon="logo-whatsapp" label={t(o.status === 'ready' ? 'sendReadyMsg' : 'sendDueMsg')} onPress={() => offer(o.status === 'ready' ? 'ready' : 'due')} /> : null}

      <PaymentSheet visible={pay} onClose={() => setPay(false)} customerId={o.customerId} orderId={oid} onSaved={reload} />
      <MessageSheet visible={!!msg} title={msg ? t(msg.kind === 'ready' ? 'sendReadyMsg' : 'sendDueMsg') : ''} text={msg?.text || ''} onSkip={() => setMsg(null)}
        onSend={async () => { const text = msg?.text || ''; setMsg(null); if (!(await openWhatsApp(c?.phone, text, settings.countryCode))) toast(t('whatsappFail'), 'error'); }} />
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <Button variant="ghost" icon="pencil" label={t('editOrder')} style={{ marginBottom: 10 }} onPress={() => { setMenu(false); router.push({ pathname: '/order/form', params: { id: String(oid) } }); }} />
        <Button variant="ghost" icon="ban" label={t('cancelOrder')} style={{ marginBottom: 10 }} onPress={cancel} />
        <Button variant="danger" icon="trash" label={t('deleteOrder')} onPress={remove} />
      </Sheet>
      <Sheet visible={!!photo} onClose={() => setPhoto(null)}>
        {photo ? <Image source={{ uri: photoUri(photo) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }} resizeMode="contain" /> : null}
      </Sheet>
    </Screen>
  );
}

function TotalRow({ k, v, grand, color, bold }: { k: string; v: string; grand?: boolean; color?: string; bold?: boolean }) {
  return <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}><T size={grand ? 16 : 14} bold={grand} color={grand ? C.ink : C.soft}>{k}</T><T size={grand ? 18 : 14} bold={grand || bold} color={color}>{v}</T></Row>;
}
