// Existing server schema accepts a bounded address. Keep the real address plus a
// clearly labeled meeting note there, without changing shared database structure.
const LABEL = '\n取餐說明：';
export function splitPickupAddress(raw?: string | null) {
  const value = typeof raw === 'string' ? raw : '';
  const index = value.indexOf(LABEL);
  return index < 0 ? { address: value, note: '' } : {
    address: value.slice(0, index), note: value.slice(index + LABEL.length),
  };
}
export function pickupAddress(address: string, note: string): string | undefined {
  const result = address.trim() + (note.trim() ? LABEL + note.trim() : '');
  if (result.length > 500) throw new Error('pickup_note_too_long');
  return result || undefined;
}
