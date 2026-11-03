import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useAuthStore } from '@/store/auth-store';
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

export async function sendPushConfirmation() {
  await sendTestPush();
}

export function WebPushSettings({
  onEnabledChange,
}: {
  onEnabledChange?: (enabled: boolean) => void;
}) {
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
      const active = await hasWebPush();
      setEnabled(active);
      onEnabledChange?.(active);
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
                enabled ? '已關閉手機推播' : '已開啟手機推播。',
              )
            }
          >
            {enabled ? '關閉手機推播' : '開啟手機推播'}
          </PrimaryButton>
        </>
      )}
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}

export function WebPushOnboarding() {
  const actor = useAuthStore((state) => state.user?.id);
  const [visible, setVisible] = useState(
    () =>
      !!actor &&
      supportsWebPush() &&
      Notification.permission === 'default' &&
      !localStorage.getItem(`nccu-grouping.push-prompt.${actor}`),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (actor) localStorage.setItem(`nccu-grouping.push-prompt.${actor}`, 'seen');
    setVisible(false);
  }
  async function enable() {
    setBusy(true);
    setError('');
    try {
      await enableWebPush();
      await sendTestPush();
      close();
    } catch (e) {
      setError(coreError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}>
        <View
          style={{ backgroundColor: colors.background, borderRadius: 18, padding: 20, gap: 14 }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>開啟手機推播</Text>
          <Text>收到新訊息或申請獲接受時，讓手機通知你。</Text>
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
          <PrimaryButton loading={busy} disabled={busy} onPress={() => void enable()}>
            開啟通知
          </PrimaryButton>
          <PrimaryButton secondary disabled={busy} onPress={close}>
            稍後再說
          </PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}
