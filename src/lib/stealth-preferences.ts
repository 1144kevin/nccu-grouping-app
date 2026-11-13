export type StealthPreferences = {
  tone: 'warm' | 'direct' | 'playful' | 'tsundere';
  context: string;
};

export const defaultStealthPreferences: StealthPreferences = { tone: 'warm', context: '' };
export const stealthTones = [
  { value: 'warm', label: '親切自然' },
  { value: 'direct', label: '簡潔直接' },
  { value: 'playful', label: '輕鬆有趣' },
  { value: 'tsundere', label: '傲嬌' },
] as const;

export function parseStealthPreferences(value: unknown): StealthPreferences {
  const candidate = value as Partial<StealthPreferences> | null;
  return {
    tone: stealthTones.some((tone) => tone.value === candidate?.tone) ? candidate!.tone! : 'warm',
    context: typeof candidate?.context === 'string' ? candidate.context.slice(0, 500) : '',
  };
}
