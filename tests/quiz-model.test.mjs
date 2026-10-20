import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/quiz-model.js';

const M = globalThis.KnowledgeModel;
const TIME = Date.UTC(2026, 9, 20, 12);
const fixture = {
  schemaVersion: 1, revision: 1,
  books: {
    oxford: {title: 'Oxford', chapters: [{number: 1}, {number: 2}]},
    fish: {title: 'Fish', chapters: [{number: 1}, {number: 2}]}
  },
  questions: ['oxford', 'fish'].flatMap(book => [1, 2].flatMap(chapter => [1, 2].map(number => ({
    id: `${book}-${chapter}-${number}`, book, chapter,
    sectionId: `${book}-chapter-${chapter}`,
    difficulty: number === 1 ? 'recall' : 'application',
    stem: `Как различить явления ${book} в учебной ситуации ${chapter}.${number}?`,
    explanation: 'Верное объяснение опирается на приведённый учебный фрагмент.',
    options: ['a', 'b', 'c', 'd'].map(id => ({id, text: `Вариант ${id}`})),
    correctOptionId: 'a', source: {pdfStart: chapter + 10, pdfEnd: chapter + 10},
    sourceEvidence: 'Проверяемый фрагмент учебника.'
  }))))
};
const config = (changes = {}) => ({mode: 'training', book: 'all', count: 5, scope: 'all', difficulty: 'all', ...changes});
function random(seed = 123) {
  let value = seed;
  return () => ((value = Math.imul(value, 1664525) + 1013904223 >>> 0) / 4294967296);
}
const begin = (changes = {}, bank = fixture, now = TIME) => M.start(M.emptyState(bank), bank, config(changes), now, random());
function completed() {
  let state = begin({count: 2, mode: 'exam', minutes: 1});
  state = M.choose(state, fixture, 'a', TIME + 1);
  return M.finish(state, fixture, TIME + 2);
}

test('fixture validates and source-less or ambiguous questions are rejected', () => {
  assert.equal(M.validateBank(fixture), fixture);
  for (const mutate of [
    b => b.questions.push(structuredClone(b.questions[0])),
    b => b.questions[0].options[1].text = b.questions[0].options[0].text,
    b => b.questions[0].correctOptionId = 'absent',
    b => b.questions[0].source.pdfEnd = 0,
    b => b.questions[0].chapter = 99
  ]) {
    const bank = structuredClone(fixture); mutate(bank);
    assert.throws(() => M.validateBank(bank));
  }
});

test('a mixed session includes both textbooks even for a small sample and never repeats a question', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const sample = M.select(fixture, config({count: 2}), M.emptyState(fixture), TIME, random(seed));
    assert.equal(sample.length, 2);
    assert.equal(new Set(sample.map(q => q.book)).size, 2);
    const all = M.select(fixture, config({count: 'all'}), M.emptyState(fixture), TIME, random(seed));
    assert.equal(all.length, fixture.questions.length);
    assert.equal(new Set(all.map(q => q.id)).size, all.length);
  }
});

test('book, chapter and task filters cannot leak in questions outside the requested scope', () => {
  const sample = M.select(fixture, config({book: 'fish', chapters: ['fish:2'], difficulty: 'application', count: 40}), M.emptyState(fixture), TIME, random());
  assert.deepEqual(sample.map(q => q.id), ['fish-2-2']);
  assert.throws(() => begin({chapters: []}), /вопросов нет/i);
});

test('starting a session is immutable and cannot silently replace an active attempt', () => {
  const before = M.emptyState(fixture), after = M.start(before, fixture, config(), TIME, random());
  assert.equal(before.active, null);
  assert.equal(before.version, 0);
  assert.equal(after.active.questionIds.length, 5);
  assert.throws(() => M.start(after, fixture, config(), TIME, random()), /текущую попытку/i);
});

