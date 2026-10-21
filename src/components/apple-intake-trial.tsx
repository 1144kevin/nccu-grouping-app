import { useState } from 'react';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton, Screen } from '@/components/primitives';
import { SignalEditor } from '@/components/core-stealth';

export function AppleIntakeTrialScreen() {
  const [revision, setRevision] = useState(0);
  return (
    <Screen scroll>
      <Text style={{ fontSize: 24, fontWeight: '800', margin: 16 }}>政缺一咖 · 本機需求訪談</Text>
      <Text style={{ margin: 16 }}>
        先試用 iPhone 的 Apple AI
        與原本需求表單。本次只在畫面保留草稿，尚未登入，也不會發布、儲存到帳號或尋找配對。表單預設值需自行核對。
      </Text>
      <SignalEditor key={revision} now={Date.now} refresh={async () => {}} localOnly />
      <PrimaryButton secondary onPress={() => setRevision((value) => value + 1)}>
        清除本機草稿，重新開始
      </PrimaryButton>
    </Screen>
  );
}
