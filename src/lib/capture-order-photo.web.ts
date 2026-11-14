import { validPickedImage } from '@/lib/media-api';
import type { PickedPostImage } from './pick-post-images';

/** Opens a live camera stream; this flow never offers a photo-library picker. */
export async function captureOrderPhoto(): Promise<PickedPostImage | null> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera_unavailable');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  return new Promise((resolve, reject) => {
    let captured: PickedPostImage | null = null;
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: '#111',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '24px',
    });
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      textAlign: 'center',
    });
    const title = document.createElement('div');
    Object.assign(title.style, {
      color: '#ffffff',
      fontSize: '18px',
      fontWeight: '700',
    });
    const subtitle = document.createElement('div');
    Object.assign(subtitle.style, {
      color: '#d4d4d8',
      fontSize: '14px',
    });
    header.append(title, subtitle);

    const mediaStyle = {
      width: '100%',
      maxWidth: '480px',
      maxHeight: '65vh',
      objectFit: 'contain',
      borderRadius: '16px',
      background: '#000',
    };
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    Object.assign(video.style, mediaStyle);

    const preview = document.createElement('img');
    preview.alt = '拍攝照片預覽';
    Object.assign(preview.style, { ...mediaStyle, display: 'none' });

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: '12px',
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    const take = document.createElement('button');
    take.type = 'button';
    take.textContent = '拍照';
    const retake = document.createElement('button');
    retake.type = 'button';
    retake.textContent = '重拍';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = '使用這張照片';
    for (const button of [cancel, take, retake, confirm])
      Object.assign(button.style, {
        padding: '12px 20px',
        border: '0',
        borderRadius: '12px',
        fontSize: '16px',
        cursor: 'pointer',
      });
    cancel.style.background = '#ffffff';
    cancel.style.color = '#dc2626';
    cancel.style.fontWeight = '600';
    take.style.background = '#ffce00';
    take.style.color = '#111111';
    take.style.fontWeight = '700';
    retake.style.background = '#ffffff';
    retake.style.color = '#111111';
    retake.style.fontWeight = '700';
    confirm.style.background = '#ffce00';
    confirm.style.color = '#111111';
    confirm.style.fontWeight = '700';

    const showCameraMode = () => {
      title.textContent = '拍攝訂單照片';
      subtitle.textContent = '拍完後可先預覽確認，再決定使用或重拍';
      preview.style.display = 'none';
      video.style.display = 'block';
      retake.style.display = 'none';
      confirm.style.display = 'none';
      take.style.display = 'inline-block';
    };
    const showPreviewMode = (uri: string) => {
      title.textContent = '確認這張照片？';
      subtitle.textContent = '請確認畫面清楚，確認無誤後點選「使用這張照片」';
      preview.src = uri;
      video.style.display = 'none';
      preview.style.display = 'block';
      take.style.display = 'none';
      retake.style.display = 'inline-block';
      confirm.style.display = 'inline-block';
    };

    showCameraMode();
    controls.append(cancel, take, retake, confirm);
    overlay.append(header, video, preview, controls);
    document.body.append(overlay);
    const close = () => {
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      overlay.remove();
    };
    cancel.onclick = () => {
      close();
      resolve(null);
    };
    take.onclick = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) throw new Error('camera_not_ready');
        const ratio = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(video.videoWidth * ratio);
        canvas.height = Math.round(video.videoHeight * ratio);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('camera_unavailable');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const uri = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = validPickedImage(
          uri.slice(uri.indexOf(',') + 1),
          canvas.width,
          canvas.height,
        );
        captured = { uri, base64, width: canvas.width, height: canvas.height };
        showPreviewMode(uri);
      } catch (error) {
        close();
        reject(error);
      }
    };
    retake.onclick = () => {
      captured = null;
      preview.removeAttribute('src');
      showCameraMode();
      void video.play().catch(() => undefined);
    };
    confirm.onclick = () => {
      if (!captured) return;
      const result = captured;
      close();
      resolve(result);
    };
    void video.play().catch((error) => {
      close();
      reject(error);
    });
  });
}
