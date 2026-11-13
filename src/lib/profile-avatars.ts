// Existing badge values remain compatible with the server's profile schema.
export const PROFILE_AVATARS = [
  { badge: '🍜', label: '籃球揪團', image: require('../../assets/images/avatars/eagle-team.svg') },
  { badge: '🥐', label: '量販分購', image: require('../../assets/images/avatars/eagle-bulk.svg') },
  { badge: '🍕', label: '共乘分攤', image: require('../../assets/images/avatars/eagle-carpool.svg') },
  { badge: '🧋', label: '外送湊單', image: require('../../assets/images/avatars/eagle-delivery.svg') },
] as const;

export function profileAvatarImage(badge: string) {
  // Keep existing accounts readable without changing their stored profile values.
  const legacy = badge === '🍱' ? '🍜' : badge === '🍍' ? '🧋' : badge;
  return PROFILE_AVATARS.find((avatar) => avatar.badge === legacy)?.image;
}
