import { z } from 'zod';

export const priceInputSchema = z.string().trim().refine(
  (value) => value === '' || /^\d{1,6}(\.\d{1,2})?$/.test(value),
  '請輸入 0～999,999.99 的金額，最多兩位小數',
);
export const priceSchema = z.number().finite().min(0).max(999999.99).optional();
export function parsePrice(value: string): number | undefined {
  const valid = priceInputSchema.parse(value);
  return valid === '' ? undefined : Number(valid);
}
export function formatPrice(value?: number): string {
  if (value === undefined) return '待確認';
  if (value === 0) return '免費';
  return `NT$ ${value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}／人`;
}
