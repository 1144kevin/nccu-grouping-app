import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { api } from '@/lib/api';
import { coreError } from '@/lib/core-api';

type Readiness = {
  data_mode: string;
  google_ios_configured: boolean;
  images_configured: boolean;
  ai_provider: string;
};

export function CoreConnectionStatus() {
  const [result, setResult] = useState<Readiness | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult((await api.get<Readiness>('/development/readiness')).data);
    } catch (error) {
      setError(coreError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <Text>測試連線與功能狀態</Text>
      <Text>圖片僅支援拼單單張附圖；語音、聊天附件與手機推播尚未提供。提醒需開啟 App 查看。</Text>
      <PrimaryButton
        secondary
        disabled={busy}
        onPress={() => {
          void check();
        }}
      >
        {busy ? '正在檢查連線…' : '檢查目前測試連線'}
      </PrimaryButton>
      {result ? (
        <Text accessibilityRole="alert">
          API 已連線。{result.data_mode === 'supabase' ? 'Supabase 模式' : '離線模式'}；原生 Google
          登入{result.google_ios_configured ? '已設定，仍需實機驗證' : '尚未啟用'}；圖片
          {result.images_configured ? '已設定' : '未啟用，可先發布文字'}；自然語言
          {result.ai_provider === 'ollama_local'
            ? '使用電腦本機模型'
            : '未連接模型，請用手動需求表單'}
          。此檢查不驗證登入、資料庫或 TestFlight 可用性。
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert">
          無法確認 API 連線：{error}。請確認測試電腦已啟動服務、裝置連線設定及 HTTPS
          憑證；登入資料不會因此清除。
        </Text>
      ) : null}
    </View>
  );
}
