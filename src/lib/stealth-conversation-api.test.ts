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
