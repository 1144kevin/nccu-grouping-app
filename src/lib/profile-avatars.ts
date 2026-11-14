export const PROFILE_AVATARS = [
  { badge: 'eagle-01', label: '手搖杯', image: require('../../assets/images/avatars/eagle-activity-01.svg') },
  { badge: 'eagle-03', label: '便當', image: require('../../assets/images/avatars/eagle-activity-03.svg') },
  { badge: 'eagle-05', label: '一大串衛生紙', image: require('../../assets/images/avatars/eagle-activity-05.svg') },
  { badge: 'eagle-07', label: 'XL 大箱', image: require('../../assets/images/avatars/eagle-activity-07.svg') },
  { badge: 'eagle-09', label: '籃球', image: require('../../assets/images/avatars/eagle-activity-09.svg') },
  { badge: 'eagle-11', label: '羽球拍', image: require('../../assets/images/avatars/eagle-activity-11.svg') },
  { badge: 'eagle-13', label: '小汽車', image: require('../../assets/images/avatars/eagle-activity-13.svg') },
  { badge: 'eagle-15', label: '演唱會應援棒', image: require('../../assets/images/avatars/eagle-activity-15.svg') },
] as const;

export function profileAvatarImage(badge: string) {
  const legacy: Record<string, string> = {
    '🍜': 'eagle-09',
    '🍱': 'eagle-09',
    '🥐': 'eagle-05',
    '🍕': 'eagle-13',
    '🧋': 'eagle-01',
    '🍍': 'eagle-01',
    'eagle-02': 'eagle-01',
    'eagle-04': 'eagle-03',
    'eagle-06': 'eagle-05',
    'eagle-08': 'eagle-07',
    'eagle-10': 'eagle-09',
    'eagle-12': 'eagle-11',
    'eagle-14': 'eagle-13',
    'eagle-16': 'eagle-15',
  };
  return PROFILE_AVATARS.find((avatar) => avatar.badge === (legacy[badge] ?? badge))?.image;
}
