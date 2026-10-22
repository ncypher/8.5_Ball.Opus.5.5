// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, consult, normalize, ANSWERS } from '../oracle.js';

test('classifies question forms', () => {
  assert.equal(classify('Should I quit my job?'), 'should');
  assert.equal(classify('Will it rain tomorrow?'), 'will');
  assert.equal(classify('Am I going to make it?'), 'will');
  assert.equal(classify('When will the house be done?'), 'when');
  assert.equal(classify('How long until spring'), 'when');
  assert.equal(classify('Why is the sky blue?'), 'why');
  assert.equal(classify('How do I start?'), 'how');
  assert.equal(classify('Who should I call?'), 'open');
  assert.equal(classify('Is this a good idea?'), 'yesno');
  assert.equal(classify('   '), 'empty');
});

test('same question, same day, same answer', () => {
  const date = new Date(2026, 9, 22);
  const a = consult('Should I build the ridiculous idea?', { date });
  const b = consult('should i build the RIDICULOUS idea', { date, asks: 2 });
  assert.equal(a.answer, b.answer);
  assert.equal(a.confidence, b.confidence);
  assert.ok(b.repeat);
  assert.ok(b.trace.some(l => l.includes('twice')));
});

test('answers stay inside the pool for the form', () => {
  const r = consult('When will it be ready?', { date: new Date(2026, 0, 1) });
  assert.ok(ANSWERS.when.some(([t]) => t === r.answer));
  assert.ok(r.confidence >= 12 && r.confidence <= 88);
});

test('every reading admits it cannot see the future', () => {
  for (const q of ['Will I win?', 'Why?', '', 'Should I?', 'What next']) {
    const r = consult(q);
    assert.match(r.trace[1], /none found|denied|not invented|isn.t answering/);
  }
});

test('normalize strips punctuation and case', () => {
  assert.equal(normalize('  Is IT, really?! '), 'is it really');
});
