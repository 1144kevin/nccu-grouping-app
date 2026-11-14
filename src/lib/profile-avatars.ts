export const PROFILE_AVATARS = [
  {
    badge: 'eagle-01',
    label: '手搖杯',
    image: require('../../assets/images/avatars/eagle-activity-01.svg'),
  },
  {
    badge: 'eagle-03',
    label: '便當',
    image: require('../../assets/images/avatars/eagle-activity-03.svg'),
  },
  {
    badge: 'eagle-05',
    label: '一大串衛生紙',
    image: require('../../assets/images/avatars/eagle-activity-05.svg'),
  },
  {
    badge: 'eagle-07',
    label: 'XL 大箱',
    image: require('../../assets/images/avatars/eagle-activity-07.svg'),
  },
  {
    badge: 'eagle-09',
    label: '籃球',
    image: require('../../assets/images/avatars/eagle-activity-09.svg'),
  },
  {
    badge: 'eagle-11',
    label: '羽球拍',
    image: require('../../assets/images/avatars/eagle-activity-11.svg'),
  },
  {
    badge: 'eagle-13',
    label: '小汽車',
    image: require('../../assets/images/avatars/eagle-activity-13.svg'),
  },
  {
    badge: 'eagle-15',
    label: '演唱會應援棒',
    image: require('../../assets/images/avatars/eagle-activity-15.svg'),
  },
] as const;

export const FRUIT_AVATARS = [
  {
    badge: 'fruit-orange',
    label: '橘子老闆',
    image: require('../../assets/images/avatars/fruit-orange.png'),
  },
  {
    badge: 'fruit-peach',
    label: '水蜜桃追星妹',
    image: require('../../assets/images/avatars/fruit-peach.png'),
  },
  {
    badge: 'fruit-lemon',
    label: '檸檬諧趣男',
    image: require('../../assets/images/avatars/fruit-lemon.png'),
  },
  {
    badge: 'fruit-pineapple',
    label: '鳳梨健身咖',
    image: require('../../assets/images/avatars/fruit-pineapple.png'),
  },
  {
    badge: 'fruit-avocado',
    label: '酪梨文青',
    image: require('../../assets/images/avatars/fruit-avocado.png'),
  },
  {
    badge: 'fruit-banana',
    label: '香蕉電影咖',
    image: require('../../assets/images/avatars/fruit-banana.png'),
  },
  {
    badge: 'fruit-grape',
    label: '葡萄社畜',
    image: require('../../assets/images/avatars/fruit-grape.png'),
  },
  {
    badge: 'fruit-strawberry',
    label: '草莓電玩男',
    image: require('../../assets/images/avatars/fruit-strawberry.png'),
  },
  {
    badge: 'fruit-blueberry',
    label: '藍莓宅宅',
    image: require('../../assets/images/avatars/fruit-blueberry.png'),
  },
  {
    badge: 'fruit-apple',
    label: '蘋果班長',
    image: require('../../assets/images/avatars/fruit-apple.png'),
  },
] as const;

export const ORANGE_AVATARS = [
  {
    badge: 'orange-office',
    label: '橘子上班族',
    image: require('../../assets/images/avatars/orange-office.svg'),
  },
  {
    badge: 'orange-student',
    label: '橘子學生',
    image: require('../../assets/images/avatars/orange-student.svg'),
  },
  {
    badge: 'orange-anime',
    label: '橘子動漫迷',
    image: require('../../assets/images/avatars/orange-anime.svg'),
  },
  {
    badge: 'orange-movie',
    label: '橘子電影迷',
    image: require('../../assets/images/avatars/orange-movie.svg'),
  },
  {
    badge: 'orange-fan',
    label: '橘子追星族',
    image: require('../../assets/images/avatars/orange-fan.svg'),
  },
  {
    badge: 'orange-hipster',
    label: '橘子文青',
    image: require('../../assets/images/avatars/orange-hipster.svg'),
  },
  {
    badge: 'orange-gamer',
    label: '橘子玩家',
    image: require('../../assets/images/avatars/orange-gamer.svg'),
  },
  {
    badge: 'orange-traveler',
    label: '橘子旅人',
    image: require('../../assets/images/avatars/orange-traveler.svg'),
  },
  {
    badge: 'orange-foodie',
    label: '橘子吃貨',
    image: require('../../assets/images/avatars/orange-foodie.svg'),
  },
  {
    badge: 'orange-night',
    label: '橘子夜貓',
    image: require('../../assets/images/avatars/orange-night.svg'),
  },
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
  return [...PROFILE_AVATARS, ...FRUIT_AVATARS, ...ORANGE_AVATARS].find(
    (avatar) => avatar.badge === (legacy[badge] ?? badge),
  )?.image;
}
