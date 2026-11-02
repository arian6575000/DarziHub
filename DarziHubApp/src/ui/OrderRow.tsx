import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Customer, Order } from '../db/types';
import { calcOrder } from '../lib/calc';
import { Fmt } from '../lib/format';
import { itemsSummary } from '../lib/garments';
import { useApp } from '../ctx/AppContext';
import { Avatar, Badge, ListItem, Muted, T } from './kit';
import { C } from '../lib/theme';

export function useDueLabel() {
  const { t, lang } = useApp();
  return (o: Order): { text: string; danger: boolean } => {
    if (!o.deliveryDate) return { text: '', danger: false };
    if (o.status === 'delivered' || o.status === 'cancelled') return { text: Fmt.date(o.deliveryDate, lang, true), danger: false };
    const d = Fmt.daysFromToday(o.deliveryDate);
    if (d == null) return { text: '', danger: false };
    if (d < 0) return { text: `${t('overdue')} · ${Fmt.date(o.deliveryDate, lang, true)}`, danger: true };
    if (d === 0) return { text: t('today'), danger: true };
    if (d === 1) return { text: t('tomorrow'), danger: false };
    return { text: Fmt.date(o.deliveryDate, lang, true), danger: false };
  };
}

export function OrderRow({ order, customer, showCustomer = true, last }: { order: Order; customer?: Customer; showCustomer?: boolean; last?: boolean }) {
  const { t, lang } = useApp();
  const due = useDueLabel()(order);
  return (
    <ListItem
      last={last}
      onPress={() => router.push(`/order/${order.id}`)}
      left={<Avatar icon="cut" />}
      title={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T bold size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{showCustomer ? customer?.name || '—' : order.orderNumber}</T>
          {order.urgent ? <Ionicons name="flame" size={15} color={C.danger} /> : null}
        </View>
      }
      sub={itemsSummary(order.items, lang)}
      sub2={<Muted numberOfLines={1}>{showCustomer ? `${order.orderNumber} · ` : ''}<T size={13} color={due.danger ? C.danger : C.faint}>{due.text}</T></Muted>}
      trail={<><T bold size={13.5}>{Fmt.money(calcOrder(order).total)}</T><View style={{ marginTop: 4 }}><Badge status={order.status} label={t('st_' + order.status)} /></View></>}
    />
  );
}
