import type { CoreSession } from '@/lib/core-api';

// Native OAuth requires a development build and an explicit App redirect allowlist.
export async function beginGoogleSignIn(): Promise<void> { throw new Error('google_web_only'); }
export async function finishGoogleSignIn(): Promise<CoreSession> { throw new Error('google_web_only'); }
export function clearGoogleCallback(): void {}
