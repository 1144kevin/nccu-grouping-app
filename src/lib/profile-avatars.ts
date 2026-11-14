export const PROFILE_AVATARS = [
  { badge: 'eagle-01', group: '外送湊單族', label: '手搖杯', image: require('../../assets/images/avatars/eagle-activity-01.svg') },
  { badge: 'eagle-02', group: '外送湊單族', label: '外送保溫袋', image: require('../../assets/images/avatars/eagle-activity-02.svg') },
  { badge: 'eagle-03', group: '外送湊單族', label: '便當', image: require('../../assets/images/avatars/eagle-activity-03.svg') },
  { badge: 'eagle-04', group: '外送湊單族', label: '披薩', image: require('../../assets/images/avatars/eagle-activity-04.svg') },
  { badge: 'eagle-05', group: '量販分購族', label: '一大串衛生紙', image: require('../../assets/images/avatars/eagle-activity-05.svg') },
  { badge: 'eagle-06', group: '量販分購族', label: '購物推車', image: require('../../assets/images/avatars/eagle-activity-06.svg') },
  { badge: 'eagle-07', group: '量販分購族', label: 'XL 大箱', image: require('../../assets/images/avatars/eagle-activity-07.svg') },
  { badge: 'eagle-08', group: '量販分購族', label: '滿滿購物袋', image: require('../../assets/images/avatars/eagle-activity-08.svg') },
  { badge: 'eagle-09', group: '缺一咖揪團族', label: '籃球', image: require('../../assets/images/avatars/eagle-activity-09.svg') },
  { badge: 'eagle-10', group: '缺一咖揪團族', label: '麻將牌「缺」', image: require('../../assets/images/avatars/eagle-activity-10.svg') },
  { badge: 'eagle-11', group: '缺一咖揪團族', label: '羽球拍', image: require('../../assets/images/avatars/eagle-activity-11.svg') },
  { badge: 'eagle-12', group: '缺一咖揪團族', label: '桌遊骰子', image: require('../../assets/images/avatars/eagle-activity-12.svg') },
  { badge: 'eagle-13', group: '共乘分攤族', label: '小汽車', image: require('../../assets/images/avatars/eagle-activity-13.svg') },
  { badge: 'eagle-14', group: '共乘分攤族', label: '行李箱', image: require('../../assets/images/avatars/eagle-activity-14.svg') },
  { badge: 'eagle-15', group: '共乘分攤族', label: '演唱會應援棒', image: require('../../assets/images/avatars/eagle-activity-15.svg') },
  { badge: 'eagle-16', group: '共乘分攤族', label: '車票／門票', image: require('../../assets/images/avatars/eagle-activity-16.svg') },
] as const;
export const PROFILE_AVATAR_GROUPS = ['外送湊單族', '量販分購族', '缺一咖揪團族', '共乘分攤族'] as const;
export function profileAvatarImage(badge: string) {
  const legacy: Record<string, string> = { '🍜': 'eagle-09', '🍱': 'eagle-09', '🥐': 'eagle-05', '🍕': 'eagle-13', '🧋': 'eagle-01', '🍍': 'eagle-01' };
  return PROFILE_AVATARS.find((avatar) => avatar.badge === (legacy[badge] ?? badge))?.image;
}
