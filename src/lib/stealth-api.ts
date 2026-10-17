import { api } from './api';

export type StealthCategory = 'pizza' | 'meal' | 'drink' | 'bakery' | 'snack';
export type StealthRole = 'order' | 'pickup' | 'coupon' | 'share';
export type StealthAgentInput = {
  name: string; enabled: boolean; daily_invite_limit: number; timezone: string;
  quiet_start_hour: number | null; quiet_end_hour: number | null;
  exploration: 'familiar' | 'balanced'; tone: 'direct' | 'warm' | 'playful';
  avatar_key: 'rice' | 'pizza' | 'tea' | 'cat'; expected_version: number; include_demo: boolean;
};
export type StealthAgent = Omit<StealthAgentInput, 'expected_version'> & { user_id: string; version: number; policy_version: number; updated_at: string };
export type StealthSignalInput = {
  kind: 'need' | 'offer' | 'plan'; category: StealthCategory; acceptable_categories: StealthCategory[];
  title: string; location_id: 'main_gate' | 'east_gate' | 'south_gate'; starts_at: string; ends_at: string; expires_at: string;
  budget_max_twd: number | null; known_cost_twd: number | null; tags: string[];
  dietary_requirements: string[]; dietary_verified: string[]; roles: StealthRole[];
};
export type StealthSignal = StealthSignalInput & { id: string; owner_id: string; status: 'active' | 'revoked' | 'consumed'; version: number; created_at: string };
export type StealthTerms = { content: string; cost_per_person_twd: number; deadline_at: string; order_member: number; pickup_member: number; cost_change_note?: string };
export type StealthAgentTermsDraft = {
  provider: 'offline_rules_v1'; is_llm: false; content: string; cost_per_person_twd: number | null; total_cost_twd: number | null;
  cost_basis: 'known_cost' | 'unknown'; budget_limit_twd: number | null; deadline_at: string;
  order_member: number | null; pickup_member: number | null;
  role_suggestions: { role: 'order' | 'pickup'; member_number: number | null; candidates: number[]; reason: string }[];
  missing_fields: ('cost' | 'order' | 'pickup')[]; needs_confirmation: string[]; ready_to_submit: boolean;
};
export type StealthMatch = {
  id: string; category: StealthCategory; location_id: StealthSignalInput['location_id'];
  starts_at: string; ends_at: string; expires_at: string; created_at: string;
  budget_max_twd: number | null; known_cost_twd: number | null; member_count: number; score: number;
  reasons: string[]; unknowns: string[]; why_me: string[]; my_signal_title: string; my_roles: StealthRole[];
  invitation_text: string; my_decision: 'pending' | 'accepted' | 'declined'; status: 'pending' | 'ready' | 'unavailable' | 'formed'; is_llm: false; is_demo: boolean;
  terms: StealthTerms | null; terms_revision: number; my_member_number: number; host_member_number: number | null;
  confirmed_count: number; my_terms_accepted: boolean; formed_post_id: string | null; formed_at: string | null;
  agent_draft?: StealthAgentTermsDraft | null;
};
export type StealthCreated = { signal: StealthSignal; matching: 'completed' | 'paused' | 'quiet' | 'cooldown' | 'unavailable'; new_matches: number };
export type StealthDraft = { category_hint: StealthCategory | null; location_hint: StealthSignalInput['location_id'] | null; title: string; needs_confirmation: string[]; is_llm: false };
export type StealthIntake = {
  provider: 'ollama_local'; is_llm: true; model: string; ready_for_review: boolean;
  facts: { title: string; kind: StealthSignalInput['kind'] | null; category: StealthCategory | null;
    location_id: StealthSignalInput['location_id'] | null; delay_minutes: number | null; duration_minutes: number | null;
    budget_max_twd: number | null; budget_unknown: boolean; known_cost_twd: number | null;
    roles: StealthRole[]; roles_confirmed: boolean; tags: string[]; dietary_requirements: string[] };
  questions: { field: string; text: string }[]; warnings: string[];
};
const root = '/stealth-cloud';
export const stealthApi = {
  agent: async () => (await api.get<StealthAgent | null>(`${root}/agent`)).data,
  saveAgent: async (value: StealthAgentInput) => (await api.put<StealthAgent>(`${root}/agent`, value)).data,
  signals: async () => (await api.get<{ items: StealthSignal[] }>(`${root}/signals`)).data,
  create: async (value: StealthSignalInput, key: string) => (await api.post<StealthCreated>(`${root}/signals`, value, { headers: { 'Idempotency-Key': key } })).data,
  revoke: async (id: string) => (await api.delete<StealthSignal>(`${root}/signals/${encodeURIComponent(id)}`)).data,
  matches: async () => (await api.get<{ items: StealthMatch[] }>(`${root}/matches`)).data,
  run: async () => (await api.post<{ created: number; is_llm: false }>(`${root}/matches/run`, { max_proposals: 3 })).data,
  decide: async (id: string, decision: 'accepted' | 'declined') => (await api.post<StealthMatch>(`${root}/matches/${encodeURIComponent(id)}/decision`, { decision })).data,
  terms: async (id: string, expected_revision: number, value: StealthTerms) => (await api.put<StealthMatch>(`${root}/matches/${encodeURIComponent(id)}/terms`, { expected_revision, value })).data,
  consent: async (id: string, expected_revision: number) => (await api.post<StealthMatch>(`${root}/matches/${encodeURIComponent(id)}/consent`, { expected_revision, agree: true })).data,
  draft: async (text: string) => (await api.post<StealthDraft>(`${root}/draft`, { text })).data,
  intake: async (turns: string[]) => (await api.post<StealthIntake>(`${root}/intake`, { turns }, { timeout: 100_000 })).data,
};

