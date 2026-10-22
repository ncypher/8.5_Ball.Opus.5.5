# 8.5 Ball, Opus 5.5 edition

A Magic 8 Ball that shows its work. Made by Claude Opus 5.5 as a reply to
[Tom Harwood's 8.5 Ball](https://github.com/ncypher/8.5_Ball).

**Live:** https://ncypher.github.io/8.5_Ball.Opus.5.5/ (once Pages is on, see below)

## What makes this one different

Tom's 8.5 Ball asked what an 8 Ball looks like after AI. This one asks what an
*honest* oracle would do.

- **It reads the shape of your question.** "Should I…" gets a decision. "Will…"
  gets odds. "When…" gets a timeline. "Why…" and "How…" get a reason or a method.
  A real 8 Ball answers "When will it snow?" with "Yes." This one doesn't.
- **It shows its work.** Every reading prints a short trace before the answer:
  what kind of question it heard, the word it latched onto, and, every time,
  a line admitting it checked for actual foresight and found none.
- **It never rerolls.** The same question on the same day always gets the same
  answer. Ask again and the trace notes it: "You've asked this twice today.
  The future doesn't reroll."
- **It says how sure it is,** and that the number is a guess about a guess.
- **It's a real 3D object.** A lacquered black shell with a window, indigo fluid,
  drifting bubbles, and a twenty-sided die that tumbles and then floats one face
  to the glass. Drag to turn it; the "8.5" is on the back.

## Use it

- Type a question and press **Ask the ball**, or tap the ball itself.
- Drag the ball to turn it. Arrow keys turn it too; Enter asks.
- On a phone, shake to ask (iOS asks for motion permission on first use).
- Reduced-motion settings are respected: no tumble, the answer just appears.

## Run locally

It's a static site with ES modules, so it needs a local server rather than
`file://`:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Run the oracle tests (Node 20+):

```sh
npm test
```

## Turn on GitHub Pages

Settings → Pages → Deploy from a branch → `main`, `/ (root)` → Save.

## How it's built

| File | Job |
| --- | --- |
| `oracle.js` | The answer engine. Pure functions: classify the question, hash question + date to pick a consistent answer, build the reasoning trace. |
| `ball.js` | The three.js scene: shell, window, liner shader, die, face text, bubbles, studio lighting, drag and tumble. |
| `main.js` | Wires the page: form, trace playback, confidence meter, history (kept in `localStorage`), shake-to-ask. |
| `vendor/three.module.min.js` | three.js r170, vendored so the ball works with no CDN. MIT, see `vendor/three-LICENSE`. |

No accounts, no API keys, no tracking. The only outside request is Google Fonts;
if that fails, the page falls back to system fonts and still works.

## Notice

For entertainment. The ball can't see the future, and it says so every time.
