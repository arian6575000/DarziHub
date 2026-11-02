import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Chips, Screen } from '../../ui/kit';
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
  const [tab, setTab] = useState<Tab>('summary');
  const [ym, setYm] = useState<YM>(currentYM());
  React.useEffect(() => { if (params.tab && (TABS as readonly string[]).includes(params.tab)) setTab(params.tab as Tab); }, [params.tab, params.add]);
  const labels: Record<Tab, string> = { summary: t('summary'), khata: t('khata'), cash: t('cashBook'), expenses: t('expenses'), stock: t('stock') };
  return (
    <Screen title={t('navAccounts')}>
      <Chips value={tab} onChange={setTab} items={TABS.map((k) => [k, labels[k]] as [Tab, string])} />
      {tab === 'summary' && <Summary ym={ym} setYm={setYm} />}
      {tab === 'khata' && <Khata />}
      {tab === 'cash' && <Cash />}
      {tab === 'expenses' && <Expenses ym={ym} setYm={setYm} openAdd={tab === 'expenses' ? params.add : undefined} />}
      {tab === 'stock' && <Stock />}
    </Screen>
  );
}
