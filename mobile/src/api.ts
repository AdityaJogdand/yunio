// Talks to the Yunio backend (Gnani Prisma + Timbre live there, so the API key never ships in the app).
// With no EXPO_PUBLIC_API_URL set, runs in demo mode on synthetic data.
import { File } from 'expo-file-system';

export const API = process.env.EXPO_PUBLIC_API_URL;
export const DEMO = !API;
// Shared camp token the backend checks; it guards the server on the camp Wi-Fi, not the Gnani key.
const AUTH = { 'X-Yunio-Token': process.env.EXPO_PUBLIC_API_TOKEN ?? '' };

export type Kind = 'lost' | 'found';
export type Profile = {
  name: string;
  nickname: string;
  age: string;
  gender: '' | 'F' | 'M';
  clothing: string;
  village: string;
  district: string;
  place: string;
  phone: string;
};
export type Question = { text: string; en: string };
export type Intake = { transcript: string; lang: string; latency: number; profile: Profile; question: Question | null };

export const LANGS = [
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'en-IN', label: 'English' },
];

export const EMPTY: Profile = { name: '', nickname: '', age: '', gender: '', clothing: '', village: '', district: '', place: '', phone: '' };

/** Send a recording; get back what Prisma heard, the fields so far, and the next question to ask (if any).
 *  `history` is the conversation so far as "Person: ..." / "Yunio: ..." lines. */
export async function intake(uri: string, lang: string, kind: Kind, history = ''): Promise<Intake> {
  if (DEMO) return demo(lang, kind);
  const form = new FormData();
  // Expo's fetch only accepts real file objects in FormData, not React Native's {uri, name, type}
  form.append('audio', new File(uri));
  form.append('lang', lang);
  form.append('kind', kind);
  form.append('history', history);
  const r = await fetch(`${API}/api/intake`, { method: 'POST', headers: AUTH, body: form });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `Intake failed (${r.status})`);
  return r.json();
}

/** Reports made on this phone since the app opened, newest last. Home shows their matches first. */
export const mine: string[] = [];

/** Register a confirmed report; returns its receipt number and the closest people on the other side. */
let next = 414;
export async function register(kind: Kind, lang: string, profile: Profile): Promise<{ id: string; matches: Candidate[] }> {
  if (DEMO) {
    const id = `${kind === 'lost' ? 'L' : 'F'}-0${next++}`;
    mine.push(id);
    return { id, matches: [] };
  }
  const r = await fetch(`${API}/api/cases`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, lang, ...profile }),
  });
  if (!r.ok) throw new Error(`Could not save (${r.status})`);
  const saved = await r.json();
  mine.push(saved.id);
  return saved;
}

export type Case = Partial<Omit<Profile, 'age' | 'clothing'>> & {
  id: string;
  kind: Kind;
  clothing?: string | string[]; // seed data stores tags, the app stores what was said
  location?: string; // seed data's name for `place`
  transcript?: string;
  lang?: string;
  camp?: number;
  time?: string;
  age?: string | number;
  status?: 'open' | 'reunited';
};
export type Pair = { lost: Case; found: Case; score: number; reasons: string[] };
export type Announcement = { lang: string; label: string; text: string };

const DEMO_PAIR: Pair = {
  lost: { id: 'L-0412', kind: 'lost', name: 'रामदास यादव', nickname: 'बाबूजी', age: 70, gender: 'M', clothing: 'सफ़ेद धोती कुर्ता', village: 'बहराइच', place: 'रामकुंड', lang: 'hi-IN', camp: 3, time: '06:58' },
  found: { id: 'F-0312', kind: 'found', name: 'रामदास', age: 68, gender: 'M', clothing: 'सफ़ेद धोती', village: 'बहराइच', place: 'Ramkund', lang: 'hi-IN', camp: 2, time: '07:05' },
  score: 0.97,
  reasons: ['name sounds 100% alike', 'village 100%', 'age off by 2', 'wearing dhoti, white'],
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `Request failed (${r.status})`);
  return r.json();
}

/** Every case, newest last. */
export const cases = (): Promise<Case[]> => (DEMO ? Promise.resolve([DEMO_PAIR.lost, DEMO_PAIR.found]) : get('/api/cases'));

/** Likely pairs waiting for a volunteer, best first. */
export const review = (): Promise<Pair[]> => (DEMO ? Promise.resolve([DEMO_PAIR]) : get('/api/review'));

export const pair = (lost: string, found: string): Promise<Pair> =>
  DEMO ? Promise.resolve(DEMO_PAIR) : get(`/api/pair?lost=${lost}&found=${found}`);

