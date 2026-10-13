import { z } from 'zod';

export const capacitySchema = z.number().int().positive().refine(Number.isSafeInteger, '人數超出可儲存範圍');
export const capacityInputSchema = z.string().trim().refine(
  (value) => /^\d+$/.test(value) && capacitySchema.safeParse(Number(value)).success,
  '請輸入至少 1 人的整數',
);
