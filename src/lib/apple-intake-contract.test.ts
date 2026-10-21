import { expect, it } from '@jest/globals';
import { appleIntakeInputProblem, readAppleInterviewDraft } from './apple-intake-contract';

const valid = {
  provider: 'apple_on_device',
  summary: '想喝熱湯，但不方便取餐',
  questions: ['哪裡方便？'],
  elapsedMs: 1500,
};

it('preserves a long summary including a final withdrawal rather than cutting it at the title limit', () => {
  const summary = '想和同學一起吃飯。'.repeat(20) + '更正，我不願意取餐。';
  const draft = readAppleInterviewDraft({ ...valid, summary });
  expect(draft.summary).toBe(summary);
  expect(draft.summary.endsWith('我不願意取餐。')).toBe(true);
});

it('trims blank and duplicate questions and does not carry arbitrary native fields into UI state', () => {
  const draft = readAppleInterviewDraft({
    ...valid,
    summary: '  熱湯  ',
    questions: ['', ' 地點？ ', '地點？', '預算？'],
    rawTranscript: 'not for the UI',
  });
  expect(draft).toEqual({
    provider: 'apple_on_device',
    summary: '熱湯',
    questions: ['地點？', '預算？'],
    elapsedMs: 1500,
  });
});

it.each([
  ['null', null],
  ['array', []],
  ['string', '熱湯'],
  ['different provider', { ...valid, provider: 'cloud' }],
  ['blank summary', { ...valid, summary: '  ' }],
  ['overlong summary', { ...valid, summary: '字'.repeat(2001) }],
  ['embedded null', { ...valid, summary: '熱\0湯' }],
  ['missing questions', { ...valid, questions: undefined }],
  ['too many questions', { ...valid, questions: Array(5).fill('地點？') }],
  ['non-string question', { ...valid, questions: [3] }],
  ['overlong question', { ...valid, questions: ['問'.repeat(401)] }],
  ['invalid latency', { ...valid, elapsedMs: NaN }],
  ['negative latency', { ...valid, elapsedMs: -1 }],
])('rejects %s as a malformed native result', (_, value) => {
  expect(() => readAppleInterviewDraft(value)).toThrow('apple_ai_invalid_output');
});

it('allows exact conversation boundaries and refuses an extra round or character', () => {
  expect(appleIntakeInputProblem(Array(8).fill('需求'))).toBeUndefined();
  expect(appleIntakeInputProblem(Array(9).fill('需求'))).toBe('apple_ai_turn_limit');
  expect(appleIntakeInputProblem(Array(4).fill('字'.repeat(1000)))).toBeUndefined();
  expect(appleIntakeInputProblem([...Array(4).fill('字'.repeat(1000)), '補'])).toBe(
    'apple_ai_conversation_too_long',
  );
  expect(appleIntakeInputProblem(['字'.repeat(1001)])).toBe('apple_ai_input_too_long');
});

it('uses the same request bound for emoji as the native UTF-16 check', () => {
  expect(appleIntakeInputProblem(['🍜'.repeat(500)])).toBeUndefined();
  expect(appleIntakeInputProblem(['🍜'.repeat(501)])).toBe('apple_ai_input_too_long');
});

it.each([{ turns: [] }, { turns: ['  '] }, { turns: ['需求\0'] }, { turns: ['先吃飯', ''] }])(
  'refuses empty or null-containing user turns: $turns',
  ({ turns }) => {
    expect(appleIntakeInputProblem(turns)).toBeDefined();
  },
);
