import { Image } from 'expo-image';
import { levelLabel } from '@/lib/level-label';

export type PizzaLevel = 1 | 2 | 3 | 4 | 5;

export const pizzaLevels: {
  level: PizzaLevel;
  title: string;
  description: string;
  background: string;
  pillBackground: string;
  pillText: string;
}[] = [
  {
    level: 1,
    title: '就很皮',
    description: '錯過多次，盤子空了。',
    background: '#F4F5F7',
    pillBackground: '#6B7280',
    pillText: '#FFFFFF',
  },
  {
    level: 2,
    title: '就醬',
    description: '只是一塊普通披薩。',
    background: '#FDF1EC',
    pillBackground: '#C2410C',
    pillText: '#FFFFFF',
  },
  {
    level: 3,
    title: '有起色',
    description: '你感覺滿有的喔！',
    background: '#FFF7E0',
    pillBackground: '#FFD54A',
    pillText: '#1F2328',
  },
  {
    level: 4,
    title: '很有料',
    description: '終究，要找人吃一個大披薩。',
    background: '#EAF7EF',
    pillBackground: '#15803D',
    pillText: '#FFFFFF',
  },
  {
    level: 5,
    title: '豪華牽絲',
    description: '起司多到天～邊去啦！',
    background: '#FFF3D6',
    pillBackground: '#FFB800',
    pillText: '#1F2328',
  },
];

const sources: Record<PizzaLevel, number> = {
  1: require('../../assets/images/pizza/pizza-lv1.svg'),
  2: require('../../assets/images/pizza/pizza-lv2.svg'),
  3: require('../../assets/images/pizza/pizza-lv3.svg'),
  4: require('../../assets/images/pizza/pizza-lv4.svg'),
  5: require('../../assets/images/pizza/pizza-lv5.svg'),
};

export function PizzaLevelIcon({ level, size = 44 }: { level: PizzaLevel; size?: number }) {
  const { title, description } = pizzaLevels[level - 1];
  return (
    <Image
      accessible
      accessibilityLabel={`${levelLabel(level)}，${title}：${description}`}
      source={sources[level]}
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}
