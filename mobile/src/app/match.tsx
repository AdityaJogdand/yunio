import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CheckIcon as Check } from 'phosphor-react-native/src/icons/Check';
import { PlayIcon as Play } from 'phosphor-react-native/src/icons/Play';
import { XIcon as X } from 'phosphor-react-native/src/icons/X';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { announcement, pair, reject, reunite, speechUrl, type Announcement, type Case, type Pair } from '../api';
import { show, TopBar } from '../caseRow';
import { BLACK, card, FOUND, LOST, MUTED, Press, QUIET, RIM, ROUNDED, WHITE } from '../ui';

type Step = 'compare' | 'announce' | 'done';

// The rows a volunteer compares, in the order they'd ask about them
const ROWS: { label: string; get: (c: Case) => unknown }[] = [
  { label: 'Name', get: (c) => [c.name, c.nickname].filter(Boolean).join(' / ') },
  { label: 'Age', get: (c) => c.age },
  { label: 'Wearing', get: (c) => c.clothing },
  { label: 'Village', get: (c) => c.village },
  { label: 'Where', get: (c) => c.place ?? c.location },
  { label: 'Camp', get: (c) => c.camp },
];

export default function MatchScreen() {
  const insets = useSafeAreaInsets();
  const { lost, found } = useLocalSearchParams<{ lost: string; found: string }>();
  const [p, setP] = useState<Pair>();
  const [step, setStep] = useState<Step>('compare');
  const [lines, setLines] = useState<Announcement[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pair(lost, found)
      .then((x) => {
        setP(x);
        if (x.lost.status === 'reunited') setStep('done');
      })
      .catch((e) => Alert.alert('Could not load', (e as Error).message));
  }, [lost, found]);

  async function same() {
    setBusy(true);
    try {
      setLines(await announcement(lost, found));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep('announce');
    } catch (e) {
      Alert.alert('Could not make announcements', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function different() {
    Alert.alert('Not the same person?', 'We will stop suggesting this pair.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Not the same',
        style: 'destructive',
        onPress: async () => {
          try {
            await reject(lost, found);
            router.back();
          } catch (e) {
            Alert.alert('Not saved', (e as Error).message);
          }
        },
      },
    ]);
  }

  async function reunited() {
    try {
      await reunite(lost, found);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('done');
    } catch (e) {
      Alert.alert('Not saved', (e as Error).message);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <TopBar title={step === 'announce' ? 'Tell the family' : 'Same person?'} />

        {!p ? (
          <ActivityIndicator color={WHITE} style={styles.loading} />
        ) : step === 'compare' ? (
          <Compare p={p} busy={busy} onSame={same} onDifferent={different} />
        ) : step === 'announce' ? (
          <Announce lines={lines} onReunited={reunited} />
        ) : (
          <Done p={p} />
        )}
      </ScrollView>
    </View>
  );
}

function Compare({ p, busy, onSame, onDifferent }: { p: Pair; busy: boolean; onSame: () => void; onDifferent: () => void }) {
  return (
    <Animated.View entering={FadeIn}>
      <View style={card}>
        <View style={styles.headRow}>
          <View style={styles.label} />
          <Text style={[styles.col, styles.colHead, { color: LOST }]}>Missing</Text>
          <Text style={[styles.col, styles.colHead, { color: FOUND }]}>Found</Text>
        </View>
        {ROWS.map((r) => (
          <View key={r.label} style={styles.cmpRow}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.col}>{show(r.get(p.lost)) || '—'}</Text>
            <Text style={styles.col}>{show(r.get(p.found)) || '—'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.score}>{Math.round(p.score * 100)}%</Text>
        <Text style={styles.reasons}>{p.reasons.join(' · ')}</Text>
      </View>

      <Press style={styles.primary} onPress={onSame} disabled={busy} accessibilityLabel="Yes, this is the same person">
        {busy ? <ActivityIndicator color={BLACK} /> : <Check size={20} color={BLACK} weight="bold" />}
        <Text style={styles.primaryText}>Yes, same person</Text>
      </Press>
      <Press style={styles.secondary} onPress={onDifferent} accessibilityLabel="No, these are different people">
        <X size={18} color={WHITE} weight="bold" />
        <Text style={styles.secondaryText}>Not the same</Text>
      </Press>
    </Animated.View>
  );
}

function Announce({ lines, onReunited }: { lines: Announcement[]; onReunited: () => void }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState(''); // language whose line is selected
  const [loading, setLoading] = useState(''); // Timbre is still generating this one

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  // Spinner until sound actually starts; clear the highlight when it ends
  useEffect(() => {
    if (status.playing) setLoading('');
    if (status.didJustFinish) setPlaying('');
  }, [status.playing, status.didJustFinish]);

  // If Timbre never answers, don't spin forever
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading('');
      setPlaying('');
      Alert.alert('Could not play', 'The voice took too long. Check the server and try again.');
    }, 20000);
    return () => clearTimeout(t);
  }, [loading]);

  function play(a: Announcement) {
    // Timbre speaks the approved template; nothing is played until the volunteer taps
    const uri = speechUrl(a.text, a.lang);
    if (!uri) return Alert.alert('Demo mode', 'Connect the server to hear announcements.');
    setPlaying(a.lang);
    setLoading(a.lang);
    player.replace(uri);
    player.play();
  }

  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      <Text style={styles.lead}>Play these on the speaker, in the family's language first.</Text>
      {lines.map((a) => (
        <View key={a.lang} style={[card, styles.line]}>
          <View style={styles.lineHead}>
            <Text style={styles.lineLang}>{a.label}</Text>
            {loading === a.lang && <Text style={styles.loadingText}>Preparing voice…</Text>}
            <Press
              style={[styles.play, playing === a.lang && styles.playOn]}
              scale={0.92}
              disabled={loading === a.lang}
              onPress={() => play(a)}
              accessibilityLabel={loading === a.lang ? `Preparing ${a.label} announcement` : `Play ${a.label} announcement`}>
              {loading === a.lang ? <ActivityIndicator size="small" color={BLACK} /> : <Play size={16} color={playing === a.lang ? BLACK : WHITE} weight="fill" />}
            </Press>
          </View>
          <Text style={styles.lineText}>{a.text}</Text>
        </View>
      ))}
      <Press style={styles.primary} onPress={onReunited} accessibilityLabel="Family has arrived. Mark as reunited">
        <Check size={20} color={BLACK} weight="bold" />
        <Text style={styles.primaryText}>Family is here · Reunited</Text>
      </Press>
    </Animated.View>
  );
}

