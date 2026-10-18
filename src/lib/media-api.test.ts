import { expect, it, jest } from '@jest/globals';
import { trustedImageLink, validPickedImage } from './media-api';

jest.mock('@/lib/api', () => ({ api: {} }));

const path =
  'https://axdwbfhrkbovgrbngrrh.supabase.co/storage/v1/object/sign/core-post-images/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';

it('accepts picker base64 within input limits and rejects incomplete or oversized data', () => {
  expect(validPickedImage('YQ==', 480, 320)).toBe('YQ==');
  for (const bad of [null, '', 'YQ=', 'data:image/png;base64,YQ==', 'Y==='])
    expect(() => validPickedImage(bad, 1, 1)).toThrow('invalid_image_input');
  expect(() => validPickedImage('a'.repeat(5_592_412), 1, 1)).toThrow('image_too_large');
  for (const [w, h] of [
    [0, 1],
    [-1, 2],
    [NaN, 2],
    [1.5, 2],
    [4001, 4000],
  ])
    expect(() => validPickedImage('YQ==', w, h)).toThrow('image_dimensions_too_large');
});

it('allows only the development project signed private image path with one nonempty token', () => {
  expect(trustedImageLink(path + '?token=synthetic')).toBe(path + '?token=synthetic');
  for (const bad of [
    path,
    path + '?token=',
    path + '?token=a&token=b',
    path + '?token=a#fragment',
    path.replace('https:', 'http:') + '?token=a',
    path.replace('axdwbfhrkbovgrbngrrh.supabase.co', 'foreign.example') + '?token=a',
    path.replace('core-post-images', 'other-bucket') + '?token=a',
    path.replace('https://', 'https://user:password@') + '?token=a',
    path.replace('.supabase.co/', '.supabase.co:444/') + '?token=a',
    path.replace('/object/sign/', '/object/public/') + '?token=a',
  ])
    expect(() => trustedImageLink(bad)).toThrow('image_storage_unavailable');
});
