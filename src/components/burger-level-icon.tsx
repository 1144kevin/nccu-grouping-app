import { Image } from 'expo-image';

export type BurgerLevel = 1 | 2 | 3 | 4 | 5;
type Ingredient = 'lettuce' | 'patty' | 'bacon' | 'cheese' | 'tomato';

const recipes: Record<BurgerLevel, Ingredient[]> = {
  1: ['lettuce'],
  2: ['lettuce', 'patty'],
  3: ['lettuce', 'tomato', 'cheese', 'patty'],
  4: ['lettuce', 'tomato', 'cheese', 'bacon', 'patty'],
  5: ['lettuce', 'tomato', 'cheese', 'bacon', 'patty', 'lettuce', 'tomato', 'cheese', 'bacon', 'patty'],
};

export const burgerLevelDescriptions: Record<BurgerLevel, string> = {
  1: '生菜入門堡：兩片麵包夾一層生菜',
  2: '肉香漢堡：加入一片肉排',
  3: '起司番茄堡：加入起司與番茄',
  4: '培根全配堡：加入培根，配料完整',
  5: '豪華雙層堡：雙層肉、雙層生菜、雙層起司、雙層培根、雙層番茄',
};

// Each ingredient uses the same local 12-unit height, compressed for the double burger.
const layers: Record<Ingredient, string> = {
  lettuce: `<path d="M5 4 Q11 -1 18 2 Q25 -2 32 2 Q39 -2 47 1 Q56 -2 63 2 Q72 -1 79 2 Q87 0 92 4 L89 9 Q84 14 77 9 Q70 14 63 9 Q56 14 48 9 Q39 14 32 9 Q23 14 16 9 Q8 13 5 4Z" fill="url(#lettuce)"/><path d="M10 4 Q18 8 25 4 T42 4 T59 4 T76 4 T88 4" fill="none" stroke="#C5EA71" stroke-width="1.5" stroke-linecap="round"/>`,
  patty: `<path d="M9 2 Q20 -1 48 0 Q77 -1 87 2 Q93 7 86 11 Q66 14 47 12 Q22 14 9 10 Q4 6 9 2Z" fill="url(#patty)"/><path d="M13 3 Q35 0 82 3" fill="none" stroke="#B37446" stroke-width="1.4" stroke-linecap="round"/><path d="M18 7 L22 8 M33 4 L38 5 M49 8 L53 9 M66 5 L71 6 M78 8 L81 7" stroke="#3B2116" stroke-width="1.4" stroke-linecap="round"/>`,
  tomato: `<path d="M9 2 Q48 -2 87 2 L87 8 Q48 15 9 8Z" fill="url(#tomato)"/><path d="M15 3 Q48 0 81 3" fill="none" stroke="#FFAB78" stroke-width="1.5" stroke-linecap="round"/><path d="M22 6 L30 7 M44 7 L51 7 M66 7 L74 6" stroke="#FFCE8D" stroke-width="1" stroke-linecap="round"/>`,
  cheese: `<path d="M8 1 Q48 -1 87 1 L83 7 L67 7 L59 14 L47 8 L30 8 L22 12 L12 7Z" fill="url(#cheese)"/><path d="M14 2 Q48 0 82 2" fill="none" stroke="#FFF3A1" stroke-width="1.5" stroke-linecap="round"/>`,
  bacon: `<path d="M8 3 Q20 -2 33 2 Q48 7 61 2 Q74 -1 88 2 L88 10 Q73 7 61 11 Q47 15 33 10 Q19 6 8 11Z" fill="url(#bacon)"/><path d="M11 5 Q22 1 34 5 Q48 10 62 5 Q75 2 85 5 M12 9 Q23 5 34 9 Q48 13 62 9 Q75 6 85 9" fill="none" stroke="#F5B38D" stroke-width="1.4" stroke-linecap="round"/>`,
};