export function intakeToForm(value: StealthIntake): SignalForm {
  const f = value.facts;
  if (!value.ready_for_review || !f.kind || !f.category || !f.location_id || f.delay_minutes === null || f.duration_minutes === null) throw new Error('intake_incomplete');
  return { kind: f.kind, category: f.category, location: f.location_id, title: f.title, alternatives: [],
    delay: String(f.delay_minutes), duration: String(f.duration_minutes), budget: f.budget_max_twd === null ? '' : String(f.budget_max_twd),
    cost: f.known_cost_twd === null ? '' : String(f.known_cost_twd), roles: [...f.roles], tags: f.tags.join('，'),
    requirements: f.dietary_requirements.join('，'), verified: '' };
}

export type SignalForm = {
  kind: StealthSignalInput['kind']; category: StealthCategory; alternatives: StealthCategory[];
  title: string; location: StealthSignalInput['location_id']; delay: string; duration: string;
  budget: string; cost: string; tags: string; requirements: string; verified: string; roles: StealthRole[];
};
const split = (value: string) => [...new Set(value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean))];
export function buildStealthSignal(form: SignalForm, now: number): StealthSignalInput {
  const delay = Number(form.delay), duration = Number(form.duration);
  if (!/^\d+$/.test(form.delay) || !/^\d+$/.test(form.duration) || delay < 0 || duration < 15 || duration > 1440 || delay + duration > 10080) throw new Error('invalid_signal_window');
  const money = (value: string) => {
    if (!value.trim()) return null;
    if (!/^\d+$/.test(value.trim()) || Number(value) > 100000) throw new Error('invalid_stealth_money');
    return Number(value);
  };
  if (!form.title.trim() || form.title.trim().length > 160) throw new Error('invalid_stealth_input');
  if ((form.kind === 'offer' && !form.roles.length) || (form.kind === 'plan' && !form.roles.includes('pickup'))) throw new Error('stealth_role_required');
  const groups = [split(form.tags), split(form.requirements), split(form.verified)];
  if (groups.some((values) => values.length > 12 || values.some((item) => item.length > 32))) throw new Error('invalid_stealth_input');
  const end = new Date(now + (delay + duration) * 60000).toISOString();
  return { kind: form.kind, category: form.category, acceptable_categories: form.kind === 'offer' ? [] : form.alternatives.filter((c) => c !== form.category),
    title: form.title.trim(), location_id: form.location, starts_at: new Date(now + delay * 60000).toISOString(), ends_at: end, expires_at: end,
    budget_max_twd: money(form.budget), known_cost_twd: money(form.cost), tags: groups[0], dietary_requirements: groups[1], dietary_verified: groups[2], roles: form.roles };
}
