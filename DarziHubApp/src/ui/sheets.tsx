import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Repo } from '../db/repo';
import { calcOrder } from '../lib/calc';
import { Fmt } from '../lib/format';
import { todayStr } from '../lib/dates';
import { useApp } from '../ctx/AppContext';
import { Button, Card, DateField, NumField, Field, Row, Segmented, SelectField, Sheet, T } from './kit';

export function PaymentSheet({ visible, onClose, customerId, orderId, onSaved }: { visible: boolean; onClose: () => void; customerId: number; orderId?: number | null; onSaved: () => void }) {
  const { t, toast, lang } = useApp();
  const [opts, setOpts] = useState<{ id: number; label: string; bal: number }[]>([]);
  const [order, setOrder] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState<'cash' | 'online'>('cash');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const orders = (await Repo.listOrdersForCustomer(customerId)).filter((o) => o.status !== 'cancelled');
      const withBal: { id: number; label: string; bal: number }[] = [];
      for (const o of orders) withBal.push({ id: o.id, bal: calcOrder(o).total - (await Repo.orderPaid(o.id)), label: o.orderNumber });
      const open = withBal.filter((x) => x.bal > 0);
      const preset = orderId ? withBal.find((x) => x.id === orderId) : open.length === 1 ? open[0] : undefined;
      const list = open.concat(preset && !open.includes(preset) ? [preset] : []);
      setOpts(list);
      setOrder(preset ? String(preset.id) : '');
      setAmount(preset && preset.bal > 0 ? String(preset.bal) : '');
      setDate(todayStr()); setMethod('cash'); setNote('');
    })();
  }, [visible, customerId, orderId]);

  const save = async () => {
    const a = Number(amount);
    if (!(a > 0)) { toast(t('amountRequired'), 'error'); return; }
    await Repo.addPayment({ customerId, orderId: order ? Number(order) : null, amount: a, date: date || todayStr(), method, note });
    onClose(); toast(t('saved'), 'success'); onSaved();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('receivePayment')} scroll>
      <SelectField label={t('forOrder')} value={order}
        options={[{ value: '', label: t('generalKhata') }, ...opts.map((x) => ({ value: String(x.id), label: `${x.label} · ${t('balance')} ${Fmt.money(x.bal)}` }))]}
        onChange={(v) => { setOrder(v); const x = opts.find((o) => String(o.id) === v); setAmount(x ? String(x.bal) : ''); }} />
      <Row align="flex-start">
        <NumField label={`${t('amount')} *`} value={amount} onChangeText={setAmount} style={{ flex: 1 }} />
        <DateField label={t('date')} value={date} onChange={setDate} />
      </Row>
      <View style={{ marginBottom: 14 }}>
        <T size={12.5} bold color="#4B4F5E" style={{ marginBottom: 6 }}>{t('payMethod')}</T>
        <Segmented value={method} onChange={setMethod} items={[['cash', t('cash')], ['online', lang === 'ur' ? 'آن لائن' : 'Online']]} />
      </View>
      <Field label={t('note')} value={note} onChangeText={setNote} />
      <Row><Button block variant="ghost" label={t('cancel')} onPress={onClose} /><Button block label={t('save')} onPress={save} /></Row>
    </Sheet>
  );
}

export function MessageSheet({ visible, title, text, onSkip, onSend }: { visible: boolean; title: string; text: string; onSkip: () => void; onSend: () => void }) {
  const { t } = useApp();
  return (
    <Sheet visible={visible} onClose={onSkip} title={title}>
      <Card><T size={14.5} selectable>{text}</T></Card>
      <Row><Button block variant="ghost" label={t('skip')} onPress={onSkip} /><Button block icon="logo-whatsapp" label="WhatsApp" onPress={onSend} /></Row>
    </Sheet>
  );
}
