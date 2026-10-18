import { expect, it, jest } from '@jest/globals';
import { api } from './api';
import { stealthApi } from './stealth-api';

jest.mock('./api', () => ({ api: { post: jest.fn() } }));

it('uses the authenticated shared API with an explicit read-only semantic action and bounded timeout', async () => {
  jest.mocked(api.post).mockResolvedValue({ data: { items: [], ranking: { status: 'empty' } } });
  const result = await stealthApi.semantic();
  expect(result.ranking.status).toBe('empty');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith(
    '/stealth-cloud/matches/semantic',
    { review_limit: 3 },
    { timeout: 380_000 },
  );
});