test('refresh preserves the exact exam, option order, selected answer and absolute deadline', () => {
  let state = begin({mode: 'exam', count: 2, minutes: 1});
  state = M.choose(state, fixture, 'b', TIME + 100);
  state = M.move(state, 1, TIME + 200);
  const restored = M.restoreState(JSON.parse(JSON.stringify(state)), fixture);
  assert.deepEqual(restored, state);
  assert.equal(restored.active.deadline, TIME + 60000);
  assert.notEqual(restored, state);
  assert.throws(() => M.choose(restored, fixture, 'a', TIME + 60000), /истекло/i);
  assert.throws(() => M.move(restored, 0, TIME + 60000), /истекло/i);
  assert.throws(() => M.flag(restored, TIME + 60000), /истекло/i);
  assert.equal(M.choose(restored, fixture, 'a', TIME + 59999).active.answers[restored.active.questionIds[1]], 'a');
});

test('an exam cannot expose per-question checking before final submission', () => {
  let state = begin({mode: 'exam', count: 2});
  state = M.choose(state, fixture, 'a', TIME + 1);
  assert.throws(() => M.check(state, fixture, TIME + 2), /после экзамена/i);
  assert.equal(state.events.length, 0);
  assert.deepEqual(state.active.checked, []);
});

test('expired exams finish with saved answers, counting skips in the denominator', () => {
  let state = begin({mode: 'exam', count: 5, minutes: 1});
  state = M.choose(state, fixture, 'a', TIME + 1);
  state = M.move(state, 1, TIME + 2);
  state = M.choose(state, fixture, 'b', TIME + 3);
  const done = M.finish(M.restoreState(state, fixture), fixture, TIME + 120000, 'timeout');
  assert.equal(done.active, null);
  assert.deepEqual(M.result(done.history[0], fixture), {total: 5, answered: 2, correct: 1, wrong: 1, skipped: 3, percent: 20});
  assert.equal(done.history[0].reason, 'time');
  assert.equal(done.history[0].finishedAt, TIME + 60000);
  assert.equal(done.events.filter(e => e.choice === null).length, 3);
  assert.equal(Object.values(M.stats(done, fixture)).reduce((sum, q) => sum + q.attempts, 0), 5);
});

test('checking, checking again, finishing and finishing again count each answer exactly once', () => {
  let state = begin({count: 2});
  const first = state.active.questionIds[0];
  state = M.choose(state, fixture, 'a', TIME + 1);
  state = M.check(state, fixture, TIME + 2);
  state = M.check(state, fixture, TIME + 3);
  assert.equal(M.stats(state, fixture)[first].attempts, 1);
  assert.throws(() => M.choose(state, fixture, 'b', TIME + 4), /уже проверен/i);
  const done = M.finish(state, fixture, TIME + 5);
  const again = M.finish(done, fixture, TIME + 6);
  assert.deepEqual(again, done);
  assert.equal(done.history.length, 1);
  assert.equal(done.events.length, 2);
  assert.equal(M.stats(done, fixture)[first].attempts, 1);
  assert.equal(M.result(done.history[0], fixture).skipped, 1);
  assert.throws(() => M.choose(done, fixture, 'b', TIME + 7), /активной попытки/i);
});

test('an unchecked saved training answer is graded once on completion', () => {
  let state = begin({count: 1});
  state = M.choose(state, fixture, 'b', TIME + 1);
  assert.equal(state.events.length, 0);
  const restored = M.importBackup(JSON.parse(JSON.stringify(M.backup(state))), fixture);
  const done = M.finish(restored, fixture, TIME + 2);
  assert.equal(done.events.length, 1);
  assert.equal(M.result(done.history[0], fixture).wrong, 1);
});