function Done({ p }: { p: Pair }) {
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.done}>
      <View style={styles.doneIcon}>
        <Check size={34} color={FOUND} weight="bold" />
      </View>
      <Text style={styles.doneTitle}>Reunited</Text>
      <Text style={styles.doneSub}>
        {p.lost.name || p.found.name} is back with family.
      </Text>
      <Press style={[styles.primary, styles.full]} onPress={() => router.dismissTo('/')}>
        <Text style={styles.primaryText}>Back to home</Text>
      </Press>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK },
  content: { paddingHorizontal: 20 },
  loading: { marginTop: 80 },
  full: { alignSelf: 'stretch' },

  headRow: { flexDirection: 'row', gap: 10, paddingBottom: 10 },
  colHead: { fontSize: 13, fontWeight: '700' },
  cmpRow: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: RIM },
  label: { width: 64, color: QUIET, fontSize: 13 },
  col: { flex: 1, color: WHITE, fontSize: 15, lineHeight: 21 },

  scoreRow: { alignItems: 'center', marginTop: 20, gap: 4 },
  score: { color: WHITE, fontSize: 40, fontWeight: '600', fontFamily: ROUNDED, letterSpacing: -1 },
  reasons: { color: MUTED, fontSize: 14, textAlign: 'center' },

  primary: { flexDirection: 'row', gap: 8, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, marginTop: 20 },
  primaryText: { color: BLACK, fontSize: 17, fontWeight: '700' },
  secondary: { flexDirection: 'row', gap: 8, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', borderWidth: StyleSheet.hairlineWidth, borderColor: RIM, marginTop: 10 },
  secondaryText: { color: WHITE, fontSize: 15, fontWeight: '600' },

  lead: { color: MUTED, fontSize: 14, marginBottom: 12 },
  line: { marginBottom: 10 },
  lineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  lineLang: { flex: 1, color: WHITE, fontSize: 15, fontWeight: '700' },
  loadingText: { color: QUIET, fontSize: 13, marginRight: 10 },
  lineText: { color: MUTED, fontSize: 16, lineHeight: 25 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', borderWidth: StyleSheet.hairlineWidth, borderColor: RIM },
  playOn: { backgroundColor: WHITE },

  done: { alignItems: 'center', paddingTop: 40, gap: 6 },
  doneIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48,209,88,0.13)', marginBottom: 10 },
  doneTitle: { color: WHITE, fontSize: 26, fontWeight: '700' },
  doneSub: { color: MUTED, fontSize: 15, textAlign: 'center', marginBottom: 12 },
});
