import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import {
  appleIntakeInputProblem,
  readAppleInterviewDraft,
  type AppleInterviewDraft,
} from './apple-intake-contract';

export type { AppleInterviewDraft } from './apple-intake-contract';

export const APPLE_INTAKE_ENABLED =
  Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED === 'true';
export const APPLE_INTAKE_TRIAL =
  Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL === 'true';

type AppleIntakeModule = {
  availability(): Promise<string>;
  interview(id: string, turns: string[]): Promise<unknown>;
  cancel(id: string): void;
};
const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<AppleIntakeModule>('NCCUAppleIntake') : null;

export async function appleIntakeAvailability(): Promise<string> {
  if (!native) return 'native_module_missing';
  return deadline(() => native.availability(), 5_000, 'apple_ai_availability_timeout');
}

export function cancelAppleIntake(id: string) {
  try {
    native?.cancel(id);
  } catch {
    /* Local generation guards also discard late results. */
  }
}

let requestSerial = 0;
export function newAppleIntakeRequestID(): string {
  return `intake-${Date.now()}-${++requestSerial}`;
}

export async function runAppleIntake(id: string, turns: string[]): Promise<AppleInterviewDraft> {
  if (!native) throw new Error('native_module_missing');
  const problem = appleIntakeInputProblem(turns);
  if (problem) throw new Error(problem);
  const snapshot = [...turns];
  const value = await deadline(
    () => native.interview(id, snapshot),
    60_000,
    'apple_ai_timeout',
    () => cancelAppleIntake(id),
  );
  return readAppleInterviewDraft(value);
}

async function deadline<T>(
  request: () => Promise<T>,
  milliseconds: number,
  code: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(code));
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const labels: Record<string, string> = {
  available: 'Apple 裝置端 AI 已就緒',
  native_module_missing: '此版本尚未包含 Apple AI 原生模組，請安裝新版 App。',
  ios_version_unsupported: '此功能需要 iOS 26 或更新版本。',
  apple_intelligence_disabled: '請先在手機設定開啟 Apple Intelligence。',
  device_not_eligible: '此裝置不支援 Apple 裝置端 AI，仍可手動填寫。',
  model_not_ready: 'Apple 裝置端模型尚未準備好，請稍後重試。',
  apple_ai_timeout: '整理逾時，輸入仍保留；可重試或直接手動填寫。',
  apple_ai_busy: '上一筆整理仍在結束中，請稍後重試。',
  apple_ai_cancelled: '整理已停止，輸入仍保留。',
  apple_ai_invalid_input: '請保持每輪1000字內、八輪內及總共4000字內。',
  apple_ai_empty_input: '請先輸入需求或補充內容。',
  apple_ai_turn_limit: '已達八輪。可修改上一輪、清除本機對話後重述，或直接手動填寫。',
  apple_ai_input_too_long: '本次輸入超過1000字，請縮短內容；原輸入仍保留。',
  apple_ai_conversation_too_long:
    '對話超過4000字。可縮短上一輪、清除本機對話後重述，或直接手動填寫。',
  apple_ai_context_limit:
    '內容超過 Apple AI 可處理的長度。請縮短輸入或清除本機對話後重述；也可直接手動填寫。',
  apple_ai_invalid_output: 'AI 回傳的內容不完整，請重試或手動填寫；原輸入仍保留。',
  apple_ai_availability_timeout: 'Apple AI 狀態檢查逾時，請重新檢查；仍可手動填寫。',
  apple_ai_rate_limited: '手機上的 Apple AI 正忙碌，請稍後重試；原輸入仍保留。',
  apple_ai_refused: 'Apple AI 無法整理這段內容，可調整輸入或直接手動填寫；原輸入仍保留。',
  apple_ai_unsupported_language: 'Apple AI 暫不支援這段內容的語言，請調整輸入或手動填寫。',
};
export function appleIntakeMessage(value: unknown): string {
  const code =
    typeof value === 'string'
      ? value
      : ((value as { code?: string })?.code ?? (value instanceof Error ? value.message : ''));
  return labels[code] ?? 'Apple AI 暫時無法完成整理，輸入仍保留；可重試或使用手動表單。';
}
