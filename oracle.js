// The 8.5 Ball oracle engine.
// Pure functions, no DOM. Three promises it keeps:
//   1. It reads the shape of your question and answers in kind.
//   2. Same question, same day, same answer. The future doesn't reroll.
//   3. It always says, somewhere in its reasoning, that it can't see the future.

// Each answer carries a nominal confidence (0–100). It's a guess about a guess.
export const ANSWERS = {
  should: [
    ['Yes. Start smaller than you planned.', 71],
    ['Yes, if you’d still want it with nobody watching.', 64],
    ['Not yet. Get one more fact first.', 58],
    ['No. You’re asking because you already know.', 67],
    ['Do the reversible version first.', 74],
    ['Yes, and tell someone today so it’s real.', 69],
    ['Sleep on it. Then do what you think of at 6 a.m.', 55],
    ['Only if the boring parts still appeal.', 62],
    ['Yes. The cost of waiting is higher than it looks.', 60],
    ['No, but the version next to it is a yes.', 57],
  ],
  will: [
    ['Likely. Not on your schedule.', 63],
    ['Yes, in a form you won’t recognize at first.', 54],
    ['The odds are better than your mood suggests.', 61],
    ['Unlikely as stated. Rephrase the dream.', 59],
    ['It hinges on a conversation you haven’t had yet.', 66],
    ['Yes, and it will cost more than you budgeted.', 58],
    ['No. Something better is crowding it out.', 52],
    ['Too close to call. That’s information too.', 50],
    ['Probably, if you keep showing up.', 68],
  ],
  when: [
    ['Sooner than your calendar admits.', 56],
    ['Right after the thing you’re avoiding.', 72],
    ['On a Tuesday. Most things happen on a Tuesday.', 41],
    ['When you stop refreshing.', 63],
    ['Later than you hope, earlier than you fear.', 66],
    ['The moment you write it down.', 59],
    ['Not this season. Next one looks better.', 52],
  ],
  why: [
    ['Because it mattered to someone, once.', 60],
    ['Incentives. It’s nearly always incentives.', 74],
    ['You may be asking the wrong why.', 57],
    ['The reason is boring. The consequence isn’t.', 62],
    ['Because nobody stopped it early.', 65],
    ['Habit, wearing a reason as a costume.', 58],
  ],
  how: [
    ['Badly at first. That’s the method.', 77],
    ['One reversible step at a time.', 73],
    ['Ask someone who’s done it twice.', 70],
    ['Make the smallest version that embarrasses you.', 68],
    ['Write the steps down. The hard one will announce itself.', 71],
    ['Slower than you want, faster than you think.', 60],
  ],
  open: [
    ['The first one you thought of.', 61],
    ['Closer than you’re looking.', 58],
    ['Not who you’d pick. Who’d pick you.', 55],
    ['Whatever you’d defend without notes.', 63],
    ['The quiet option. It’s been waiting.', 52],
    ['The one that scares you a reasonable amount.', 60],
  ],
  yesno: [
    ['Yes.', 70],
    ['Most signs say yes.', 64],
    ['No, and that’s fine.', 62],
    ['Probably not. Check the premise.', 57],
    ['Yes, with one condition you won’t like.', 59],
    ['It’s a no from me, but I’m a ball.', 48],
    ['Signs point sideways.', 38],
    ['Unclear. The fluid is cloudy on this one.', 33],
    ['Yes, more than you’d expect.', 66],
  ],
};

const FORM_LINES = {
  should: 'A “should” question. You want permission more than a forecast.',
  will: 'A “will” question. That’s a forecast, the hard kind.',
  when: 'A “when” question. Timelines are where oracles go to die.',
  why: 'A “why” question. That’s about the past, which helps.',
  how: 'A “how” question. Method, not prophecy. Good.',
  open: 'An open question. I’ll narrow it to one answer anyway.',
  yesno: 'A yes-or-no question. The classic format.',
  empty: 'No question typed. I’ll answer the one you’re thinking.',
};

const HONESTY_LINES = [
  'Checking for actual foresight… none found.',
  'Looking into the future… access denied, as usual.',
  'Searching for a time machine… still not invented.',
  'Consulting the future directly… it isn’t answering.',
];

const STOPWORDS = new Set(('about above after again against because before being below between could does doing during every from further going have having here into itself just more most other ought over same should some such than that their theirs them then there these they this those through under until very what when where which while whom with would your yours yourself really maybe something anything thing things today tomorrow').split(' '));

const ORDINAL = ['', 'once', 'twice', 'three times', 'four times', 'five times', 'six times', 'seven times'];

export function normalize(q) {
  return (q || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// FNV-1a, 32-bit. Deterministic so the same question lands on the same answer.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function dayKey(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function classify(q) {
  const n = normalize(q);
  if (!n) return 'empty';
  if (/^(should|shall|ought|is it worth|would it be wise|do i need to)\b/.test(n)) return 'should';
  if (/^(when|how long|how soon|what time|what day|what year)\b/.test(n)) return 'when';
  if (/^why\b/.test(n)) return 'why';
  if (/^how\b/.test(n)) return 'how';
  if (/^(will|would|could)\b/.test(n) || /\b(going to|gonna)\b/.test(n)) return 'will';
  if (/^(who|whom|whose|what|which|where)\b/.test(n)) return 'open';
  return 'yesno';
}

function keyword(n) {
  const words = n.split(' ').filter(w => w.length > 4 && !STOPWORDS.has(w));
  if (!words.length) return null;
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}

// asks: how many times this exact question has been asked today, including now.
export function consult(question, { date = new Date(), asks = 1 } = {}) {
  const n = normalize(question);
  const form = classify(question);
  const pool = ANSWERS[form === 'empty' ? 'yesno' : form];
  const day = dayKey(date);
  const h = hash(`${n}|${day}`);
  const [answer, base] = pool[h % pool.length];
  const jitter = (hash(`${day}|${n}|c`) % 11) - 5;
  const confidence = Math.max(12, Math.min(88, base + jitter));

  const trace = [FORM_LINES[form]];
  trace.push(HONESTY_LINES[hash(`${n}|h`) % HONESTY_LINES.length]);
  const kw = keyword(n);
  trace.push(kw
    ? `Noticing the word “${kw}.” Weighing it.`
    : 'Weighing the odds with what I have: fluid, and a die.');
  if (asks > 1) {
    const times = ORDINAL[asks] || `${asks} times`;
    trace.push(`You’ve asked this ${times} today. The future doesn’t reroll.`);
  }
  trace.push('Answering anyway. That’s the deal.');

  return { form, answer, confidence, trace, repeat: asks > 1, key: n };
}