/** Template announcements, family's language first. */
export const announcement = (lost: string, found: string): Promise<Announcement[]> =>
  DEMO
    ? Promise.resolve([
        { lang: 'hi-IN', label: 'हिंदी', text: 'बहराइच से आए रामदास यादव के परिवार वाले ध्यान दें। रामदास यादव कैंप नंबर 2 पर सुरक्षित हैं। कृपया वहाँ आएँ।' },
        { lang: 'mr-IN', label: 'मराठी', text: 'बहराइच येथून आलेल्या रामदास यादव यांच्या नातेवाईकांनी लक्ष द्यावे. रामदास यादव कॅम्प क्रमांक 2 येथे सुरक्षित आहेत. कृपया तिथे या.' },
        { lang: 'te-IN', label: 'తెలుగు', text: 'బహరాఇచ్ నుండి వచ్చిన రామదాస్ యాదవ్ కుటుంబ సభ్యులు గమనించండి. రామదాస్ యాదవ్ క్యాంప్ నంబర్ 2 వద్ద సురక్షితంగా ఉన్నారు. దయచేసి అక్కడికి రండి.' },
      ])
    : get(`/api/announce?lost=${lost}&found=${found}`);

async function post(path: string, body: object) {
  if (DEMO) return;
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Could not update (${r.status})`);
}

/** Volunteer confirmed: the family has their person back. */
export const reunite = (lost: string, found: string) => post('/api/reunite', { lost, found });

/** Volunteer says these are different people; the pair stops being suggested. */
export const reject = (lost: string, found: string) => post('/api/reject', { lost, found });

export type Candidate = { id: string; name?: string; score: number; reasons: string[] };

/** Best possible matches for one case, from the other side (lost ↔ found). */
export const caseMatches = (id: string): Promise<Candidate[]> =>
  DEMO
    ? Promise.resolve(id === DEMO_PAIR.lost.id ? [{ id: DEMO_PAIR.found.id, name: DEMO_PAIR.found.name, score: DEMO_PAIR.score, reasons: DEMO_PAIR.reasons }] : [])
    : get(`/api/cases/${id}/matches`);

/** Audio source that speaks text with Timbre, for reading details back to the family. */
export const speechUrl = (text: string, lang: string) =>
  DEMO ? null : { uri: `${API}/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`, headers: AUTH };

const SAMPLES: Record<string, { transcript: string; profile: Partial<Profile> }> = {
  'lost:mr-IN': {
    transcript: 'माझी आजी हरवली आहे. नाव सखुबाई पाटील, सगळे आक्का म्हणतात. वय सत्तर. हिरवी नऊवारी साडी. गाव सिन्नर, जिल्हा नाशिक. रामकुंडाजवळ चुकामूक झाली.',
    profile: { name: 'सखुबाई पाटील', nickname: 'आक्का', age: '70', gender: 'F', clothing: 'हिरवी नऊवारी साडी', village: 'सिन्नर', district: 'नाशिक', place: 'रामकुंड', phone: '98XXX-00001' },
  },
  'lost:hi-IN': {
    transcript: 'मेरे बाबूजी रामदास यादव खो गए हैं, सत्तर साल के हैं, सफ़ेद धोती कुर्ता पहने हैं, बहराइच से आए हैं, रामकुंड पर बिछड़ गए।',
    profile: { name: 'रामदास यादव', nickname: 'बाबूजी', age: '70', gender: 'M', clothing: 'सफ़ेद धोती कुर्ता', village: 'बहराइच', district: 'बहराइच', place: 'रामकुंड', phone: '98XXX-00002' },
  },
  'found:mr-IN': {
    transcript: 'एक आजी सापडल्या आहेत, सत्तरीच्या असतील, हिरवी साडी, नाव सखुबाई सांगतात, सिन्नरच्या आहेत. काळाराम मंदिराजवळ बसल्या होत्या.',
    profile: { name: 'सखुबाई', age: '70', gender: 'F', clothing: 'हिरवी साडी', village: 'सिन्नर', place: 'काळाराम मंदिर' },
  },
  'found:hi-IN': {
    transcript: 'एक बुज़ुर्ग आदमी मिले हैं, नाम रामदास बता रहे हैं, सफ़ेद धोती, गाँव बहराइच, रामकुंड के पास मिले।',
    profile: { name: 'रामदास', age: '68', gender: 'M', clothing: 'सफ़ेद धोती', village: 'बहराइच', place: 'रामकुंड' },
  },
};

async function demo(lang: string, kind: Kind): Promise<Intake> {
  await new Promise((r) => setTimeout(r, 1400));
  const s = SAMPLES[`${kind}:${lang}`] ?? SAMPLES[`${kind}:hi-IN`];
  return { transcript: s.transcript, lang: SAMPLES[`${kind}:${lang}`] ? lang : 'hi-IN', latency: 0.8, profile: { ...EMPTY, ...s.profile }, question: null };
}
