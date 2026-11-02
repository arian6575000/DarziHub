import React, { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chips, Empty, IconButton, Loading, Screen, SearchBar } from '../../ui/kit';
import { OrderRow } from '../../ui/OrderRow';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { Order, PENDING } from '../../db/types';
import { useLoad } from '../../lib/hooks';
import { todayStr } from '../../lib/dates';

const FILTERS = ['pending', 'due', 'ready', 'delivered', 'cancelled', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export default function Orders() {
  const { t } = useApp();
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<Filter>('pending');
  const [q, setQ] = useState('');
  useEffect(() => { if (params.status && (FILTERS as readonly string[]).includes(params.status)) setFilter(params.status as Filter); }, [params.status]);

  const [data, reload] = useLoad(async () => {
    const [orders, custMap] = await Promise.all([Repo.listOrders(), Repo.customerMap()]);
    return { orders, custMap };
  }, []);

  const list = useMemo(() => {
    if (!data) return [];
    const today = todayStr();
    const test: Record<string, (o: Order) => boolean> = {
      pending: (o) => PENDING.includes(o.status),
      due: (o) => PENDING.includes(o.status) && !!o.deliveryDate && o.deliveryDate <= today,
      all: () => true,
    };
    let l = data.orders.filter((o) => (test[filter] || ((x) => x.status === filter))(o));
    if (!['delivered', 'all', 'cancelled'].includes(filter)) l = l.slice().sort((a, b) => (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999'));
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((o) => { const c = data.custMap[o.customerId]; return [o.orderNumber, c?.name, c?.phone].filter(Boolean).join(' ').toLowerCase().includes(s); });
    return l;
  }, [data, filter, q]);

  const label = (c: Filter) => t(['pending', 'due', 'all'].includes(c) ? 'f_' + c : 'st_' + c);
  return (
    <Screen title={t('navOrders')} onRefresh={reload} right={<IconButton icon="add" onPress={() => router.push('/order/form')} />}>
      <SearchBar value={q} onChangeText={setQ} placeholder={t('searchOrders')} />
      <Chips value={filter} onChange={setFilter} items={FILTERS.map((c) => [c, label(c)] as [Filter, string])} />
      {!data ? <Loading /> : !list.length ? (
        <Empty icon="cut" title={t('noOrders')} text={t('noOrdersHint')} action={<Button icon="add" label={t('newOrder')} onPress={() => router.push('/order/form')} />} />
      ) : (
        <Card flush>{list.map((o, i) => <OrderRow key={o.id} order={o} customer={data.custMap[o.customerId]} last={i === list.length - 1} />)}</Card>
      )}
    </Screen>
  );
}
