import { useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { AppText as Text } from '@/components/app-text';
import { buildPickupMap, readMapMessage } from '@/lib/pickup-map';
import type { Coordinates } from '@/types/domain';

export function PickupMap({ initial, onPick }: { initial: Coordinates; onPick: (value: Coordinates) => void }) {
  const [channel] = useState(() => `pickup-${Math.random().toString(36).slice(2)}`);
  const [html] = useState(() => buildPickupMap(initial, channel));
  const [failed, setFailed] = useState(false);
  return <View style={{ height: 360, width: '100%' }}>
    <WebView
      source={{ html }}
      originWhitelist={['*']}
      userAgent="NCCUGrouping/1.0 PickupMap"
      javaScriptEnabled
      domStorageEnabled={false}
      geolocationEnabled={false}
      allowsInlineMediaPlayback={false}
      setSupportMultipleWindows={false}
      mixedContentMode="never"
      allowFileAccess={false}
      onError={() => setFailed(true)}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank' || request.url.startsWith('about:blank#')) return true;
        if (request.url === 'https://www.openstreetmap.org/copyright') {
          void Linking.openURL(request.url).catch(() => setFailed(true));
        }
        return false;
      }}
      onMessage={(event) => { const point = readMapMessage(event.nativeEvent.data, channel); if (point) onPick(point); }}
      style={{ flex: 1 }}
    />
    {failed ? <Text accessibilityRole="alert">地圖載入失敗，可改用常用地點、搜尋或目前定位。</Text> : null}
  </View>;
}
