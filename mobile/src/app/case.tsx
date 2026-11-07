import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CaretRightIcon as CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { caseMatches, cases, review, type Candidate, type Case, type Pair } from '../api';
import { DOT, langLabel, show, STATE, stateOf, TopBar } from '../caseRow';
import { BLACK, card, MUTED, Press, QUIET, RIM, ROUNDED, WHITE } from '../ui';

const FIELDS: { label: string; get: (c: Case) => unknown }[] = [
  { label: 'Also called', get: (c) => c.nickname },
  { label: 'Age', get: (c) => c.age },
  { label: 'Wearing', get: (c) => c.clothing },
  { label: 'Village', get: (c) => c.village },
  { label: 'District', get: (c) => c.district },
  { label: 'Where', get: (c) => c.place ?? c.location },
  { label: 'Family phone', get: (c) => c.phone },
  { label: 'Language', get: (c) => langLabel(c.lang) },
  { label: 'Reported', get: (c) => [c.camp && `Camp ${c.camp}`, c.time].filter(Boolean).join(' · ') },
];

export default function CaseScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<Case>();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [matches, setMatches] = useState<Candidate[]>([]);

  // Reload on focus: coming back from a match screen may have changed the status
  useFocusEffect(
    useCallback(() => {
      Promise.all([cases(), review(), caseMatches(id)])
        .then(([all, p, m]) => {
          setC(all.find((x) => x.id === id));
          setPairs(p);
          setMatches(m.filter((x) => x.score >= 0.4)); // below this they're noise to a volunteer
        })
        .catch((e) => Alert.alert('Could not load', (e as Error).message));
    }, [id]),
  );

  const state = c && stateOf(c, pairs);
  const open = (m: Candidate) =>
    c && router.push({ pathname: '/match', params: c.kind === 'lost' ? { lost: c.id, found: m.id } : { lost: m.id, found: c.id } });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <TopBar title={c?.kind === 'found' ? 'Found person' : 'Missing person'} />
        {!c || !state ? (
          <ActivityIndicator color={WHITE} style={styles.loading} />
        ) : (
          <>
            <Text style={[styles.state, { color: DOT[state] }]}>{STATE[state]}</Text>
            <Text style={styles.name}>{c.name || '—'}</Text>
            <Text style={styles.id}>Report {c.id}</Text>

            <View style={[card, styles.gap]}>
              {FIELDS.map((f) => ({ ...f, value: show(f.get(c)) }))
                .filter((f) => f.value)
                .map((f, i) => (
                  <View key={f.label} style={[styles.field, i > 0 && styles.rule]}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <Text style={styles.fieldValue}>{f.value}</Text>
                  </View>
                ))}
            </View>

            {c.transcript && (
              <View style={[card, styles.gap]}>
                <Text style={styles.cardTitle}>What was said</Text>
                <Text style={styles.transcript}>{c.transcript}</Text>
              </View>
            )}

            {c.status !== 'reunited' && (
              <>
                <Text style={styles.section}>Could be</Text>
                <View style={[card, styles.list]}>
                  {matches.length === 0 ? (
                    <Text style={styles.empty}>No one similar yet. New reports are checked automatically.</Text>
                  ) : (
                    matches.map((m, i) => (
                      <Press key={m.id} scale={0.98} style={[styles.match, i > 0 && styles.rule]} onPress={() => open(m)} accessibilityLabel={`${m.name}, ${Math.round(m.score * 100)} percent likely. Compare`}>
                        <View style={styles.flex}>
                          <Text style={styles.matchName}>{m.name || '—'}</Text>
                          <Text style={styles.matchWhy} numberOfLines={1}>
                            {m.reasons.join(' · ')}
                          </Text>
                        </View>
                        <Text style={styles.matchScore}>{Math.round(m.score * 100)}%</Text>
                        <CaretRight size={14} color={QUIET} weight="bold" />
                      </Press>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1 },
  loading: { marginTop: 80 },
  gap: { marginTop: 16 },

  state: { fontSize: 13, fontWeight: '700' },
  name: { color: WHITE, fontSize: 30, lineHeight: 42, fontWeight: '700', marginTop: 2 },
  id: { color: QUIET, fontSize: 13, fontFamily: ROUNDED },

  field: { flexDirection: 'row', paddingVertical: 12 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: RIM },
  fieldLabel: { width: 110, color: QUIET, fontSize: 14 },
  fieldValue: { flex: 1, color: WHITE, fontSize: 16 },

  cardTitle: { color: WHITE, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  transcript: { color: MUTED, fontSize: 16, lineHeight: 25 },

  section: { color: WHITE, fontSize: 21, fontWeight: '600', letterSpacing: -0.3, marginTop: 32, marginBottom: 14 },
  list: { paddingVertical: 4, paddingHorizontal: 0 },
  empty: { color: QUIET, fontSize: 14, padding: 20 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  matchName: { color: WHITE, fontSize: 16, fontWeight: '500' },
  matchWhy: { color: QUIET, fontSize: 12, marginTop: 2 },
  matchScore: { color: WHITE, fontSize: 17, fontWeight: '600', fontFamily: ROUNDED },
});
