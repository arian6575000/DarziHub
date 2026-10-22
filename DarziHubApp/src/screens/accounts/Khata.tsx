import React, { useState } from 'react';
import { router } from 'expo-router';
import { Avatar, Card, Hero, IconButton, ListItem, Muted, SectionLabel, T } from '../../ui/kit';
import { MessageSheet } from '../../ui/sheets';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import type { Customer } from '../../db/types';
import { useLoad } from '../../lib/hooks';
import { Fmt } from '../../lib/format';
import { buildMessage, openWhatsApp } from '../../lib/messages';
import { C } from '../../lib/theme';

export function Khata() {
  const { t, lang, settings, toast } = useApp();
  const [msg, setMsg] = useState<{ c: Customer; text: string } | null>(null);
  const [d] = useLoad(async () => {
    const [customers, sums] = await Promise.all([Repo.listCustomers(), Repo.customerSummaries()]);
    const list = customers.map((c) => ({ c, s: sums[c.id] })).filter((x) => x.s && x.s.balance > 0).sort((a, b) => b.s.balance - a.s.balance);
    return { list, total: list.reduce((a, x) => a + x.s.balance, 0) };
  }, []);
  if (!d) return null;
  return (
    <>
      <Hero label={t('pendingBalance')} value={Fmt.money(d.total)} hint={`${d.list.length} ${t('customersOwe')}`} />
      <Card flush>
        {d.list.length ? d.list.map(({ c, s }, i) => (
          <ListItem key={c.id} last={i === d.list.length - 1} onPress={() => router.push(`/customer/${c.id}`)}
            left={<Avatar text={Fmt.initials(c.name)} />} title={c.name} sub={c.phone}
            trail={<T bold size={14} color={C.danger}>{Fmt.money(s.balance)}</T>} />
        )) : <Muted center style={{ paddingVertical: 22 }}>{t('nobodyOwes')}</Muted>}
      </Card>
      <RemindRow list={d.list.filter((x) => x.c.phone)} onPick={(c, bal) => setMsg({ c, text: buildMessage('due', settings, c, null, bal, lang) })} />
      <MessageSheet visible={!!msg} title={t('sendDueMsg')} text={msg?.text || ''} onSkip={() => setMsg(null)}
        onSend={async () => { const m = msg; setMsg(null); if (m && !(await openWhatsApp(m.c.phone, m.text, settings.countryCode))) toast(t('whatsappFail'), 'error'); }} />
    </>
  );
}

function RemindRow({ list, onPick }: { list: { c: Customer; s: { balance: number } }[]; onPick: (c: Customer, bal: number) => void }) {
  const { t } = useApp();
  if (!list.length) return null;
  return (
    <>
    <SectionLabel>{t('sendDueMsg')}</SectionLabel>
    <Card flush>
      {list.map(({ c, s }, i) => (
        <ListItem key={c.id} last={i === list.length - 1} title={c.name} sub={Fmt.money(s.balance)}
          trail={<IconButton icon="logo-whatsapp" color={C.success} onPress={() => onPick(c, s.balance)} />} />
      ))}
    </Card>
    </>
  );
}
