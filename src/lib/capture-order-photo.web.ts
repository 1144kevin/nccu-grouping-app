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
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    Object.assign(video.style, {
      width: '100%',
      maxWidth: '480px',
      maxHeight: '70vh',
      objectFit: 'contain',
    });
    const controls = document.createElement('div');
    Object.assign(controls.style, { display: 'flex', gap: '16px' });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    const take = document.createElement('button');
    take.type = 'button';
    take.textContent = '拍照';
    for (const button of [cancel, take])
      Object.assign(button.style, {
        padding: '12px 24px',
        border: '0',
        borderRadius: '12px',
        fontSize: '18px',
        cursor: 'pointer',
      });
    cancel.style.background = '#ffffff';
    cancel.style.color = '#dc2626';
    cancel.style.fontWeight = '600';
    take.style.background = '#ffce00';
    take.style.color = '#111111';
    take.style.fontWeight = '700';
    controls.append(cancel, take);
    overlay.append(video, controls);
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
        close();
        resolve({ uri, base64, width: canvas.width, height: canvas.height });
      } catch (error) {
        close();
        reject(error);
      }
    };
    void video.play().catch((error) => {
      close();
      reject(error);
    });
  });
}
