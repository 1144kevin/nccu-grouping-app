import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { StealthFormation } from './core-stealth-formation';
import { StealthTentativeDraftCard } from './stealth-tentative-draft-card';
import type { StealthAgentTermsDraft, StealthMatch } from '@/lib/stealth-api';

jest.mock('@/lib/stealth-api', () => ({
  stealthApi: { terms: jest.fn(), consent: jest.fn(), draftAi: jest.fn() },
}));

const baseMatch: StealthMatch = {
  id: 'm1',
  category: 'pizza',
  location_id: 'main_gate',
  starts_at: '2026-10-18T10:00:00Z',
  ends_at: '2026-10-18T11:00:00Z',
  expires_at: '2026-10-19T10:00:00Z',
  created_at: '2026-10-18T09:00:00Z',
  budget_max_twd: 150,
  known_cost_twd: null,
  member_count: 2,
  score: 90,
  reasons: ['順路去政大正門'],
  unknowns: ['實際費用待確認'],
  why_me: [],
  my_signal_title: '想吃披薩',
  my_roles: ['share'],
  invitation_text: '一起拼單',
  my_decision: 'pending',
  status: 'pending',
  is_llm: false,
  is_demo: false,
  terms: null,
  terms_revision: 0,
  my_member_number: 1,
  host_member_number: null,
  confirmed_count: 0,
  my_terms_accepted: false,
  formed_post_id: null,
  formed_at: null,
};

describe('StealthTentativeDraftCard & StealthFormation prefill', () => {
  it('renders confirmed facts, suggested plan, and pending confirmations without inventing missing cost or roles', async () => {
    const incompleteDraft: StealthAgentTermsDraft = {
      provider: 'offline_rules_v1',
      is_llm: false,
      content: '一起分享披薩，在政大正門協調集合。',
      cost_per_person_twd: null,
      total_cost_twd: null,
      cost_basis: 'unknown',
      budget_limit_twd: 150,
      starts_at: '2026-10-18T10:00:00Z',
      deadline_at: '2026-10-18T11:00:00Z',
      location_label: '政大正門',
      order_member: null,
      pickup_member: null,
      role_suggestions: [],
      missing_fields: ['cost', 'order', 'pickup'],
      confirmed_facts: ['共同地點：政大正門', '已提供預算上限：NT$ 150（僅作預算參考，非實際費用）'],
      recommendation_reasons: ['順路去政大正門'],
      needs_confirmation: ['草案不代表任何人同意；請逐人確認費用、分工、公開內容與截止時間。'],
      ready_to_submit: false,
    };
    const screen = await render(
      <StealthTentativeDraftCard match={baseMatch} draft={incompleteDraft} canEdit onEdit={jest.fn()} />,
    );
    expect(screen.getByText('已由使用者明確提供的資訊')).toBeTruthy();
    expect(screen.getByText('建議方案')).toBeTruthy();
    expect(screen.getByText('尚待確認的事項')).toBeTruthy();
    expect(screen.getByText(/待確認（預算上限 NT\$ 150，非實際費用）/)).toBeTruthy();
    expect(screen.getByText('誰負責購買：待確認')).toBeTruthy();
    expect(screen.getByText('誰負責取餐：待確認')).toBeTruthy();
    expect(screen.getByText('補充／修改方案')).toBeTruthy();
  });

  it('prefills StealthFormation from complete agent_draft without requiring blank re-entry', async () => {
    const completeDraft: StealthAgentTermsDraft = {
      provider: 'offline_rules_v1',
      is_llm: false,
      content: '一起分享披薩，在政大正門協調集合。',
      cost_per_person_twd: 120,
      total_cost_twd: 240,
      cost_basis: 'known_cost',
      budget_limit_twd: 150,
      starts_at: '2026-10-18T10:00:00Z',
      deadline_at: '2026-10-18T11:00:00Z',
      location_label: '政大正門',
      order_member: 1,
      pickup_member: 2,
      role_suggestions: [],
      missing_fields: [],
      confirmed_facts: ['已提供每人費用：NT$ 120'],
      recommendation_reasons: ['雙方時間吻合'],
      needs_confirmation: ['請確認費用與分工'],
      ready_to_submit: true,
    };
    const client = new QueryClient();
    const screen = await render(
      <QueryClientProvider client={client}>
        <StealthFormation
          match={{ ...baseMatch, status: 'ready', agent_draft: completeDraft }}
          now={() => Date.parse('2026-10-18T09:30:00Z')}
          refresh={async () => undefined}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('成團公開說明').props.value).toBe('一起分享披薩，在政大正門協調集合。');
    expect(screen.getByLabelText('成團每人費用').props.value).toBe('120');
  });
});
