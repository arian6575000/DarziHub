import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Badge, Button, Card, Grid, IconButton, KV, ListItem, Loading, Muted, Row, Screen, SectionLabel, Sheet, StatCard, T } from '../../ui/kit';
import { OrderRow } from '../../ui/OrderRow';
import { MessageSheet, PaymentSheet } from '../../ui/sheets';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { useLoad } from '../../lib/hooks';
import { Fmt, waNumber } from '../../lib/format';
import { LIST, garmentName, groupsFor } from '../../lib/garments';
import { buildMessage, callPhone, openWhatsApp } from '../../lib/messages';
import { C } from '../../lib/theme';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);
  const { t, lang, settings, toast, confirm } = useApp();
  const [menu, setMenu] = useState(false);
  const [pay, setPay] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [d, reload] = useLoad(async () => {
    const c = await Repo.getCustomer(cid);
    if (!c) return null;
    const [orders, sum, pays, members, head] = await Promise.all([
      Repo.listOrdersForCustomer(cid), Repo.customerSummary(cid), Repo.listPaymentsForCustomer(cid), Repo.listMembers(cid), c.headId ? Repo.getCustomer(c.headId) : Promise.resolve(null)]);
    return { c, orders, sum, pays, members, head };
  }, [cid]);

  if (!d) return <Screen back title={t('customer')}><Loading /></Screen>;
  const { c, orders, sum, pays, members, head } = d;
  const m = c.measurements || {};
  const wa = waNumber(c.phone, settings.countryCode);

  const remind = () => setMsg(buildMessage('due', settings, c, null, sum.balance, lang));
  const doDelete = async () => {
    setMenu(false);
    if (!(await confirm(t('deleteCustomerMsg'), { danger: true, okLabel: t('delete') }))) return;
    try { await Repo.deleteCustomer(cid); toast(t('deleted'), 'success'); router.back(); }
    catch (e: any) { toast(t(String(e.message)), 'error'); }
  };
  const delPay = async (pid: number) => {
    if (!(await confirm(t('deletePaymentMsg'), { danger: true, okLabel: t('delete') }))) return;
    await Repo.deletePayment(pid); toast(t('deleted'), 'success'); reload();
  };

  return (
    <Screen back title={t('customer')} onRefresh={reload} right={<IconButton icon="ellipsis-horizontal" onPress={() => setMenu(true)} />}>
      <Card>
        <Row gap={14}>
          <Avatar text={Fmt.initials(c.name)} size={56} />
          <View style={{ flex: 1 }}>
            <T bold size={19}>{c.name}</T>
            <Muted>{`${c.phone || t('noPhone')} · ${t(c.gender === 'gents' ? 'gents' : c.gender === 'ladies' ? 'ladies' : 'both')}`}</Muted>
            <Row style={{ marginTop: 8 }}>
              {c.phone ? <IconButton icon="call" color={C.primary} onPress={() => callPhone(c.phone)} /> : null}
              {wa ? <IconButton icon="logo-whatsapp" color={C.success} onPress={() => Linking.openURL(`https://wa.me/${wa}`).catch(() => toast(t('whatsappFail'), 'error'))} /> : null}
            </Row>
          </View>
        </Row>
      </Card>

      <Grid>
        <StatCard icon="cut" tone="blue" value={sum.orderCount} label={t('orders')} />
        <StatCard icon="wallet" tone={sum.balance > 0 ? 'orange' : 'green'} small value={Fmt.money(sum.balance)} label={t('balanceDue')} />
      </Grid>
      <Row style={{ marginTop: 6 }}>
        <Button block icon="add" label={t('newOrder')} onPress={() => router.push({ pathname: '/order/form', params: { customerId: String(cid) } })} />
        <Button block variant="ghost" icon="cash-outline" label={t('receivePayment')} onPress={() => setPay(true)} />
      </Row>
      {sum.balance > 0 && c.phone ? <Button style={{ marginTop: 10 }} variant="ghost" icon="logo-whatsapp" label={t('sendDueMsg')} onPress={remind} /> : null}

      <SectionLabel right={<Button small variant="ghost" icon="person-add" label={t('addMember')} onPress={() => router.push({ pathname: '/customer/form', params: { headId: String(head ? head.id : cid) } })} />}>{t('family')}</SectionLabel>
      <Card flush>
        {head ? <ListItem onPress={() => router.push(`/customer/${head.id}`)} left={<Avatar text={Fmt.initials(head.name)} />} title={head.name} sub={t('familyHead')} /> : null}
        {members.map((mm, i) => <ListItem key={mm.id} last={i === members.length - 1} onPress={() => router.push(`/customer/${mm.id}`)} left={<Avatar text={Fmt.initials(mm.name)} />} title={mm.name} />)}
        {!head && !members.length ? <Muted style={{ paddingVertical: 16 }}>{t('noFamily')}</Muted> : null}
      </Card>

      <SectionLabel>{t('measurements')}</SectionLabel>
      <Card flush>
        {groupsFor(c.gender).map((gr) => (
          <View key={gr}>
            <Muted style={{ fontWeight: '700', paddingTop: 12 }}>{t(gr)}</Muted>
            {LIST.filter((g) => g.group === gr).map((g, i, arr) => (
              <ListItem key={g.key} last={i === arr.length - 1} onPress={() => router.push({ pathname: '/customer/measure', params: { id: String(cid), garment: g.key } })}
                title={garmentName(g.key, lang)}
                trail={<Row gap={6}><Badge status={m[g.key] ? 'ready' : 'delivered'} label={m[g.key] ? t('saved') : t('notTaken')} /><Ionicons name={lang === 'ur' ? 'chevron-back' : 'chevron-forward'} size={16} color={C.faint} /></Row>} />
            ))}
          </View>
        ))}
      </Card>

      <SectionLabel>{t('orders')}</SectionLabel>
      <Card flush>
        {orders.length ? orders.map((o, i) => <OrderRow key={o.id} order={o} customer={c} showCustomer={false} last={i === orders.length - 1} />) : <Muted style={{ paddingVertical: 18 }}>{t('noOrdersYet')}</Muted>}
      </Card>

      <SectionLabel>{t('payments')}</SectionLabel>
      <Card flush>
        {pays.length ? pays.map((p, i) => (
          <ListItem key={p.id} last={i === pays.length - 1} onPress={() => delPay(p.id)}
            title={<T bold size={15} color={C.success}>{Fmt.money(p.amount)}</T>}
            sub={`${Fmt.date(p.date, lang, true)}${p.note ? ' · ' + (p.note === 'advance' ? t('advance') : p.note) : ''}`} />
        )) : <Muted style={{ paddingVertical: 18 }}>{t('noPayments')}</Muted>}
      </Card>

      {c.address || c.notes ? (<><SectionLabel>{t('details')}</SectionLabel><Card>{c.address ? <KV k={t('address')} v={c.address} /> : null}{c.notes ? <KV k={t('notes')} v={c.notes} /> : null}</Card></>) : null}

      <PaymentSheet visible={pay} onClose={() => setPay(false)} customerId={cid} onSaved={reload} />
      <MessageSheet visible={msg !== null} title={t('sendDueMsg')} text={msg || ''} onSkip={() => setMsg(null)}
        onSend={async () => { const text = msg || ''; setMsg(null); if (!(await openWhatsApp(c.phone, text, settings.countryCode))) toast(t('whatsappFail'), 'error'); }} />
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <Button variant="ghost" icon="pencil" label={t('editCustomer')} onPress={() => { setMenu(false); router.push({ pathname: '/customer/form', params: { id: String(cid) } }); }} style={{ marginBottom: 10 }} />
        <Button variant="danger" icon="trash" label={t('deleteCustomer')} onPress={doDelete} />
      </Sheet>
    </Screen>
  );
}
