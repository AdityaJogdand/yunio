import { router } from 'expo-router';
import { CaretLeftIcon as CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon as CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LANGS, type Case, type Pair } from './api';
import { FOUND, LOST, Press, QUIET, REVIEW, RIM, WHITE } from './ui';

export type State = 'lost' | 'found' | 'review' | 'reunited';
export const DOT: Record<State, string> = { lost: LOST, found: FOUND, review: REVIEW, reunited: WHITE };
export const STATE: Record<State, string> = { lost: 'Missing', found: 'Found', review: 'Maybe matched', reunited: 'Reunited' };

export const langLabel = (code?: string) => LANGS.find((l) => l.code === code)?.label ?? '';

/** Field as text: seed data keeps clothing as tags, the app keeps what was said */
export const show = (v: unknown) => (Array.isArray(v) ? v.join(' ') : v ? String(v) : '');

/** What a case's row should say, given the pairs waiting for review */
export function stateOf(c: Case, pairs: Pair[]): State {
  if (c.status === 'reunited') return 'reunited';
  return pairs.some((p) => p.lost.id === c.id || p.found.id === c.id) ? 'review' : c.kind;
}

export function CaseRow({ c, state, first }: { c: Case; state: State; first?: boolean }) {
  return (
    <Press
      scale={0.98}
      style={[styles.row, !first && styles.rule]}
      onPress={() => router.push({ pathname: '/case', params: { id: c.id } })}
      accessibilityLabel={`${STATE[state]}: ${c.name}. Open details`}>
      <View style={[styles.dot, { backgroundColor: DOT[state], boxShadow: `0 0 10px ${DOT[state]}` }]} />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {c.name || '—'}
        </Text>
        <Text style={styles.meta}>{[langLabel(c.lang), c.camp && `Camp ${c.camp}`, c.time].filter(Boolean).join(' · ')}</Text>
      </View>
      <Text style={[styles.state, { color: DOT[state] }]}>{STATE[state]}</Text>
      <CaretRight size={14} color={QUIET} weight="bold" />
    </Press>
  );
}

/** Back button, centred title, optional right-hand slot */
export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <Press style={styles.back} scale={0.9} onPress={() => router.back()} accessibilityLabel="Back">
        <CaretLeft size={20} color={WHITE} weight="bold" />
      </Press>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, minHeight: 64 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: RIM },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: WHITE, fontSize: 16, fontWeight: '500' },
  meta: { color: QUIET, fontSize: 12, marginTop: 2 },
  state: { fontSize: 13, fontWeight: '600' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  topTitle: { color: WHITE, fontSize: 17, fontWeight: '600' },
  side: { width: 44, alignItems: 'center' },
});
