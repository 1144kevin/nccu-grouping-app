import { CorePostImage } from './core-post-image';
import { updateCachedPost } from '@/lib/core-post-cache';
import { queryClient } from '@/lib/query-client';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { InlineLoading } from '@/components/inline-loading';
import { PageLoading } from '@/components/page-loading';
import { useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { pickPostImages } from '@/lib/pick-post-images';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView as NativeScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardScrollView as ScrollView, KeyboardViewport } from '@/components/keyboard-layout';
import { z } from 'zod';
import { IconButton, PrimaryButton, SectionTitle, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { LocationPicker } from '@/components/location-picker';
import {
  DeadlinePickerModal,
  createInitialDeadline,
  startOfDay,
  formatDeadline,
} from '@/components/deadline-picker';
import {
  CORE_API_ENABLED,
  CORE_SUPABASE_MODE,
  coreApi,
  coreError,
  newRequestKey,
  type CorePost,
} from '@/lib/core-api';
import { mediaApi, validPickedImage } from '@/lib/media-api';
import { useCoreClock } from '@/lib/core-clock';
import { invalidateCore } from '@/lib/core-hooks';
import { showPublishedPost } from '@/lib/feed-presentation';
import { PostWritingAssistant } from '@/components/post-writing-assistant';
import { TagChip } from '@/components/tag-chip';
import { SettingField } from '@/components/setting-field';
import { parsePrice, priceInputSchema } from '@/lib/price';
import { capacityInputSchema } from '@/lib/capacity';
import { postLocationSchema } from '@/lib/location';
import { colors, radius, spacing, typography, yellowSurface } from '@/theme/tokens';

const schema = z
  .object({
    content: z.string().trim().min(10, '至少輸入 10 個字').max(500, '最多 500 個字'),
    location: postLocationSchema,
    price: priceInputSchema,
    capacity: capacityInputSchema,
  })
  .superRefine((value, context) => {
    if (CORE_API_ENABLED && (Number(value.capacity) < 2 || Number(value.capacity) > 20))
      context.addIssue({
        code: 'custom',
        path: ['capacity'],
        message: '拼單人數需為 2～20 人（含主揪）',
      });
  });
type FormValues = z.infer<typeof schema>;
const suggestedTags = ['晚餐', '便當', '飲料', '宵夜', '剩食分享'];

export default function CreateScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  return CORE_API_ENABLED ? <ClockReadyCreate key={actor} /> : <PostComposer />;
}

function ClockReadyCreate() {
  const clock = useCoreClock();
  if (!clock.data)
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {clock.isPending ? (
            <PageLoading accessibilityLabel="正在取得截止時間基準" />
          ) : (
            <Text>{coreError(clock.error)}</Text>
          )}
          <PrimaryButton
            secondary
            disabled={clock.isFetching}
            onPress={() => {
              void clock.refetch();
            }}
          >
            重新取得時間
          </PrimaryButton>
        </View>
      </Screen>
    );
  return <PostComposer now={clock.now} clockDrift={Math.abs(clock.data.driftMs) > 60_000} />;
}

