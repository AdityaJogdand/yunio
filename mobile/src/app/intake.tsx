import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { CaretLeftIcon as CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CheckIcon as Check } from 'phosphor-react-native/src/icons/Check';
import { MicrophoneIcon as Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { SpeakerHighIcon as SpeakerHigh } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { StopIcon as Stop } from 'phosphor-react-native/src/icons/Stop';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEMO, EMPTY, intake, LANGS, register, speechUrl, type Candidate, type Intake, type Kind, type Profile, type Question } from '../api';
import { BLACK, card, FOUND, LOST, MUTED, Press, QUIET, RIM, ROUNDED, TRACK, WHITE } from '../ui';

// Prisma's REST endpoint takes clips up to 30 s
const MAX_SEC = 30;

type Phase = 'ready' | 'recording' | 'listening' | 'review' | 'saved';
// One line of the desk conversation: what the person said, or the follow-up Yunio asked
type Turn = { who: 'person' | 'yunio'; text: string; en?: string };

const PROMPTS: Record<Kind, string[]> = {
  lost: ['Name, and what family calls them', 'Age, man or woman', 'What they are wearing', 'Village and district', 'Where you got separated'],
  found: ['Name, if they can say it', 'Age, man or woman', 'What they are wearing', 'Village, if they know it', 'Where they were found'],
};

// extra: only shown when the recording filled it in, to keep the form short
const FIELDS: { key: keyof Profile; label: string; lostOnly?: boolean; numeric?: boolean; extra?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'nickname', label: 'Also called', extra: true },
  { key: 'age', label: 'Age', numeric: true },
  { key: 'clothing', label: 'Wearing' },
  { key: 'village', label: 'Village / town' },
  { key: 'district', label: 'District', extra: true },
  { key: 'place', label: 'Where' },
  { key: 'phone', label: 'Family phone', lostOnly: true, numeric: true },
];

