import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Chips, Muted, Screen } from '../../ui/kit';
import { useCan } from '../../license/LicenseGate';
import { useApp } from '../../ctx/AppContext';
import { Summary } from '../../screens/accounts/Summary';
import { Khata } from '../../screens/accounts/Khata';
import { Cash } from '../../screens/accounts/Cash';
import { Expenses } from '../../screens/accounts/Expenses';
import { Stock } from '../../screens/accounts/Stock';
import { currentYM, YM } from '../../screens/accounts/common';

const TABS = ['summary', 'khata', 'cash', 'expenses', 'stock'] as const;
type Tab = (typeof TABS)[number];

export default function Accounts() {
  const { t } = useApp();
  const params = useLocalSearchParams<{ tab?: string; add?: string }>();
  const can = useCan();
  const allowed: Record<Tab, boolean> = { summary: can('accounts.reports'), khata: can('accounts.khata'), cash: can('accounts.khata'), expenses: can('accounts.expenses'), stock: can('stock.manage') };
  const visible = TABS.filter((k) => allowed[k]);
  const [tab, setTab] = useState<Tab>('summary');
  const cur: Tab | null = allowed[tab] ? tab : visible[0] ?? null;
  const [ym, setYm] = useState<YM>(currentYM());
  React.useEffect(() => { if (params.tab && (TABS as readonly string[]).includes(params.tab)) setTab(params.tab as Tab); }, [params.tab, params.add]);
  const labels: Record<Tab, string> = { summary: t('summary'), khata: t('khata'), cash: t('cashBook'), expenses: t('expenses'), stock: t('stock') };
  return (
    <Screen title={t('navAccounts')}>
      {cur === null ? <Muted center style={{ marginTop: 40 }}>{t('featureLocked')}</Muted> : null}
      {cur !== null && <Chips value={cur} onChange={setTab} items={visible.map((k) => [k, labels[k]] as [Tab, string])} />}
      {cur === 'summary' && <Summary ym={ym} setYm={setYm} />}
      {cur === 'khata' && <Khata />}
      {cur === 'cash' && <Cash />}
      {cur === 'expenses' && <Expenses ym={ym} setYm={setYm} openAdd={params.add} />}
      {cur === 'stock' && <Stock />}
    </Screen>
  );
}
