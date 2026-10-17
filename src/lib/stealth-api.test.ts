import { expect, it, jest } from '@jest/globals';
import { buildStealthSignal, type SignalForm } from './stealth-api';

jest.mock('./api', () => ({ api: {} }));
const form: SignalForm = { kind: 'need', category: 'meal', alternatives: ['pizza'], title: '一起吃晚餐', location: 'main_gate', delay: '60', duration: '120', budget: '0', cost: '', tags: '晚餐，晚餐', requirements: '', verified: '', roles: [] };

it('uses service time and preserves free versus unknown cost', () => {
  const value = buildStealthSignal(form, Date.parse('2026-10-16T10:00:00Z'));
  expect(value.starts_at).toBe('2026-10-16T11:00:00.000Z');
  expect(value.ends_at).toBe('2026-10-16T13:00:00.000Z');
  expect(value.expires_at).toBe(value.ends_at);
  expect(value.budget_max_twd).toBe(0);
  expect(value.known_cost_twd).toBeNull();
  expect(value.tags).toEqual(['晚餐']);
});

it('does not infer pickup authorization or resources', () => {
  expect(() => buildStealthSignal({ ...form, kind: 'plan' }, 0)).toThrow('stealth_role_required');
  expect(() => buildStealthSignal({ ...form, kind: 'offer' }, 0)).toThrow('stealth_role_required');
  expect(buildStealthSignal({ ...form, kind: 'offer', roles: ['coupon'] }, 0).acceptable_categories).toEqual([]);
});

it('rejects invalid windows and fractional budgets before submitting', () => {
  expect(() => buildStealthSignal({ ...form, duration: '1441' }, 0)).toThrow('invalid_signal_window');
  expect(() => buildStealthSignal({ ...form, budget: '90.5' }, 0)).toThrow('invalid_stealth_money');
});