function burgerSource(level: BurgerLevel) {
  const recipe = recipes[level];
  const top = 25 - level * 1.5;
  const bunHeight = 28 - level;
  const fillingTop = top + bunHeight - 2;
  const fillingHeight = 10 + level * 3;
  const step = fillingHeight / recipe.length;
  const bottom = fillingTop + fillingHeight;
  const ingredients = recipe.map((kind, index) =>
    `<g transform="translate(0 ${fillingTop + index * step}) scale(1 ${step / 12})">${layers[kind]}</g>`,
  ).reverse().join('');
  const sesame = [[26, 11, -28], [39, 6, 20], [53, 7, -23], [68, 12, 25], [34, 18, 20], [57, 17, -20], [76, 20, -30]]
    .map(([x, y, angle]) => `<ellipse cx="${x}" cy="${top + y * bunHeight / 28}" rx="2.3" ry="0.95" transform="rotate(${angle} ${x} ${top + y * bunHeight / 28})" fill="#FFF1BC" stroke="#DDA450" stroke-width="0.35"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="bun" cx="38%" cy="22%" r="80%"><stop stop-color="#FFE49A"/><stop offset="0.42" stop-color="#F5B94E"/><stop offset="0.8" stop-color="#DF8C28"/><stop offset="1" stop-color="#AA5419"/></radialGradient>
      <linearGradient id="bottom" x2="0" y2="1"><stop stop-color="#FFD77A"/><stop offset="0.45" stop-color="#EDAA43"/><stop offset="1" stop-color="#B96B24"/></linearGradient>
      <linearGradient id="lettuce" x2="0" y2="1"><stop stop-color="#B5D951"/><stop offset="0.45" stop-color="#79BC37"/><stop offset="1" stop-color="#358329"/></linearGradient>
      <linearGradient id="patty" x2="0" y2="1"><stop stop-color="#9B6037"/><stop offset="0.45" stop-color="#704024"/><stop offset="1" stop-color="#44291C"/></linearGradient>
      <linearGradient id="tomato" x2="0" y2="1"><stop stop-color="#FF7950"/><stop offset="0.45" stop-color="#ED4028"/><stop offset="1" stop-color="#B9261A"/></linearGradient>
      <linearGradient id="cheese" x2="0" y2="1"><stop stop-color="#FFE778"/><stop offset="0.5" stop-color="#FFC72F"/><stop offset="1" stop-color="#E79916"/></linearGradient>
      <linearGradient id="bacon" x2="0" y2="1"><stop stop-color="#D67D55"/><stop offset="0.5" stop-color="#AD4B32"/><stop offset="1" stop-color="#77301F"/></linearGradient>
    </defs>
    <ellipse cx="48" cy="${bottom + 13}" rx="37" ry="3" fill="#75421E" opacity="0.12"/>
    <path d="M10 ${bottom - 1} Q48 ${bottom - 5} 86 ${bottom - 1} L85 ${bottom + 6} Q82 ${bottom + 14} 48 ${bottom + 14} Q14 ${bottom + 14} 11 ${bottom + 6}Z" fill="url(#bottom)"/>
    <path d="M15 ${bottom + 3} Q48 ${bottom + 9} 81 ${bottom + 3}" fill="none" stroke="#FFE6A5" stroke-width="1.8" opacity="0.65"/>
    ${ingredients}
    <path d="M9 ${top + bunHeight - 3} C10 ${top + 7} 26 ${top} 47 ${top} C70 ${top - 1} 86 ${top + 8} 87 ${top + bunHeight - 3} Q87 ${top + bunHeight + 2} 48 ${top + bunHeight + 2} Q9 ${top + bunHeight + 2} 9 ${top + bunHeight - 3}Z" fill="url(#bun)"/>
    <path d="M17 ${top + bunHeight - 3} Q48 ${top + bunHeight + 1} 80 ${top + bunHeight - 3}" fill="none" stroke="#FFE1A0" stroke-width="1.2" opacity="0.7"/>
    ${sesame}
  </svg>`;
  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

const sources = { 1: burgerSource(1), 2: burgerSource(2), 3: burgerSource(3), 4: burgerSource(4), 5: burgerSource(5) };

export function BurgerLevelIcon({ level, size = 44 }: { level: BurgerLevel; size?: number }) {
  return (
    <Image
      accessible
      accessibilityLabel={`Lv.${level}，${burgerLevelDescriptions[level]}`}
      source={sources[level]}
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}
