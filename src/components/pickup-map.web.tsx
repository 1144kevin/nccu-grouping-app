import { useEffect, useRef, useState } from 'react';
import { buildPickupMap, readMapMessage } from '@/lib/pickup-map';
import type { Coordinates } from '@/types/domain';

export function PickupMap({ initial, onPick }: { initial: Coordinates; onPick: (value: Coordinates) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => `pickup-${Math.random().toString(36).slice(2)}`);
  const [html] = useState(() => buildPickupMap(initial, channel));
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const point = readMapMessage(event.data, channel);
      if (point) onPick(point);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [channel, onPick]);
  return <iframe ref={frame} title="取餐地圖" srcDoc={html}
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    referrerPolicy="strict-origin-when-cross-origin"
    style={{ width: '100%', height: 360, border: 0 }} />;
}
