import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Card, Avatar, Button, Empty, IconButton, ListItem, Loading, Muted, Screen, SearchBar, T } from '../../ui/kit';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { useLoad } from '../../lib/hooks';
import { Fmt } from '../../lib/format';
import { C } from '../../lib/theme';

export default function Customers() {
  const { t } = useApp();
  const [q, setQ] = useState('');
  const [data, reload] = useLoad(async () => {
    const [list, sums] = await Promise.all([Repo.listCustomers(), Repo.customerSummaries()]);
    return { list, sums };
  }, []);
  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return s ? data.list.filter((c) => [c.name, c.phone, c.address].filter(Boolean).join(' ').toLowerCase().includes(s)) : data.list;
  }, [data, q]);

  return (
    <Screen title={t('navCustomers')} onRefresh={reload} right={<IconButton icon="add" onPress={() => router.push('/customer/form')} />}>
      <SearchBar value={q} onChangeText={setQ} placeholder={t('searchCustomers')} />
      {!data ? <Loading /> : !data.list.length ? (
        <Empty icon="people" title={t('noCustomers')} text={t('noCustomersHint')} action={<Button icon="add" label={t('addCustomer')} onPress={() => router.push('/customer/form')} />} />
      ) : !filtered.length ? <Empty icon="search" title={t('noMatches')} text={t('tryDifferent')} /> : (
        <Card flush>
          {filtered.map((c, i) => {
            const s = data.sums[c.id] || { balance: 0, orderCount: 0 };
            return (
              <ListItem key={c.id} last={i === filtered.length - 1} onPress={() => router.push(`/customer/${c.id}`)}
                left={<Avatar text={Fmt.initials(c.name)} />} title={c.name} sub={`${c.phone || t('noPhone')}${c.headId ? ' · ' + t('family') : ''}`}
                trail={s.balance > 0 ? <><T bold size={13.5} color={C.danger}>{Fmt.money(s.balance)}</T><Muted>{t('balanceDue')}</Muted></> : <><T bold size={13.5}>{s.orderCount}</T><Muted>{t('orders')}</Muted></>} />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
