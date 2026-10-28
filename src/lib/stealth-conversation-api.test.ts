import { expect, it, jest } from '@jest/globals';
import { api } from './api';
import { stealthApi } from './stealth-api';
jest.mock('./api', () => ({ api: { post: jest.fn() } }));
it('sends only bounded conversation context to the authenticated API and allows cancellation', async () => {
  const controller = new AbortController();
  jest.mocked(api.post).mockResolvedValue({ data: { message: '在哪裡碰面？' } });
  await stealthApi.conversation(['我想喝飲料'], undefined, [null], controller.signal);
  expect(api.post).toHaveBeenCalledWith(
    '/stealth-cloud/conversation',
    { turns: ['我想喝飲料'], answer_fields: [null] },
    { timeout: 330_000, signal: controller.signal },
  );
});

it('includes the actual assistant replies for a contextual follow-up', async () => {
  jest.mocked(api.post).mockResolvedValue({ data: { message: '預算大概多少？' } });
  await stealthApi.conversation(
    ['想喝飲料', '東側門'],
    undefined,
    [null, 'location_id'],
    undefined,
    ['在哪裡方便？'],
  );
  expect(api.post).toHaveBeenLastCalledWith(
    '/stealth-cloud/conversation',
    {
      turns: ['想喝飲料', '東側門'],
      answer_fields: [null, 'location_id'],
      assistant_turns: ['在哪裡方便？'],
    },
    { timeout: 330_000, signal: undefined },
  );
});
