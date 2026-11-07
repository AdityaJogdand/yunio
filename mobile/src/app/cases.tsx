import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cases, review, type Case, type Pair } from '../api';
import { CaseRow, stateOf, TopBar, type State } from '../caseRow';
import { BLACK, card, MUTED, Press, QUIET, RIM, WHITE } from '../ui';

const FILTERS: { key: State | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lost', label: 'Missing' },
  { key: 'found', label: 'Found' },
  { key: 'review', label: 'Maybe matched' },
  { key: 'reunited', label: 'Reunited' },
];

export default function CasesScreen() {
  const insets = useSafeAreaInsets();
  const [all, setAll] = useState<Case[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const params = useLocalSearchParams<{ filter?: State }>();
  const [filter, setFilter] = useState<State | 'all'>(params.filter ?? 'all');

  useFocusEffect(
    useCallback(() => {
      Promise.all([cases(), review()])
        .then(([c, p]) => {
          setAll(c);
          setPairs(p);
        })
        .catch((e) => Alert.alert('Could not load', (e as Error).message));
    }, []),
  );

  // Newest first
  const rows = all
    .map((c) => ({ c, state: stateOf(c, pairs) }))
    .filter((r) => filter === 'all' || r.state === filter)
    .reverse();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <TopBar title="All reports" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Press key={f.key} scale={0.94} onPress={() => setFilter(f.key)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
              </Press>
            );
          })}
        </ScrollView>

        <View style={[card, styles.list]}>
          {rows.length === 0 ? (
            <Text style={styles.empty}>Nothing here yet.</Text>
          ) : (
            rows.map((r, i) => <CaseRow key={r.c.id} c={r.c} state={r.state} first={i === 0} />)
          )}
        </View>
        <Text style={styles.count}>
          {rows.length} of {all.length}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK },
  content: { paddingHorizontal: 20 },
  bleed: { marginHorizontal: -20, marginBottom: 16 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
  chipOn: { backgroundColor: WHITE, borderColor: WHITE },
  chipText: { color: WHITE, fontSize: 14, fontWeight: '500' },
  chipTextOn: { color: BLACK, fontWeight: '700' },
  list: { paddingVertical: 4, paddingHorizontal: 0, borderColor: RIM },
  empty: { color: QUIET, fontSize: 14, padding: 20 },
  count: { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
