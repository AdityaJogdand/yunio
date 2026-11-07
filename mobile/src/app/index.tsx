import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HandHeartIcon as HandHeart } from 'phosphor-react-native/src/icons/HandHeart';
import { HouseIcon as House } from 'phosphor-react-native/src/icons/House';
import { IntersectIcon as Intersect } from 'phosphor-react-native/src/icons/Intersect';
import { MagnifyingGlassIcon as MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MegaphoneIcon as Megaphone } from 'phosphor-react-native/src/icons/Megaphone';
import { MicrophoneIcon as Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { UsersThreeIcon as UsersThree } from 'phosphor-react-native/src/icons/UsersThree';
import type { Icon } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { cases, mine, review, type Case, type Pair } from '../api';
import { CaseRow, stateOf } from '../caseRow';
import { BLACK, FOUND, LOST, MUTED, Press, QUIET, REVIEW, RIM, ROUNDED, TRACK, WHITE, card } from '../ui';


export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // The ring takes half the card's inner width (screen minus page and card padding), capped
  const ring = Math.min(150, Math.floor((width - 80) / 2));
  const date = new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
  const [all, setAll] = useState<Case[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [offline, setOffline] = useState(false);

  // Reload whenever Home comes back into view, so a report just saved shows its match here
  useFocusEffect(
    useCallback(() => {
      Promise.all([cases(), review()])
        .then(([c, p]) => {
          setAll(c);
          setPairs(p);
          setOffline(false);
        })
        .catch(() => setOffline(true));
    }, []),
  );

  const open = all.filter((c) => c.status !== 'reunited');
  const today = {
    missing: open.filter((c) => c.kind === 'lost').length,
    found: open.filter((c) => c.kind === 'found').length,
    reunited: all.filter((c) => c.kind === 'lost' && c.status === 'reunited').length,
    camps: new Set(all.map((c) => c.camp)).size,
  };
  const pct = today.reunited / Math.max(1, today.reunited + today.missing);
  // Pairs involving a report made on this phone come first, newest report first
  const rank = (p: Pair) => Math.max(mine.indexOf(p.lost.id), mine.indexOf(p.found.id));
  const match = [...pairs].sort((a, b) => rank(b) - rank(a))[0];
  const yours = match && rank(match) >= 0;
  const recent = all.slice(-4).reverse();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.date}>{date}</Text>
            <Text style={styles.title} accessibilityRole="header">
              Yunio
            </Text>
            <Text style={styles.subtitle}>{offline ? "Can't reach the server" : 'Lost & found · Camp 3, Ramkund'}</Text>
          </View>
          <Press accessibilityLabel="Volunteer profile, online" style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
            <View style={styles.online} />
          </Press>
        </View>

        {/* Today */}
        <Animated.View entering={FadeInDown.duration(420)} style={card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Today</Text>
            <Text style={styles.cardNote} numberOfLines={1}>
              All {today.camps} camps
            </Text>
          </View>
          <View style={styles.dialRow}>
            <Side value={today.missing} label="missing" color={LOST} />
            <Ring pct={pct} size={ring}>
              <Text style={styles.dialValue}>{today.reunited}</Text>
              <Text style={styles.dialLabel}>reunited</Text>
            </Ring>
            <Side value={today.found} label="found" color={FOUND} />
          </View>
        </Animated.View>

        {/* The two things a volunteer does */}
        <Text style={styles.ask}>What happened?</Text>
        <Action kind="lost" icon={MagnifyingGlass} color={LOST} title="Someone is missing" local="कोणी हरवले आहे" />
        <Action kind="found" icon={HandHeart} color={FOUND} title="I found someone" local="कोणी सापडले आहे" />

        {/* Needs review: the best pair waiting for a volunteer, only when there is one */}
        {match && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Is this the same person?</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pairs.length}</Text>
              </View>
            </View>
            <Animated.View entering={FadeInDown.duration(420).delay(120)} style={card}>
              {yours && (
                <View style={styles.yours}>
                  <Text style={styles.yoursText}>Your report</Text>
                </View>
              )}
              <View style={styles.pair}>
                <Person name={match.lost.name ?? '—'} note={`Family at Camp ${match.lost.camp}`} label="Missing" color={LOST} />
                <View style={styles.score}>
                  <Text style={styles.scoreValue}>{Math.round(match.score * 100)}%</Text>
                  <Text style={styles.scoreLabel}>likely</Text>
                </View>
                <Person name={match.found.name ?? '—'} note={`Waiting at Camp ${match.found.camp}`} label="Found" color={FOUND} end />
              </View>
              <Text style={styles.reasons}>{match.reasons.join(' · ')}</Text>
              <Press style={styles.primary} onPress={() => router.push({ pathname: '/match', params: { lost: match.lost.id, found: match.found.id } })} accessibilityLabel="Check this match">
                <Text style={styles.primaryText}>Check and confirm</Text>
              </Press>
            </Animated.View>
          </>
        )}

        {/* Recent */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Recent</Text>
          <Press scale={0.94} onPress={() => router.push('/cases')} accessibilityLabel="See all reports">
            <Text style={styles.link}>See all</Text>
          </Press>
        </View>
        <View style={[card, styles.list]}>
          {recent.map((c, i) => (
            <CaseRow key={c.id} c={c} state={stateOf(c, pairs)} first={i === 0} />
          ))}
        </View>

        <Text style={styles.footer}>Prototype · synthetic data · not a government service</Text>
      </ScrollView>

      <TabBar bottom={Math.max(insets.bottom, 10)} />
    </View>
  );
}

