import { consult, normalize, dayKey } from './oracle.js';
import { createBall } from './ball.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off: fine */ } },
};

let asks = store.get('ball85.asks', null);
if (!asks || asks.day !== dayKey()) asks = { day: dayKey(), counts: {} };
let history = store.get('ball85.history', []);

const els = {
  form: $('#ask'), input: $('#question'), button: $('#askButton'),
  reading: $('#reading'), trace: $('#trace'), answer: $('#answer'),
  meter: $('.meter'), fill: $('#meterFill'), conf: $('#confValue'),
  copy: $('#copy'), history: $('#history'), clear: $('#clear'), ball: $('#ball'),
};

// The die face is drawn on a canvas, so the face font must be ready first.
await Promise.race([
  document.fonts.load('italic 500 48px "Newsreader"').catch(() => {}),
  new Promise(r => setTimeout(r, 1500)),
]);

const ball = createBall(els.ball, { reducedMotion: reduced, onTap: () => run() });
if (!ball) {
  els.ball.classList.add('no-gl');
  els.ball.innerHTML = '<p>This browser can&rsquo;t draw the ball in 3D, but it can still answer. Type a question.</p>';
}

let busy = false;
let current = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function playTrace(lines, total) {
  els.trace.replaceChildren();
  const gap = reduced ? 0 : total / lines.length;
  for (const line of lines) {
    const li = document.createElement('li');
    li.textContent = line;
    els.trace.append(li);
    if (gap) await sleep(gap);
  }
}

function setConfidence(value) {
  els.fill.style.setProperty('--level', `${value}%`);
  els.meter.setAttribute('aria-valuenow', String(value));
  els.conf.textContent = `${value}%`;
}

async function run() {
  if (busy) return;
  busy = true;
  els.button.disabled = true;
  requestMotionPermission();

  const question = els.input.value.trim();
  const key = normalize(question);
  asks.counts[key] = (asks.counts[key] || 0) + 1;
  store.set('ball85.asks', asks);
  const r = consult(question, { asks: asks.counts[key] });

  // Make sure the ball is on screen to watch the die tumble.
  const rect = els.ball.getBoundingClientRect();
  if (rect.bottom < rect.height * 0.5 || rect.top > window.innerHeight - rect.height * 0.5) {
    els.ball.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }

  els.reading.hidden = false;
  els.reading.classList.add('is-thinking');
  els.answer.textContent = '';
  setConfidence(0);

  const settled = ball ? ball.ask(r.answer) : sleep(reduced ? 0 : 1600);
  await Promise.all([settled, playTrace(r.trace, reduced ? 0 : 1900)]);

  els.reading.classList.remove('is-thinking');
  els.answer.textContent = r.answer;
  setConfidence(r.confidence);
  current = { question: question || 'An unspoken question', answer: r.answer, confidence: r.confidence };

  if (matchMedia('(max-width: 860px)').matches) {
    els.answer.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }

  if (!r.repeat) {
    history.unshift({ ...current, at: Date.now() });
    history = history.slice(0, 12);
    store.set('ball85.history', history);
    renderHistory();
  }
  busy = false;
  els.button.disabled = false;
}

function renderHistory() {
  els.history.replaceChildren();
  els.clear.hidden = history.length === 0;
  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing asked yet. Your questions stay in this browser.';
    els.history.append(li);
    return;
  }
  for (const h of history) {
    const li = document.createElement('li');
    const q = document.createElement('p'); q.className = 'h-q'; q.textContent = h.question;
    const a = document.createElement('p'); a.className = 'h-a'; a.textContent = h.answer;
    const c = document.createElement('p'); c.className = 'h-c';
    c.textContent = `${h.confidence}% sure, ${new Date(h.at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
    li.append(q, a, c);
    els.history.append(li);
  }
}

els.form.addEventListener('submit', e => { e.preventDefault(); run(); });

els.ball.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); return; }
  const step = Math.PI / 10;
  const turns = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (turns[e.key] && ball) { e.preventDefault(); ball.nudge(...turns[e.key]); }
});

els.copy.addEventListener('click', async () => {
  if (!current) return;
  const text = `Q: ${current.question}\nA: ${current.answer}\n(the 8.5 Ball, ${current.confidence}% sure)`;
  try {
    await navigator.clipboard.writeText(text);
    els.copy.textContent = 'Copied';
    setTimeout(() => { els.copy.textContent = 'Copy answer'; }, 1500);
  } catch {
    window.prompt('Copy your answer:', text);
  }
});

els.clear.addEventListener('click', () => {
  history = [];
  store.set('ball85.history', history);
  renderHistory();
});

// Shake the phone to ask.
let motionAsked = false, lastShake = 0;
function requestMotionPermission() {
  if (motionAsked) return;
  motionAsked = true;
  const DM = window.DeviceMotionEvent;
  if (DM && typeof DM.requestPermission === 'function') DM.requestPermission().catch(() => {});
}
window.addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  const now = Date.now();
  if (m > 25 && now - lastShake > 2000) { lastShake = now; run(); }
});

renderHistory();
window.__ball85 = { run, isBusy: () => busy };
