import React from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../ctx/AppContext';
import { Repo } from '../../db/repo';
import { useLoad } from '../../lib/hooks';
import { Button, Card, Empty, Grid, Hero, ListItem, Loading, Muted, Row, Screen, SectionLabel, StatCard, T } from '../../ui/kit';
import { OrderRow } from '../../ui/OrderRow';
import { Fmt } from '../../lib/format';
import { C, TONES } from '../../lib/theme';

export default function Dashboard() {
  const { t, lang, settings, setLang } = useApp();
  const [data, reload] = useLoad(async () => {
    const [s, custMap] = await Promise.all([Repo.dashboardStats(), Repo.customerMap()]);
    return { s, custMap };
  }, []);
  const h = new Date().getHours();
  const greeting = h < 12 ? t('goodMorning') : h < 17 ? t('goodAfternoon') : t('goodEvening');
  const shop = lang === 'ur' ? settings.shopNameUr || settings.shopName : settings.shopName || settings.shopNameUr;

  const langBtn = (
    <Pressable onPress={() => setLang(lang === 'ur' ? 'en' : 'ur')} style={{ backgroundColor: 'rgba(62,107,255,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 }}>
      <T bold size={13} color={C.primary}>{lang === 'ur' ? 'EN' : 'اردو'}</T>
    </Pressable>
  );

  const body = () => {
    if (!data) return <Loading />;
    const { s, custMap } = data;
    const reminders: [number, React.ComponentProps<typeof Ionicons>['name'], string, () => void, boolean][] = [
      [s.dueTodayCount, 'alarm-outline', 'remDueToday', () => router.navigate({ pathname: '/orders', params: { status: 'due' } }), true],
      [s.dueTomorrowCount, 'calendar-outline', 'remDueTomorrow', () => router.navigate({ pathname: '/orders', params: { status: 'pending' } }), false],
      [s.trialCount, 'resize-outline', 'remTrial', () => router.navigate({ pathname: '/orders', params: { status: 'pending' } }), false],
      [s.urgentCount, 'flame-outline', 'remUrgent', () => router.navigate({ pathname: '/orders', params: { status: 'pending' } }), true],
      [s.lowStock.length, 'cube-outline', 'remLowStock', () => router.navigate({ pathname: '/accounts', params: { tab: 'stock' } }), true],
    ];
    const rows = reminders.filter((r) => r[0] > 0);
    return (
      <>
        <Hero label={t('pendingBalance')} value={Fmt.money(s.receivable)} hint={t('pendingBalanceHint')} />
        {s.backupDue ? (
          <Card onPress={() => router.push('/backup')}>
            <Row gap={12}>
              <Ionicons name="cloud-upload-outline" size={26} color={C.primary} />
              <View style={{ flex: 1 }}>
                <T bold size={15}>{t('backupDueTitle')}</T>
                <Muted>{t('backupDueHint')}</Muted>
              </View>
            </Row>
          </Card>
        ) : null}
        {rows.length ? (
          <>
            <SectionLabel>{t('reminders')}</SectionLabel>
            <Card flush>
              {rows.map(([n, icon, key, go, hot], i) => (
                <ListItem key={key} last={i === rows.length - 1} onPress={go}
                  left={<Ionicons name={icon} size={22} color={hot ? C.danger : C.primary} />}
                  title={t(key)} trail={<T bold size={16}>{n}</T>} />
              ))}
            </Card>
          </>
        ) : null}
        <Grid>
          <StatCard icon="cut" tone="blue" value={s.pendingCount} label={t('pendingOrders')} onPress={() => router.navigate({ pathname: '/orders', params: { status: 'pending' } })} />
          <StatCard icon="checkmark-done" tone="green" value={s.readyCount} label={t('readyForPickup')} onPress={() => router.navigate({ pathname: '/orders', params: { status: 'ready' } })} />
          <StatCard icon="alarm" tone="orange" value={s.dueCount} label={t('dueToday')} onPress={() => router.navigate({ pathname: '/orders', params: { status: 'due' } })} />
          <StatCard icon="trending-up" tone="violet" small value={Fmt.money(s.month.income)} label={t('incomeThisMonth')} onPress={() => router.navigate('/accounts')} />
        </Grid>
        <SectionLabel right={<Pressable onPress={() => router.navigate('/orders')}><T bold size={13} color={C.primary}>{t('seeAll')}</T></Pressable>}>{t('upcomingDeliveries')}</SectionLabel>
        <Card flush>
          {s.upcoming.length
            ? s.upcoming.map((o, i) => <OrderRow key={o.id} order={o} customer={custMap[o.customerId]} last={i === s.upcoming.length - 1} />)
            : <Empty icon="cut" title={t('noPending')} text={t('noPendingHint')} />}
        </Card>
        <SectionLabel>{t('quickActions')}</SectionLabel>
        <Row style={{ marginBottom: 10 }}>
          <Button block icon="add" label={t('newOrder')} onPress={() => router.push('/order/form')} />
          <Button block variant="ghost" icon="person-add" label={t('newCustomer')} onPress={() => router.push('/customer/form')} />
        </Row>
        <Row>
          <Button block variant="ghost" icon="cash-outline" label={t('khata')} onPress={() => router.navigate({ pathname: '/accounts', params: { tab: 'khata' } })} />
          <Button block variant="ghost" icon="receipt-outline" label={t('addExpense')} onPress={() => router.navigate({ pathname: '/accounts', params: { tab: 'expenses', add: String(Date.now()) } })} />
        </Row>
      </>
    );
  };
  return <Screen title={shop} subtitle={greeting} right={langBtn} onRefresh={reload}>{body()}</Screen>;
}
