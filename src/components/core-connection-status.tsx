import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { api } from '@/lib/api';
import { coreError } from '@/lib/core-api';
import { APPLE_INTAKE_ENABLED } from '@/lib/apple-intake';
import { isExpoGo } from '@/lib/app-runtime';
import {
  connectionEndpoint,
  connectionErrorCode,
  nativeTransportMessage,
  probeApiTransport,
} from '@/lib/connection-diagnostics';

type Readiness = {
  data_mode: string;
  google_ios_configured: boolean;
  images_configured: boolean;
  ai_provider: string;
  semantic_configured?: boolean;
};

export function CoreConnectionStatus() {
  const [result, setResult] = useState<Readiness | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [transport, setTransport] = useState<number | null>(null);
  const [failureCode, setFailureCode] = useState('');
  const [nativeMessage, setNativeMessage] = useState('');
  async function check() {
    setBusy(true);
    setError('');
    setResult(null);
    setTransport(null);
    setFailureCode('');
    setNativeMessage('');
    try {
      const status = await probeApiTransport(api.defaults.baseURL);
      setTransport(status);
      if (status !== 200) {
        setFailureCode(`HTTP ${status}`);
        setError('手機已收到後端回應，請檢查裝置來源限制與後端狀態。');
        return;
      }
      setResult((await api.get<Readiness>('/development/readiness')).data);
    } catch (error) {
      setFailureCode(connectionErrorCode(error));
      const native = nativeTransportMessage(error);
      setNativeMessage(native);
      setError(native ? '手機原生連線失敗，系統原因見上方' : coreError(error).replace(/。+$/, ''));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <Text>測試連線與功能狀態</Text>
      <Text>目前 API：{connectionEndpoint(api.defaults.baseURL)}</Text>
      <Text>圖片僅支援拼單單張附圖；語音、聊天附件與手機推播尚未提供。提醒需開啟 App 查看。</Text>
      <PrimaryButton
        secondary
        disabled={busy}
        onPress={() => {
          void check();
        }}
        loading={busy}
      >
        {busy ? '正在檢查連線' : '檢查目前測試連線'}
      </PrimaryButton>
      {transport !== null ? (
        <Text>手機直接連線：HTTP {transport}（未使用帳密或登入儲存）</Text>
      ) : null}
      {nativeMessage ? <Text>手機系統回報：{nativeMessage}</Text> : null}
      {result ? (
        <Text accessibilityRole="alert">
          API 已連線。{result.data_mode === 'supabase' ? 'Supabase 模式' : '離線模式'}；
          {isExpoGo()
            ? 'Expo Go 使用信箱登入，Google／Apple 裝置 AI 需原生開發版'
            : `原生 Google 登入${result.google_ios_configured ? '已設定，仍需實機驗證' : '尚未啟用'}`}
          ；圖片
          {result.images_configured ? '已設定' : '未啟用，可先發布文字'}；自然語言
          {APPLE_INTAKE_ENABLED
            ? '由 iPhone Apple AI 提供訪談摘要，採用前請人工核對'
            : result.ai_provider === 'ollama_local'
              ? '使用電腦本機模型'
              : '未連接模型，請用手動需求表單'}
          ；語義配對
          {result.semantic_configured
            ? '已設定電腦模型，仍需建立本人需求索引'
            : '未啟用，可先使用一般配對'}
          。此檢查不驗證登入、資料庫或 TestFlight 可用性。
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert">
          {transport === 200 ? '手機 HTTPS 已通，但 App API 檢查失敗' : '無法確認 API 連線'}：
          {error}
          。診斷代碼：{failureCode}。若 Safari 已正常，請完整關閉 Expo Go
          再重開並重試；登入資料不會因此清除。
        </Text>
      ) : null}
    </View>
  );
}