test('repeat scheduling advances after actual correct answers and resets after an error', () => {
  const bank = {...fixture, questions: [fixture.questions[0]]};
  let state = M.emptyState(bank);
  function answer(choice, at) {
    state = M.start(state, bank, config({count: 1}), at, random(at));
    state = M.choose(state, bank, choice, at + 1);
    state = M.check(state, bank, at + 2);
    state = M.finish(state, bank, at + 3);
  }
  const id = bank.questions[0].id;
  answer('a', TIME);
  assert.equal(M.stats(state, bank)[id].dueAt, TIME + 2 + M.DAY);
  assert.equal(M.pool(bank, config({scope: 'due'}), state, TIME + M.DAY).length, 0);
  assert.equal(M.pool(bank, config({scope: 'due'}), state, TIME + M.DAY + 2).length, 1);
  answer('a', TIME + M.DAY + 10);
  assert.equal(M.stats(state, bank)[id].dueAt, TIME + M.DAY + 12 + 3 * M.DAY);
  answer('b', TIME + M.DAY + 20);
  assert.equal(M.stats(state, bank)[id].streak, 0);
  assert.equal(M.stats(state, bank)[id].dueAt, TIME + M.DAY + 22);
  assert.equal(M.pool(bank, config({scope: 'mistakes'}), state, TIME + M.DAY + 22).length, 1);
});

test('a skipped question enters mistake practice without claiming never-seen questions were attempted', () => {
  const done = M.finish(begin({count: 1}), fixture, TIME + 1);
  assert.equal(M.pool(fixture, config({scope: 'mistakes'}), done, TIME + 1).length, 1);
  assert.equal(M.pool(fixture, config({scope: 'due'}), M.emptyState(fixture), TIME + 1).length, 0);
});

test('backup roundtrip is independent and rejects incompatible versions or duplicate answer events', () => {
  const state = completed(), data = M.backup(state);
  assert.deepEqual(M.importBackup(JSON.parse(JSON.stringify(data)), fixture), state);
  data.state.events[0].choice = 'c';
  assert.equal(state.events[0].choice, 'a');
  assert.throws(() => M.importBackup({...data, format: 'reader-backup'}, fixture));
  assert.throws(() => M.restoreState({...state, bankRevision: 2}, fixture));
  const duplicate = structuredClone(state); duplicate.events.push(structuredClone(duplicate.events[0]));
  assert.throws(() => M.restoreState(duplicate, fixture));
});

test('import rejects the same completed run appearing twice in history', () => {
  const state = completed();
  state.history.push(structuredClone(state.history[0]));
  assert.throws(() => M.restoreState(state, fixture), /./);
});

test('import rejects a completed run resurrected as the active run', () => {
  const state = completed();
  state.active = structuredClone(state.history[0]);
  delete state.active.finishedAt;
  delete state.active.reason;
  assert.throws(() => M.restoreState(state, fixture), /./);
});

test('import cannot lock an unanswered training question as already checked', () => {
  const state = begin({count: 1});
  state.active.checked = [state.active.questionIds[0]];
  assert.throws(() => M.restoreState(state, fixture), /./);
});

test('import rejects checked answers in an unfinished exam', () => {
  let state = begin({mode: 'exam', count: 1});
  state = M.choose(state, fixture, 'a', TIME + 1);
  state.active.checked = [state.active.questionIds[0]];
  assert.throws(() => M.restoreState(state, fixture), /./);
});

test('import rejects a completed attempt whose finish precedes its start', () => {
  const state = completed(); state.history[0].finishedAt = TIME - 1;
  assert.throws(() => M.restoreState(state, fixture), /./);
});

test('imported event order cannot turn an older mistake into the latest answer', () => {
  const state = M.emptyState(fixture), id = fixture.questions[0].id;
  state.events = [
    {id: 'newer', questionId: id, choice: 'a', at: TIME + M.DAY},
    {id: 'older', questionId: id, choice: 'b', at: TIME}
  ];
  let restored;
  try { restored = M.restoreState(state, fixture); } catch { return; }
  const stats = M.stats(restored, fixture)[id];
  assert.equal(stats.lastSeen, TIME + M.DAY);
  assert.equal(stats.lastCorrect, true);
});