function Ring({ pct, size, children }: { pct: number; size: number; children: React.ReactNode }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${Math.round(pct * 100)} percent reunited`}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={TRACK} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={WHITE}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          fill="none"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

function Side({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.side}>
      <Text style={styles.sideValue}>{value}</Text>
      <View style={styles.sideLabelRow}>
        <View style={[styles.miniDot, { backgroundColor: color }]} />
        <Text style={styles.sideLabel}>{label}</Text>
      </View>
    </View>
  );
}

function Action({ kind, icon: I, color, title, local }: { kind: 'lost' | 'found'; icon: Icon; color: string; title: string; local: string }) {
  return (
    <Press
      style={[card, styles.action]}
      onPress={() => router.push({ pathname: '/intake', params: { kind } })}
      accessibilityLabel={`${title}. Tap to speak`}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}22` }]}>
        <I size={26} color={color} weight="fill" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionLocal}>{local}</Text>
      </View>
      <View style={styles.speak}>
        <Microphone size={20} color={BLACK} weight="fill" />
      </View>
    </Press>
  );
}

function Person({ label, name, note, color, end }: { label: string; name: string; note: string; color: string; end?: boolean }) {
  return (
    <View style={[styles.flex, end && styles.alignEnd]}>
      <Text style={[styles.personId, { color }]}>{label}</Text>
      <Text style={styles.personName} numberOfLines={1}>{name}</Text>
      <Text style={[styles.personNote, end && styles.textEnd]} numberOfLines={2}>{note}</Text>
    </View>
  );
}

// ponytail: Announce has no screen yet; announcements live inside each match for now
const TABS: { icon: Icon; label: string; go?: () => void }[] = [
  { icon: House, label: 'Home' },
  { icon: UsersThree, label: 'Cases', go: () => router.push('/cases') },
  { icon: Intersect, label: 'Matches', go: () => router.push({ pathname: '/cases', params: { filter: 'review' } }) },
  { icon: Megaphone, label: 'Announce' },
];

