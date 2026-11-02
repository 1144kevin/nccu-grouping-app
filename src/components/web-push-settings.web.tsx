import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from './app-text';
import { PrimaryButton } from './primitives';
import { coreError } from '@/lib/core-api';
import {
  enableWebPush,
  disablePushForLogout,
  supportsWebPush,
  sendTestPush,
  hasWebPush,
} from '@/lib/web-push.web';
import { colors } from '@/theme/tokens';

export function WebPushSettings() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    void hasWebPush()
      .then(setEnabled)
      .catch(() => undefined);
  }, []);
  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage('');
    try {
      await work();
      setEnabled(await hasWebPush());
      setMessage(success);
    } catch (error) {
      setMessage(coreError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10, paddingVertical: 12 }}>
      <Text style={{ fontWeight: '700', fontSize: 16 }}>手機推播</Text>
      <Text style={{ color: colors.muted, lineHeight: 22 }}>
        iPhone 請從主畫面的 Web App 開啟，並允許通知。啟用後，申請獲接受及新的聊天訊息會送到手機。
      </Text>
      {!supportsWebPush() ? (
        <Text>目前環境尚不支援推播，請使用 iOS 16.4 以上並加入主畫面。</Text>
      ) : (
        <>
          <PrimaryButton
            loading={busy}
            disabled={busy}
            onPress={() =>
              void run(
                enabled ? disablePushForLogout : enableWebPush,
                enabled ? '已關閉手機推播' : '已開啟手機推播，可傳送測試通知。',
              )
            }
          >
            {enabled ? '關閉手機推播' : '開啟手機推播'}
          </PrimaryButton>
          {enabled ? (
            <PrimaryButton
              secondary
              disabled={busy}
              onPress={() => void run(sendTestPush, '測試通知已送出，請查看通知中心。')}
            >
              傳送測試通知
            </PrimaryButton>
          ) : null}
        </>
      )}
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}
