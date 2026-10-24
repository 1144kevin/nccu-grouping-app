const KEY = 'nccu-grouping.shared-post-return';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let memory: { id: string; at: number } | null = null;

export function rememberSharedPost(id: string) {
  if (!UUID.test(id)) return;
  memory = { id, at: Date.now() };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* Native or restricted storage. */
  }
}

export function pendingSharedPost(): string | null {
  let value = memory;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) value = JSON.parse(raw);
  } catch {
    /* Memory still supports same-page login. */
  }
  if (
    !value ||
    !UUID.test(value.id) ||
    !Number.isFinite(value.at) ||
    Date.now() - value.at > 60 * 60 * 1000 ||
    value.at > Date.now()
  )
    return null;
  return value.id;
}

export function clearSharedPostReturn() {
  memory = null;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* Native or restricted storage. */
  }
}