function TabBar({ bottom }: { bottom: number }) {
  const tab = (t: (typeof TABS)[number], i: number) => (
    <Press key={t.label} scale={0.9} style={styles.tab} onPress={t.go} accessibilityLabel={t.label}>
      <t.icon size={24} color={i === 0 ? WHITE : QUIET} weight="fill" />
      <Text style={[styles.tabLabel, i === 0 && styles.tabLabelOn]}>{t.label}</Text>
    </Press>
  );
  return (
    <View style={[styles.tabBar, { paddingBottom: bottom }]}>
      {TABS.slice(0, 2).map(tab)}
      <View style={styles.tabCenter}>
        <Press style={styles.fab} scale={0.9} onPress={() => router.push('/intake')} accessibilityLabel="Speak a new report">
          <Microphone size={24} color={BLACK} weight="fill" />
        </Press>
      </View>
      {TABS.slice(2).map((t, i) => tab(t, i + 2))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  textEnd: { textAlign: 'right' },
  content: { paddingHorizontal: 20, paddingBottom: 130 },

  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 24 },
  date: { color: QUIET, fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  title: { color: WHITE, fontSize: 40, lineHeight: 52, fontWeight: '700', marginTop: 4 },
  subtitle: { color: MUTED, fontSize: 14, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, marginBottom: 4 },
  avatarText: { color: BLACK, fontSize: 18, fontWeight: '600', fontFamily: ROUNDED },
  online: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: FOUND, borderWidth: 2, borderColor: BLACK },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: WHITE, fontSize: 19, fontWeight: '600', letterSpacing: -0.3 },
  cardNote: { color: QUIET, fontSize: 13, flexShrink: 1, textAlign: 'right' },

  dialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  side: { flex: 1, alignItems: 'center' },
  sideValue: { color: WHITE, fontSize: 26, fontWeight: '500', fontFamily: ROUNDED, letterSpacing: -0.6 },
  sideLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  sideLabel: { color: QUIET, fontSize: 12 },
  dialValue: { color: WHITE, fontSize: 44, lineHeight: 50, fontWeight: '600', fontFamily: ROUNDED, letterSpacing: -1.5 },
  dialLabel: { color: QUIET, fontSize: 13 },


  ask: { color: WHITE, fontSize: 21, fontWeight: '600', letterSpacing: -0.3, marginTop: 32, marginBottom: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, marginBottom: 12 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: WHITE, fontSize: 19, fontWeight: '600', letterSpacing: -0.3 },
  actionLocal: { color: MUTED, fontSize: 15, lineHeight: 24, marginTop: 2 },
  speak: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 14 },
  section: { color: WHITE, fontSize: 21, fontWeight: '600', letterSpacing: -0.3 },
  link: { color: MUTED, fontSize: 14 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: REVIEW },
  badgeText: { color: BLACK, fontSize: 13, fontWeight: '700', fontFamily: ROUNDED },

  yours: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
  yoursText: { color: WHITE, fontSize: 12, fontWeight: '700' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personId: { fontSize: 13, fontWeight: '600' },
  personName: { color: WHITE, fontSize: 18, lineHeight: 26, fontWeight: '600', marginTop: 4 },
  personNote: { color: QUIET, fontSize: 13, marginTop: 2 },
  score: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: FOUND, backgroundColor: 'rgba(48,209,88,0.08)' },
  scoreValue: { color: WHITE, fontSize: 20, fontWeight: '600', fontFamily: ROUNDED, letterSpacing: -0.5 },
  scoreLabel: { color: QUIET, fontSize: 10, fontWeight: '600' },
  reasons: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 18 },
  primary: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, marginTop: 18 },
  primaryText: { color: BLACK, fontSize: 16, fontWeight: '600' },

  list: { paddingVertical: 4, paddingHorizontal: 0 },

  footer: { color: QUIET, fontSize: 11, textAlign: 'center', marginTop: 24 },

  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingTop: 8, backgroundColor: 'rgba(10,10,10,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48, justifyContent: 'center' },
  tabLabel: { color: QUIET, fontSize: 11, fontWeight: '500' },
  tabLabelOn: { color: WHITE },
  tabCenter: { flex: 1, alignItems: 'center' },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, boxShadow: '0 6px 20px rgba(255,255,255,0.18)' },
});
