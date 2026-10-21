// Input limits use UTF-16 length in both JavaScript and Swift (String.utf16.count).
// They bound the request; the native model separately checks its token budget.
export const APPLE_INTAKE_LIMITS = {
  turns: 8,
  turnLength: 1000,
  conversationLength: 4000,
  titleLength: 160,
  summaryLength: 2000,
  questions: 4,
  questionLength: 400,
} as const;

export type AppleInterviewDraft = {
  summary: string;
  questions: string[];
  provider: 'apple_on_device';
  elapsedMs: number;
};

export function appleIntakeInputProblem(turns: readonly string[]): string | undefined {
  if (!Array.isArray(turns) || !turns.length) return 'apple_ai_empty_input';
  if (turns.length > APPLE_INTAKE_LIMITS.turns) return 'apple_ai_turn_limit';
  if (turns.some((turn) => typeof turn !== 'string' || !turn.trim() || turn.includes('\0'))) {
    return 'apple_ai_invalid_input';
  }
  if (turns.some((turn) => turn.length > APPLE_INTAKE_LIMITS.turnLength))
    return 'apple_ai_input_too_long';
  if (turns.join('').length > APPLE_INTAKE_LIMITS.conversationLength)
    return 'apple_ai_conversation_too_long';
}

export function readAppleInterviewDraft(value: unknown): AppleInterviewDraft {
  const fail = () => {
    throw new Error('apple_ai_invalid_output');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const draft = value as Record<string, unknown>;
  if (
    draft.provider !== 'apple_on_device' ||
    typeof draft.summary !== 'string' ||
    !draft.summary.trim() ||
    draft.summary.includes('\0') ||
    draft.summary.length > APPLE_INTAKE_LIMITS.summaryLength ||
    typeof draft.elapsedMs !== 'number' ||
    !Number.isFinite(draft.elapsedMs) ||
    draft.elapsedMs < 0 ||
    !Array.isArray(draft.questions) ||
    draft.questions.length > APPLE_INTAKE_LIMITS.questions
  )
    return fail();
  const questions: string[] = [];
  for (const question of draft.questions) {
    if (
      typeof question !== 'string' ||
      question.includes('\0') ||
      question.length > APPLE_INTAKE_LIMITS.questionLength
    )
      return fail();
    const clean = question.trim();
    if (clean && !questions.includes(clean)) questions.push(clean);
  }
  // Preserve the complete summary. A long result requires a manually shortened title.
  return {
    summary: draft.summary.trim(),
    questions,
    provider: 'apple_on_device',
    elapsedMs: draft.elapsedMs,
  };
}