export default function IntakeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: Kind }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'found' ? 'found' : 'lost');
  const [lang, setLang] = useState('mr-IN');
  const [phase, setPhase] = useState<Phase>('ready');
  const [heard, setHeard] = useState<Intake>();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [receipt, setReceipt] = useState('');
  const [likely, setLikely] = useState<Candidate>(); // best match found the moment the report was saved
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false); // Timbre is preparing the question's audio

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const color = kind === 'lost' ? LOST : FOUND;

  // Spinner until the question is actually heard; give up quietly if the voice never comes
  useEffect(() => {
    if (status.playing) setAsking(false);
  }, [status.playing]);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 15000);
    return () => clearTimeout(t);
  }, [asking]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  }, []);

  // The recorder stops itself at MAX_SEC; pick that up like a manual stop
  useEffect(() => {
    if (phase === 'recording' && !rec.isRecording && rec.durationMillis > 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.isRecording]);

  /** Resolves true once the mic is actually recording */
  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone needed', 'Allow the microphone in Settings to record the report.');
      return false;
    }
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_SEC });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('recording');
    return true;
  }

  async function finish() {
    if (recorder.isRecording) await recorder.stop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('listening');
    try {
      // The server re-reads the whole conversation, so answers fill the gaps left by earlier turns
      const history = turns.map((t) => `${t.who === 'person' ? 'Person' : 'Yunio'}: ${t.text}`).join('\n');
      const res = await intake(recorder.uri ?? '', lang, kind, history);
      setHeard(res);
      setProfile(res.profile);
      const next: Turn[] = [...turns, { who: 'person', text: res.transcript }];
      if (res.question) {
        setTurns([...next, { who: 'yunio', text: res.question.text, en: res.question.en }]);
        setPhase('ready');
        ask(res.question);
      } else {
        setTurns(next);
        setPhase('review');
      }
    } catch (e) {
      Alert.alert('Could not hear that', `${(e as Error).message}. Try recording again.`);
      setPhase('ready');
    }
  }

  function ask(q: Question) {
    // Timbre asks out loud, in their language; the text stays on screen for the volunteer
    const uri = speechUrl(q.text, lang);
    if (!uri) return;
    setAsking(true);
    player.replace(uri);
    player.play();
  }

  function playBack() {
    // Timbre reads the details back in the family's language; in demo mode, replay the recording
    const summary = [profile.name, profile.age && `${profile.age}`, profile.clothing, profile.village, profile.place].filter(Boolean).join(', ');
    const uri = speechUrl(summary, heard?.lang ?? lang) ?? recorder.uri;
    if (!uri) return;
    player.replace(uri);
    player.play();
  }

  async function save() {
    if (!profile.name && !profile.clothing) return Alert.alert('Add a name or what they are wearing', 'Matching needs at least one of these.');
    try {
      const saved = await register(kind, heard?.lang ?? lang, profile);
      setReceipt(saved.id);
      setLikely(saved.matches.find((m) => m.score >= 0.6)); // same bar the server uses for review
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('saved');
    } catch (e) {
      Alert.alert('Not saved', (e as Error).message);
    }
  }

  function reset() {
    setHeard(undefined);
    setProfile(EMPTY);
    setReceipt('');
    setLikely(undefined);
    setTurns([]);
    setPhase('ready');
  }

  const locked = phase !== 'ready' || turns.length > 0;
  const lastQuestion = turns.at(-1)?.who === 'yunio' ? turns.at(-1) : undefined;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Press style={styles.back} scale={0.9} onPress={() => router.back()} accessibilityLabel="Back">
            <CaretLeft size={20} color={WHITE} weight="bold" />
          </Press>
          <Text style={styles.topTitle}>New report</Text>
          {DEMO ? (
            <View style={styles.demo}>
              <Text style={styles.demoText}>Demo</Text>
            </View>
          ) : (
            <View style={styles.backSpacer} />
          )}
        </View>

        {phase === 'saved' ? (
          <Saved receipt={receipt} kind={kind} color={color} likely={likely} onAnother={reset} />
        ) : (
          <>
            {/* Missing or found */}
            <View style={[styles.segment, locked && styles.dim]}>
              {(['lost', 'found'] as const).map((k) => {
                const on = kind === k;
                return (
                  <Press key={k} disabled={locked} scale={0.97} onPress={() => setKind(k)} style={[styles.segItem, on && styles.segOn]} accessibilityState={{ selected: on }}>
                    <Text style={[styles.segText, on && styles.segTextOn]}>{k === 'lost' ? 'हरवले · Missing' : 'सापडले · Found'}</Text>
                  </Press>
                );
              })}
            </View>

            {/* Language: chosen, not guessed (Hindi and Marathi share a script) */}
            <Text style={styles.label}>Which language do they speak?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.langs}>
              {LANGS.map((l) => {
                const on = lang === l.code;
                return (
                  <Press key={l.code} disabled={locked} scale={0.94} onPress={() => setLang(l.code)} style={[styles.lang, on && styles.langOn, locked && !on && styles.dim]} accessibilityState={{ selected: on }}>
                    <Text style={[styles.langText, on && styles.langTextOn]}>{l.label}</Text>
                  </Press>
                );
              })}
            </ScrollView>

            {phase === 'review' && heard ? (
              <Review
                heard={heard}
                said={turns.filter((t) => t.who === 'person').map((t) => t.text).join(' ')}
                profile={profile}
                setProfile={setProfile}
                kind={kind}
                onPlay={playBack}
                onRedo={reset}
                onSave={save}
              />
            ) : (
              <>
                {turns.length > 0 && <Conversation turns={turns} asking={asking} onReplay={() => lastQuestion && ask({ text: lastQuestion.text, en: lastQuestion.en ?? '' })} />}
                <Recorder
                  phase={phase}
                  kind={kind}
                  color={color}
                  answering={turns.length > 0}
                  seconds={Math.floor(rec.durationMillis / 1000)}
                  onStart={start}
                  onStop={finish}
                />
                {turns.length > 0 && phase === 'ready' && (
                  <Press style={[styles.secondary, styles.doneBtn]} onPress={() => setPhase('review')} accessibilityLabel="Stop asking and check the details">
                    <Check size={18} color={WHITE} weight="bold" />
                    <Text style={styles.secondaryText}>Done · check details</Text>
                  </Press>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Conversation({ turns, asking, onReplay }: { turns: Turn[]; asking: boolean; onReplay: () => void }) {
  return (
    <View style={styles.thread}>
      {turns.map((t, i) =>
        t.who === 'person' ? (
          <Animated.View key={i} entering={FadeInDown.duration(300)} style={styles.said}>
            <Text style={styles.saidLabel}>They said</Text>
            <Text style={styles.saidText}>{t.text}</Text>
          </Animated.View>
        ) : (
          <Animated.View key={i} entering={FadeInDown.duration(300)} style={styles.asked}>
            <View style={styles.askedHead}>
              <Text style={styles.askedLabel}>Yunio asks</Text>
              {i === turns.length - 1 && (
                <Press style={styles.replay} scale={0.92} disabled={asking} onPress={onReplay} accessibilityLabel={asking ? 'Preparing the question' : 'Ask again out loud'}>
                  {asking ? <ActivityIndicator size="small" color={BLACK} /> : <SpeakerHigh size={16} color={BLACK} weight="fill" />}
                </Press>
              )}
            </View>
            <Text style={styles.askedText}>{t.text}</Text>
            {t.en && <Text style={styles.askedEn}>{t.en}</Text>}
          </Animated.View>
        ),
      )}
    </View>
  );
}

// Held longer than this = walkie-talkie: recording stops when the finger lifts. Shorter = a tap that toggles.
const HOLD_MS = 400;

function Recorder({ phase, kind, color, answering, seconds, onStart, onStop }: { phase: Phase; kind: Kind; color: string; answering: boolean; seconds: number; onStart: () => Promise<boolean>; onStop: () => void }) {
  // pending: finger down, started recording, not yet a tap or a hold. stopping: finger down on a running recording.
  const press = useRef<{ mode: 'idle' | 'pending' | 'stopping'; at: number; started?: Promise<boolean> }>({ mode: 'idle', at: 0 });
  const [holding, setHolding] = useState(false);

  function down() {
    if (phase === 'recording') press.current = { mode: 'stopping', at: Date.now() };
    else if (phase === 'ready') {
      press.current = { mode: 'pending', at: Date.now(), started: onStart().catch(() => false) };
      setHolding(true);
    }
  }

  async function up() {
    const { mode, at, started } = press.current;
    press.current = { mode: 'idle', at: 0 };
    setHolding(false);
    if (mode === 'stopping') onStop();
    // Held: wait for the mic to have really started, then send. Tapped: keep recording until the next tap.
    else if (mode === 'pending' && Date.now() - at >= HOLD_MS && (await started)) onStop();
  }

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (phase === 'recording') pulse.set(withRepeat(withTiming(1.35, { duration: 900 }), -1, true));
    else {
      cancelAnimation(pulse);
      pulse.set(withTiming(1));
    }
  }, [phase, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }], opacity: 2 - pulse.get() * 1.2 }));
  const recording = phase === 'recording';
  const listening = phase === 'listening';

  return (
    <Animated.View entering={FadeIn} style={[card, styles.recCard]}>
      <View style={styles.micWrap}>
        <Animated.View style={[styles.micRing, { borderColor: color }, ring]} />
        <Press
          style={[styles.mic, recording && { backgroundColor: color }]}
          scale={0.92}
          disabled={listening}
          onPressIn={down}
          onPressOut={up}
          accessibilityLabel={recording ? 'Stop recording and send' : 'Record. Tap to start, or press and hold to talk'}>
          {listening ? <ActivityIndicator color={BLACK} /> : recording ? <Stop size={34} color={WHITE} weight="fill" /> : <Microphone size={38} color={BLACK} weight="fill" />}
        </Press>
      </View>

      <Text style={styles.recState}>
        {listening ? 'Listening…' : recording ? (holding ? 'Let go to send' : 'Tap to stop and send') : answering ? 'Record their answer' : 'Tap to record, or hold to talk'}
      </Text>
      <Text style={styles.timer}>
        {recording ? `0:${String(seconds).padStart(2, '0')}` : listening ? 'Writing down what they said' : answering ? "Tap or hold the mic. If they don't know, tap Done" : 'Hold the phone towards them'}
      </Text>
      {recording && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(100 * seconds) / MAX_SEC}%`, backgroundColor: color }]} />
        </View>
      )}

      {!answering && <View style={styles.prompts}>
        <Text style={styles.promptsTitle}>{kind === 'lost' ? 'Ask the family about' : 'Tell us about them'}</Text>
        {PROMPTS[kind].map((p) => (
          <View key={p} style={styles.prompt}>
            <View style={styles.promptDot} />
            <Text style={styles.promptText}>{p}</Text>
          </View>
        ))}
      </View>}
    </Animated.View>
  );
}

function Review(props: { heard: Intake; said: string; profile: Profile; setProfile: (p: Profile) => void; kind: Kind; onPlay: () => void; onRedo: () => void; onSave: () => void }) {
  const { heard, profile, setProfile, kind } = props;
  const set = (k: keyof Profile, v: string) => setProfile({ ...profile, [k]: v });
  const langLabel = LANGS.find((l) => l.code === heard.lang)?.label ?? heard.lang;

  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      <View style={card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>What we heard</Text>
          <Text style={styles.cardNote}>{langLabel}</Text>
        </View>
        <Text style={styles.transcript}>{props.said || heard.transcript}</Text>
      </View>

      <View style={[card, styles.gap]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Is this right?</Text>
          <Text style={styles.cardNote}>Tap any line to fix it</Text>
        </View>

        <View style={styles.genderRow}>
          {(['F', 'M'] as const).map((g) => {
            const on = profile.gender === g;
            return (
              <Press key={g} scale={0.96} onPress={() => set('gender', on ? '' : g)} style={[styles.gender, on && styles.genderOn]} accessibilityState={{ selected: on }}>
                <Text style={[styles.genderText, on && styles.genderTextOn]}>{g === 'F' ? 'Woman / girl' : 'Man / boy'}</Text>
              </Press>
            );
          })}
        </View>

        {FIELDS.filter((f) => (!f.lostOnly || kind === 'lost') && (!f.extra || heard.profile[f.key])).map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile[f.key]}
              onChangeText={(v) => set(f.key, v)}
              placeholder="—"
              placeholderTextColor={QUIET}
              keyboardType={f.numeric ? 'phone-pad' : 'default'}
              accessibilityLabel={f.label}
            />
          </View>
        ))}
      </View>

      <View style={styles.secondaryRow}>
        <Press style={styles.secondary} onPress={props.onPlay} accessibilityLabel="Read the details back to the family">
          <SpeakerHigh size={18} color={WHITE} weight="fill" />
          <Text style={styles.secondaryText}>Read aloud</Text>
        </Press>
        <Press style={styles.secondary} onPress={props.onRedo} accessibilityLabel="Record again">
          <ArrowCounterClockwise size={18} color={WHITE} weight="bold" />
          <Text style={styles.secondaryText}>Record again</Text>
        </Press>
      </View>
      <Text style={styles.hint}>Read it aloud so the family can say yes.</Text>

      <Press style={styles.primary} onPress={props.onSave} accessibilityLabel="Save the report">
        <Check size={20} color={BLACK} weight="bold" />
        <Text style={styles.primaryText}>Family says yes · Save</Text>
      </Press>
    </Animated.View>
  );
}

function Saved({ receipt, kind, color, likely, onAnother }: { receipt: string; kind: Kind; color: string; likely?: Candidate; onAnother: () => void }) {
  const compare = () =>
    likely && router.replace({ pathname: '/match', params: kind === 'lost' ? { lost: receipt, found: likely.id } : { lost: likely.id, found: receipt } });
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.saved}>
      <View style={[styles.savedIcon, { backgroundColor: `${color}22` }]}>
        <Check size={34} color={color} weight="bold" />
      </View>
      <Text style={styles.savedTitle}>{kind === 'lost' ? 'Report saved' : 'Saved'}</Text>
      <Text style={styles.savedSub}>{kind === 'lost' ? 'Give this number to the family' : 'Keep this number with the person'}</Text>
      <View style={[card, styles.receipt]}>
        <Text style={styles.receiptLabel}>REPORT NUMBER</Text>
        <Text style={styles.receiptValue}>{receipt}</Text>
      </View>
      {likely ? (
        <View style={[card, styles.likely]}>
          <Text style={styles.likelyLabel}>{kind === 'lost' ? 'Someone like this was found' : 'A family is looking for someone like this'}</Text>
          <View style={styles.likelyRow}>
            <Text style={styles.likelyName} numberOfLines={1}>
              {likely.name || '—'}
            </Text>
            <Text style={styles.likelyScore}>{Math.round(likely.score * 100)}%</Text>
          </View>
          <Text style={styles.likelyWhy}>{likely.reasons.join(' · ')}</Text>
          <Press style={styles.primary} onPress={compare} accessibilityLabel="Compare the two reports now">
            <Text style={styles.primaryText}>Is this the same person?</Text>
          </Press>
        </View>
      ) : (
        <Text style={styles.savedNote}>We are now checking every camp. If we find them, you will see it on the home screen first.</Text>
      )}
      <Press style={[likely ? styles.secondary : styles.primary, styles.full]} onPress={onAnother}>
        <Text style={likely ? styles.secondaryText : styles.primaryText}>New report</Text>
      </Press>
      <Press style={[styles.secondary, styles.full]} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>Back to home</Text>
      </Press>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK },
  content: { paddingHorizontal: 20 },
  dim: { opacity: 0.4 },
  gap: { marginTop: 12 },
  full: { alignSelf: 'stretch', flex: 0, marginTop: 12 },
  bleed: { marginHorizontal: -20 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  backSpacer: { width: 44 },
  topTitle: { color: WHITE, fontSize: 17, fontWeight: '600' },
  demo: { width: 44, alignItems: 'center' },
  demoText: { color: QUIET, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },

  segment: { flexDirection: 'row', backgroundColor: '#141414', borderRadius: 999, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: RIM },
  segItem: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: WHITE },
  segText: { color: MUTED, fontSize: 15, fontWeight: '600' },
  segTextOn: { color: BLACK },

  label: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 22, marginBottom: 10 },
  langs: { paddingHorizontal: 20, gap: 8 },
  lang: { height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
  langOn: { backgroundColor: WHITE, borderColor: WHITE },
  langText: { color: WHITE, fontSize: 15, fontWeight: '500' },
  langTextOn: { color: BLACK, fontWeight: '700' },

  recCard: { marginTop: 18, alignItems: 'center', paddingVertical: 32 },

  thread: { marginTop: 18, gap: 10 },
  said: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: '#161616', borderRadius: 20, borderCurve: 'continuous', padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: RIM },
  saidLabel: { color: QUIET, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  saidText: { color: WHITE, fontSize: 16, lineHeight: 24 },
  asked: { alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: WHITE, borderRadius: 20, borderCurve: 'continuous', padding: 14 },
  askedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  askedLabel: { color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: '600' },
  replay: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)' },
  askedText: { color: BLACK, fontSize: 18, lineHeight: 27, fontWeight: '600' },
  askedEn: { color: 'rgba(0,0,0,0.55)', fontSize: 13, marginTop: 4 },
  micWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  micRing: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 2 },
  mic: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, boxShadow: '0 8px 30px rgba(255,255,255,0.15)' },
  recState: { color: WHITE, fontSize: 18, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  timer: { color: QUIET, fontSize: 14, marginTop: 4, fontFamily: ROUNDED, fontVariant: ['tabular-nums'] },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: TRACK, marginTop: 16, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  prompts: { alignSelf: 'stretch', marginTop: 28, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.14)', gap: 10 },
  promptsTitle: { color: MUTED, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promptDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: QUIET },
  promptText: { color: WHITE, fontSize: 15 },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  cardTitle: { color: WHITE, fontSize: 17, fontWeight: '600' },
  cardNote: { color: QUIET, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  transcript: { color: WHITE, fontSize: 17, lineHeight: 27 },

  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  gender: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
  genderOn: { backgroundColor: WHITE, borderColor: WHITE },
  genderText: { color: WHITE, fontSize: 14, fontWeight: '500' },
  genderTextOn: { color: BLACK, fontWeight: '700' },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: RIM },
  fieldLabel: { width: 110, color: QUIET, fontSize: 14 },
  fieldInput: { flex: 1, color: WHITE, fontSize: 16, paddingVertical: 12 },

  secondaryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondary: { flex: 1, flexDirection: 'row', gap: 8, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', borderWidth: StyleSheet.hairlineWidth, borderColor: RIM },
  doneBtn: { flex: 0, marginTop: 12 },
  secondaryText: { color: WHITE, fontSize: 15, fontWeight: '600' },
  hint: { color: QUIET, fontSize: 13, textAlign: 'center', marginTop: 12 },
  primary: { flexDirection: 'row', gap: 8, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, marginTop: 14 },
  primaryText: { color: BLACK, fontSize: 17, fontWeight: '700' },

  saved: { alignItems: 'center', paddingTop: 24, gap: 6 },
  savedIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  savedTitle: { color: WHITE, fontSize: 26, fontWeight: '700' },
  savedSub: { color: MUTED, fontSize: 15 },
  receipt: { alignSelf: 'stretch', alignItems: 'center', marginTop: 18, paddingVertical: 28 },
  receiptLabel: { color: QUIET, fontSize: 12, fontWeight: '600', letterSpacing: 1.4 },
  receiptValue: { color: WHITE, fontSize: 56, fontWeight: '600', fontFamily: ROUNDED, letterSpacing: -1, marginTop: 4 },
  likely: { alignSelf: 'stretch', marginTop: 14 },
  likelyLabel: { color: FOUND, fontSize: 13, fontWeight: '700' },
  likelyRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  likelyName: { flex: 1, color: WHITE, fontSize: 22, lineHeight: 32, fontWeight: '700' },
  likelyScore: { color: WHITE, fontSize: 22, fontWeight: '600', fontFamily: ROUNDED },
  likelyWhy: { color: MUTED, fontSize: 14, marginTop: 2 },
  savedNote: { color: QUIET, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 14, marginBottom: 10, paddingHorizontal: 12 },
});