export function PostComposer({
  now = Date.now,
  clockDrift = false,
  post,
}: {
  now?: () => number;
  clockDrift?: boolean;
  post?: CorePost;
  onReload?: () => Promise<unknown>;
}) {
  const publishPost = useAppStore((state) => state.publishPost);
  const publication = useRef<{ payload: string; key: string } | null>(null);
  const publishing = useRef(false);
  const [tags, setTags] = useState(post?.tags ?? ['拼單']);
  const [version] = useState(post?.version ?? 1);
  const locked = !!post && post.can_edit !== true;
  const [photos, setPhotos] = useState<
    { id: string; uri: string; width: number; height: number; base64?: string; remote?: boolean }[]
  >(() =>
    (post?.images?.length
      ? post.images
      : post?.image_id
        ? [{ id: post.image_id, width: 1, height: 1 }]
        : []
    ).map((image) => ({ ...image, uri: '', remote: true })),
  );
  const uploadedImages = useRef(new Map<string, string>());
  const [imageError, setImageError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const imageOperation = useRef(false);
  const [writingBusy, setWritingBusy] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string>();
  const [deadline, setDeadline] = useState(() =>
    post ? new Date(post.deadline_at) : createInitialDeadline(now()),
  );
  const [draftDeadline, setDraftDeadline] = useState(deadline);
  const [deadlineStartDate, setDeadlineStartDate] = useState(() => startOfDay(now()));
  const [clockReference] = useState(() => formatDeadline(new Date(now())));
  const [deadlineModalVisible, setDeadlineModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [locationKey, setLocationKey] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    setValue,
    setError,
    clearErrors,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      content: post?.content ?? '',
      price: post?.price_per_person == null ? '' : String(post.price_per_person),
      capacity: String(post?.capacity ?? 4),
      ...(post
        ? {
            location: {
              ...post.location,
              address: post.location.address ?? undefined,
              source: post.location.source ?? undefined,
            },
          }
        : {}),
    },
  });
  const content = useWatch({ control, name: 'content' });
  const writingFields = useWatch({ control });
  const capacityInput = useWatch({ control, name: 'capacity' });
  // A server error must not lock an otherwise valid draft out of retrying.
  const formReady = !locked && schema.safeParse(writingFields).success;
  const submitDisabled =
    (post ? locked : !formReady) || !tags.length || isSubmitting || imageBusy || writingBusy;
  const capacity = Number(capacityInput);

  function stepCapacity(amount: number) {
    const current = Number.isSafeInteger(capacity) && capacityInput.trim() !== '' ? capacity : 1;
    setValue(
      'capacity',
      String(
        CORE_API_ENABLED
          ? Math.min(20, Math.max(2, current + amount))
          : Math.max(1, current + amount),
      ),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function pickImage() {
    if (locked || imageOperation.current || publishing.current || photos.length >= 5) return;
    imageOperation.current = true;
    const actor = useAuthStore.getState().user?.id;
    setImageError('');
    setImageBusy(true);
    try {
      const result = await pickPostImages(5 - photos.length);
      if (useAuthStore.getState().user?.id !== actor) return;
      if (!result.canceled) {
        if (photos.length + result.assets.length > 5) throw new Error('too_many_post_images');
        const selected = result.assets.map((asset) => ({
          id: newRequestKey(),
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          base64:
            CORE_API_ENABLED && CORE_SUPABASE_MODE
              ? validPickedImage(asset.base64, asset.width, asset.height)
              : undefined,
        }));
        setPhotos((current) => [...current, ...selected]);
      }
    } catch (error) {
      setImageError(coreError(error));
    } finally {
      imageOperation.current = false;
      setImageBusy(false);
    }
  }

  async function removeImage(key: string) {
    if (locked || imageOperation.current || publishing.current) return;
    imageOperation.current = true;
    setImageBusy(true);
    setImageError('');
    try {
      const uploaded = uploadedImages.current.get(key);
      if (uploaded) await mediaApi.remove(uploaded);
      uploadedImages.current.delete(key);
      setPhotos((current) => current.filter((photo) => photo.id !== key));
    } catch (error) {
      setImageError(coreError(error));
    } finally {
      imageOperation.current = false;
      setImageBusy(false);
    }
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      setVoiceUri(recorder.uri ?? undefined);
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted)
      return Alert.alert('需要麥克風權限', '請允許使用麥克風，才能建立語音貼文。');
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  function leave() {
    if (post) {
      if (router.canGoBack()) router.back();
      else router.replace(`/order/${post.id}`);
    } else router.replace('/');
  }
  function close() {
    if (imageBusy || publishing.current) return;
    const originalIds = post?.images?.length
      ? post.images.map((image) => image.id)
      : post?.image_id
        ? [post.image_id]
        : [];
    const photoChanged =
      JSON.stringify(originalIds) !== JSON.stringify(photos.map((photo) => photo.id));
    if (
      !isDirty &&
      !photoChanged &&
      !voiceUri &&
      JSON.stringify(tags) === JSON.stringify(post?.tags ?? ['拼單']) &&
      (!post ||
        deadline.toISOString() === post.deadline_at ||
        deadline.getTime() === new Date(post.deadline_at).getTime())
    )
      return leave();
    if (Platform.OS === 'web') {
      if (window.confirm('尚未儲存的內容不會被保留，確定要離開嗎？')) leave();
      return;
    }
    Alert.alert(post ? '捨棄這次變更？' : '捨棄這篇貼文？', '尚未儲存的內容不會被保留。', [
      { text: '繼續編輯', style: 'cancel' },
      { text: '捨棄', style: 'destructive', onPress: leave },
    ]);
  }
  async function writingImages() {
    const actor = useAuthStore.getState().user?.id;
    const images: string[] = [];
    for (const photo of photos) {
      if (useAuthStore.getState().user?.id !== actor) throw new Error('invalid_or_expired_session');
      images.push(photo.base64 ?? (await mediaApi.content(photo.id)).content_base64);
    }
    return images;
  }

  const submit = () =>
    handleSubmit(
      async (values) => {
        if (locked || publishing.current || imageBusy || writingBusy) return;
        if (!tags.length) return Alert.alert('請選擇標籤', '至少需要一個主題標籤。');
        publishing.current = true;
        const actor = useAuthStore.getState().user?.id;
        clearErrors('root');
        try {
          if (CORE_API_ENABLED) {
            const input = {
              content: values.content.trim(),
              location: values.location,
              tags,
              deadline_at: deadline.toISOString(),
              capacity: Number(values.capacity),
              price_per_person: values.price.trim() || null,
            };
            const payload = JSON.stringify({
              ...input,
              image_keys: photos.map((photo) => photo.id),
            });
            if (deadline.getTime() <= now() && publication.current?.payload !== payload)
              throw new Error('deadline_must_be_within_14_days');
            if (publication.current?.payload !== payload)
              publication.current = { payload, key: newRequestKey() };
            let created;
            if (CORE_SUPABASE_MODE && (photos.length || post)) {
              const ids: string[] = [];
              for (const photo of photos) {
                if (useAuthStore.getState().user?.id !== actor)
                  throw new Error('invalid_or_expired_session');
                let uploaded = photo.remote ? photo.id : uploadedImages.current.get(photo.id);
                if (!uploaded) {
                  const asset = await mediaApi.upload(photo.base64!, photo.id);
                  uploaded = asset.id;
                  uploadedImages.current.set(photo.id, uploaded);
                }
                ids.push(uploaded);
              }
              if (useAuthStore.getState().user?.id !== actor)
                throw new Error('invalid_or_expired_session');
              const originalIds = post?.images?.length
                ? post.images.map((image) => image.id)
                : post?.image_id
                  ? [post.image_id]
                  : [];
              created = post
                ? JSON.stringify(ids) === JSON.stringify(originalIds)
                  ? await coreApi.edit(post.id, { ...input, expected_version: version })
                  : await mediaApi.edit(post.id, input, ids, version)
                : await mediaApi.publish(input, ids, publication.current.key);
            } else
              created = post
                ? await coreApi.edit(post.id, { ...input, expected_version: version })
                : await coreApi.create(input, publication.current.key);
            if (useAuthStore.getState().user?.id !== actor) return;
            if (actor) {
              if (post) updateCachedPost(queryClient, actor, created);
              else showPublishedPost(actor, created);
            }
            await invalidateCore();
            if (useAuthStore.getState().user?.id !== actor) return;
          } else {
            publishPost({
              content: values.content.trim(),
              location: values.location,
              pricePerPerson: parsePrice(values.price),
              tags,
              deadline: formatDeadline(deadline),
              capacity: Number(values.capacity),
              imageUrl: photos[0]?.uri,
              photos: photos.map(({ id, uri, width, height }) => ({ id, uri, width, height })),
              voiceUri,
            });
          }
          if (post) {
            publication.current = null;
            leave();
            return;
          }
          publication.current = null;
          reset();
          setLocationKey((key) => key + 1);
          setPhotos([]);
          uploadedImages.current.clear();
          setVoiceUri(undefined);
          setTags(['拼單']);
          router.replace('/');
        } catch (error) {
          setError('root.server', { message: coreError(error) });
        } finally {
          publishing.current = false;
        }
      },
      () => {
        setError('root.server', { message: '請檢查貼文內容、取餐地點、金額及人數後再儲存。' });
      },
    )();

  function addCustomTag() {
    const tag = customTag.trim().slice(0, 12);
    if (!tag) return;
    setTags((items) => [...new Set([...items, tag])]);
    setCustomTag('');
    setTagModalVisible(false);
  }

  function openDeadlinePicker() {
    setDeadlineStartDate(startOfDay(now()));
    setDraftDeadline(new Date(deadline));
    setDeadlineModalVisible(true);
  }

  function applyDeadline() {
    if (draftDeadline.getTime() <= now()) {
      Alert.alert('截止時間已過', '請選擇晚於目前時間的截止時間。');
      return;
    }
    setDeadline(new Date(draftDeadline));
    setDeadlineModalVisible(false);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <IconButton
            icon="close"
            label="關閉"
            disabled={isSubmitting || imageBusy}
            onPress={close}
          />
        </View>
        <Text style={styles.title}>{post ? '編輯拼單' : '建立新貼文'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            post ? (isSubmitting ? '儲存中' : '儲存拼單變更') : isSubmitting ? '發布中' : '發布'
          }
          accessibilityState={{ busy: isSubmitting }}
          disabled={submitDisabled}
          onPress={submit}
          style={[styles.publish, submitDisabled && styles.publishDisabled]}
        >
          {isSubmitting ? (
            <InlineLoading label={post ? '儲存中' : '發布中'} showLabel={false} />
          ) : (
            <Text style={styles.publishText}>{post ? '儲存' : '發布'}</Text>
          )}
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {post && locked ? (
            <Text style={styles.fieldHint}>
              這筆拼單已截止、取消，或已有待審申請／團員，現在無法修改。
            </Text>
          ) : null}
          {clockDrift ? (
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              裝置與服務時間不同，截止時間以服務時間為準。載入時服務時間：{clockReference}
            </Text>
          ) : null}
          {errors.root?.server ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.root.server.message}
            </Text>
          ) : null}
          {CORE_API_ENABLED && !CORE_SUPABASE_MODE ? (
            <Text style={styles.fieldHint}>目前可發布文字拼單。</Text>
          ) : (
            <>
              <NativeScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.mediaScroller}
                contentContainerStyle={styles.mediaRow}
              >
                {photos.map((photo, index) => (
                  <View key={photo.id} style={styles.photoTile}>
                    {photo.remote ? (
                      <CorePostImage imageId={photo.id} frameHeight={84} fit="cover" />
                    ) : (
                      <Image
                        accessibilityLabel={`待發佈的圖片預覽 ${index + 1}`}
                        source={{ uri: photo.uri }}
                        resizeMode="cover"
                        style={styles.thumbnail}
                      />
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`移除第 ${index + 1} 張圖片`}
                      disabled={locked || isSubmitting || imageBusy}
                      onPress={() => {
                        void removeImage(photo.id);
                      }}
                      hitSlop={8}
                      style={styles.removeMedia}
                    >
                      <MaterialCommunityIcons name="close" size={13} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="新增圖片"
                  disabled={locked || isSubmitting || imageBusy || photos.length >= 5}
                  onPress={() => {
                    void pickImage();
                  }}
                  style={styles.mediaButton}
                >
                  {imageBusy ? (
                    <InlineLoading label="處理中" textStyle={styles.mediaLabel} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="image-plus-outline"
                        size={21}
                        color={colors.ink}
                      />
                      <Text style={styles.mediaLabel}>{`新增圖片\n(${photos.length}/5)`}</Text>
                    </>
                  )}
                </Pressable>
                {!CORE_API_ENABLED ? (
                  <Pressable
                    onPress={toggleRecording}
                    style={[styles.mediaButton, recorderState.isRecording && styles.recording]}
                  >
                    <MaterialCommunityIcons
                      name={recorderState.isRecording ? 'stop' : 'microphone-outline'}
                      size={21}
                      color={recorderState.isRecording ? colors.danger : colors.ink}
                    />
                    <Text style={styles.mediaLabel}>
                      {recorderState.isRecording
                        ? `${Math.max(1, Math.round(recorderState.durationMillis / 1000))} 秒`
                        : voiceUri
                          ? '已錄音'
                          : '語音'}
                    </Text>
                  </Pressable>
                ) : null}
              </NativeScrollView>
              {CORE_API_ENABLED ? (
                <Text style={[styles.fieldHint, styles.mediaHint]}>
                  最多可加入 5 張圖片，支援 HEIC；大圖會自動壓縮後上傳。
                  {photos.length ? `會一起辨識這 ${photos.length} 張照片，不用輸入文字。` : ''}
                </Text>
              ) : null}
              {imageError ? (
                <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                  {imageError}
                </Text>
              ) : null}
            </>
          )}
          <Controller
            control={control}
            name="content"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                accessibilityLabel="拼單內容"
                editable={!locked && !isSubmitting}
                multiline
                maxLength={500}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="分享想揪的餐點、價格、取餐地點等資訊..."
                placeholderTextColor={colors.subtle}
                style={styles.editor}
                textAlignVertical="top"
              />
            )}
          />
          <View style={styles.counterRow}>
            <Text style={styles.error}>{errors.content?.message}</Text>
            <Text style={styles.counter}>{content.length}/500</Text>
          </View>
          {CORE_API_ENABLED ? (
            <PostWritingAssistant
              content={content}
              imageKey={photos.map((photo) => photo.id).join(',')}
              getImageBase64s={photos.length ? writingImages : undefined}
              imageBase64s={photos.flatMap((photo) => (photo.base64 ? [photo.base64] : []))}
              context={JSON.stringify({
                tags,
                deadline,
                capacity: writingFields.capacity,
                price: writingFields.price,
                location: writingFields.location,
              })}
              disabled={locked || isSubmitting || imageBusy}
              onBusyChange={setWritingBusy}
              onApply={(text) =>
                setValue('content', text, { shouldDirty: true, shouldValidate: true })
              }
            />
          ) : null}
          <SectionTitle>主題標籤</SectionTitle>
          <View style={styles.tagRow}>
            {[...new Set([...suggestedTags, ...tags])].map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                selected={tags.includes(tag)}
                onPress={() => {
                  if (publishing.current) return;
                  setTags((items) =>
                    items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag],
                  );
                }}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新增標籤"
              disabled={locked || isSubmitting}
              onPress={() => setTagModalVisible(true)}
              style={({ pressed }) => [styles.addTag, pressed && { opacity: 0.6 }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <SectionTitle>拼單設定</SectionTitle>
          <SettingField icon="clock-outline" title="截止時間">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="選擇截止時間"
              disabled={locked || isSubmitting}
              onPress={openDeadlinePicker}
              style={styles.settingControl}
            >
              <Text style={styles.controlValue}>{formatDeadline(deadline)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={17} color={colors.muted} />
            </Pressable>
          </SettingField>
          <SettingField icon="account-group-outline" title="需求人數">
            <View style={styles.settingControl}>
              <Text style={styles.peopleHint}>含主揪</Text>
              <IconButton
                icon="minus"
                label="減少人數"
                disabled={locked || isSubmitting || capacity === (CORE_API_ENABLED ? 2 : 1)}
                onPress={() => stepCapacity(-1)}
              />
              <Controller
                control={control}
                name="capacity"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    accessibilityLabel="需求人數"
                    editable={!locked && !isSubmitting}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    selectTextOnFocus
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    style={styles.capacity}
                  />
                )}
              />
              <Text style={styles.currency}>人</Text>
              <IconButton
                icon="plus"
                label="增加人數"
                disabled={locked || isSubmitting || (CORE_API_ENABLED && capacity >= 20)}
                onPress={() => stepCapacity(1)}
              />
            </View>
            {errors.capacity ? (
              <Text style={styles.fieldError}>{errors.capacity.message}</Text>
            ) : null}
          </SettingField>
          <SettingField icon="cash" title="每人預估金額">
            <View style={styles.settingControl}>
              <Text style={styles.currency}>NT$</Text>
              <Controller
                control={control}
                name="price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    accessibilityLabel="每人預估金額"
                    editable={!locked && !isSubmitting}
                    keyboardType="decimal-pad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="未填寫則顯示待確認"
                    placeholderTextColor={colors.subtle}
                    style={styles.priceInput}
                  />
                )}
              />
              <Text style={styles.currency}>／人</Text>
            </View>
            {errors.price ? (
              <Text style={styles.fieldError}>{errors.price.message}</Text>
            ) : (
              <Text style={styles.fieldHint}>可填 0 表示免費，最多兩位小數。</Text>
            )}
          </SettingField>
          <SettingField icon="map-marker-outline" title="取餐地點（必填）">
            <View pointerEvents={isSubmitting ? 'none' : 'auto'}>
              <Controller
                control={control}
                name="location"
                render={({ field: { onChange, value } }) => (
                  <LocationPicker
                    key={locationKey}
                    value={value}
                    disabled={locked || isSubmitting}
                    onChange={(next) => {
                      if (!publishing.current) onChange(next);
                    }}
                  />
                )}
              />
            </View>
            {errors.location ? (
              <Text style={styles.fieldError}>請搜尋並選擇取餐地點，或使用目前位置。</Text>
            ) : null}
          </SettingField>
        </ScrollView>
      </View>
      <DeadlinePickerModal
        startDate={deadlineStartDate}
        value={draftDeadline}
        visible={deadlineModalVisible}
        onApply={applyDeadline}
        onChange={setDraftDeadline}
        onClose={() => setDeadlineModalVisible(false)}
      />
      <Modal
        animationType="fade"
        transparent
        visible={tagModalVisible}
        onRequestClose={() => setTagModalVisible(false)}
      >
        <KeyboardViewport>
          <Pressable style={styles.modalBackdrop} onPress={() => setTagModalVisible(false)}>
            <Pressable style={styles.modalSheet} onPress={() => undefined}>
              <Text style={styles.modalTitle}>新增主題標籤</Text>
              <TextInput
                autoFocus
                maxLength={12}
                value={customTag}
                onChangeText={setCustomTag}
                onSubmitEditing={addCustomTag}
                placeholder="例如：宵夜"
                placeholderTextColor={colors.subtle}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <PrimaryButton
                  secondary
                  style={styles.modalButton}
                  onPress={() => setTagModalVisible(false)}
                >
                  取消
                </PrimaryButton>
                <PrimaryButton
                  disabled={!customTag.trim()}
                  style={styles.modalButton}
                  onPress={addCustomTag}
                >
                  加入
                </PrimaryButton>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardViewport>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 54,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { width: 64, alignItems: 'flex-start' },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 18,
    fontWeight: '700',
  },
  publish: {
    minWidth: 64,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    ...yellowSurface,
    backgroundColor: colors.yellow,
  },
  publishDisabled: { backgroundColor: '#E4E4E2' },
  publishText: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  content: { padding: spacing.lg, paddingBottom: 120 },
  mediaScroller: { flexGrow: 0 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  mediaHint: { marginTop: 12, marginBottom: 12, lineHeight: 20 },
  photoTile: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden' },
  thumbnail: { width: 84, height: 84, borderRadius: radius.md },
  removeMedia: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000099',
  },
  mediaButton: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  recording: { borderColor: colors.danger, backgroundColor: '#FFF4F4' },
  mediaLabel: {
    color: colors.muted,
    fontFamily: typography.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    alignSelf: 'stretch',
  },
  editor: {
    minHeight: 185,
    paddingTop: 18,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  counterRow: { height: 24, flexDirection: 'row' },
  error: { flex: 1, color: colors.danger, fontSize: 13 },
  counter: { color: colors.muted, fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  addTag: {
    width: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.md,
  },
  settingControl: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  controlValue: { flex: 1, color: colors.ink, fontSize: 15 },
  capacity: {
    flex: 1,
    minWidth: 36,
    minHeight: 42,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  peopleHint: { fontSize: 14, color: colors.muted },
  currency: { fontSize: 14, color: colors.muted },
  priceInput: { flex: 1, minWidth: 0, minHeight: 42, color: colors.ink, fontSize: 15 },
  fieldHint: { color: colors.muted, fontSize: 13 },
  fieldError: { color: colors.danger, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: '#00000055',
  },
  modalSheet: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.background },
  modalTitle: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 17,
    fontWeight: '700',
  },
  modalInput: {
    fontSize: 16,
    height: 46,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.ink,
  },
  modalActions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  modalButton: { flex: 1 },
});
