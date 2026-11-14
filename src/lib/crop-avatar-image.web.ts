import { validPickedImage } from '@/lib/media-api';
import type { PickedPostImage } from './pick-post-images';

const VIEWPORT_SIZE = 280;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_format_not_supported'));
    img.src = uri;
  });
}

export async function cropAvatarImage(
  source: PickedPostImage,
): Promise<PickedPostImage | null> {
  const img = await loadImage(source.uri);
  const naturalW = Math.max(1, img.naturalWidth || source.width || VIEWPORT_SIZE);
  const naturalH = Math.max(1, img.naturalHeight || source.height || VIEWPORT_SIZE);
  const baseScale = Math.max(VIEWPORT_SIZE / naturalW, VIEWPORT_SIZE / naturalH);

  return new Promise((resolve, reject) => {
    let zoom = 1;
    let offsetX = 0;
    let offsetY = 0;

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: '#111111',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '18px',
      padding: '24px',
      userSelect: 'none',
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
    title.textContent = '調整頭像位置與縮放';
    Object.assign(title.style, {
      color: '#ffffff',
      fontSize: '18px',
      fontWeight: '700',
    });
    const subtitle = document.createElement('div');
    subtitle.textContent = '拖曳圖片調整圓框內位置，使用雙指或滑桿縮放大小';
    Object.assign(subtitle.style, {
      color: '#d4d4d8',
      fontSize: '14px',
    });
    header.append(title, subtitle);

    const stage = document.createElement('div');
    stage.setAttribute('aria-label', '頭像裁切預覽區');
    Object.assign(stage.style, {
      position: 'relative',
      width: `${VIEWPORT_SIZE}px`,
      height: `${VIEWPORT_SIZE}px`,
      borderRadius: `${VIEWPORT_SIZE / 2}px`,
      overflow: 'hidden',
      border: '3px solid #ffce00',
      background: '#000000',
      touchAction: 'none',
      cursor: 'grab',
      flexShrink: '0',
    });

    const preview = document.createElement('img');
    preview.src = source.uri;
    preview.alt = '頭像裁切預覽';
    preview.draggable = false;
    Object.assign(preview.style, {
      position: 'absolute',
      pointerEvents: 'none',
      userSelect: 'none',
      maxWidth: 'none',
      maxHeight: 'none',
    });
    stage.append(preview);

    const zoomRow = document.createElement('div');
    Object.assign(zoomRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      maxWidth: '300px',
    });
    const zoomOut = document.createElement('button');
    zoomOut.type = 'button';
    zoomOut.textContent = '－';
    zoomOut.setAttribute('aria-label', '縮小');
    const zoomIn = document.createElement('button');
    zoomIn.type = 'button';
    zoomIn.textContent = '＋';
    zoomIn.setAttribute('aria-label', '放大');
    for (const btn of [zoomOut, zoomIn]) {
      Object.assign(btn.style, {
        width: '36px',
        height: '36px',
        borderRadius: '18px',
        border: '0',
        background: '#27272a',
        color: '#ffffff',
        fontSize: '18px',
        fontWeight: '700',
        cursor: 'pointer',
      });
    }
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(MIN_ZOOM);
    slider.max = String(MAX_ZOOM);
    slider.step = '0.01';
    slider.value = '1';
    slider.setAttribute('aria-label', '縮放比例');
    Object.assign(slider.style, {
      flex: '1',
      accentColor: '#ffce00',
      cursor: 'pointer',
    });
    zoomRow.append(zoomOut, slider, zoomIn);

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'flex',
      gap: '14px',
      justifyContent: 'center',
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = '確認作為頭像';
    for (const button of [cancel, confirm]) {
      Object.assign(button.style, {
        padding: '12px 22px',
        border: '0',
        borderRadius: '12px',
        fontSize: '16px',
        cursor: 'pointer',
      });
    }
    cancel.style.background = '#ffffff';
    cancel.style.color = '#dc2626';
    cancel.style.fontWeight = '600';
    confirm.style.background = '#ffce00';
    confirm.style.color = '#111111';
    confirm.style.fontWeight = '700';
    controls.append(cancel, confirm);

    const currentLayout = () => {
      zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      const drawW = naturalW * baseScale * zoom;
      const drawH = naturalH * baseScale * zoom;
      const maxOffsetX = Math.max(0, (drawW - VIEWPORT_SIZE) / 2);
      const maxOffsetY = Math.max(0, (drawH - VIEWPORT_SIZE) / 2);
      offsetX = clamp(offsetX, -maxOffsetX, maxOffsetX);
      offsetY = clamp(offsetY, -maxOffsetY, maxOffsetY);
      const drawX = (VIEWPORT_SIZE - drawW) / 2 + offsetX;
      const drawY = (VIEWPORT_SIZE - drawH) / 2 + offsetY;
      return { drawX, drawY, drawW, drawH };
    };

    const renderPreview = () => {
      const { drawX, drawY, drawW, drawH } = currentLayout();
      preview.style.width = `${drawW}px`;
      preview.style.height = `${drawH}px`;
      preview.style.left = `${drawX}px`;
      preview.style.top = `${drawY}px`;
      slider.value = String(zoom);
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    const getDistance = () => {
      const pts = [...pointers.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    };

    stage.onpointerdown = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.setPointerCapture?.(event.pointerId);
      stage.style.cursor = 'grabbing';
      if (pointers.size === 2) {
        pinchDistance = getDistance();
      }
    };
    stage.onpointermove = (event) => {
      const prev = pointers.get(event.pointerId);
      if (!prev) return;
      const next = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, next);
      if (pointers.size === 1) {
        offsetX += next.x - prev.x;
        offsetY += next.y - prev.y;
        renderPreview();
      } else if (pointers.size >= 2) {
        const nextDist = getDistance();
        if (pinchDistance > 0 && nextDist > 0) {
          zoom = clamp(zoom * (nextDist / pinchDistance), MIN_ZOOM, MAX_ZOOM);
          pinchDistance = nextDist;
          renderPreview();
        }
      }
    };
    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      if (pointers.size === 0) stage.style.cursor = 'grab';
    };
    stage.onpointerup = endPointer;
    stage.onpointercancel = endPointer;
    stage.onwheel = (event) => {
      event.preventDefault();
      zoom = clamp(zoom - event.deltaY * 0.002, MIN_ZOOM, MAX_ZOOM);
      renderPreview();
    };

    slider.oninput = () => {
      zoom = clamp(Number(slider.value) || 1, MIN_ZOOM, MAX_ZOOM);
      renderPreview();
    };
    zoomOut.onclick = () => {
      zoom = clamp(zoom - 0.2, MIN_ZOOM, MAX_ZOOM);
      renderPreview();
    };
    zoomIn.onclick = () => {
      zoom = clamp(zoom + 0.2, MIN_ZOOM, MAX_ZOOM);
      renderPreview();
    };

    const close = () => {
      overlay.remove();
    };
    cancel.onclick = () => {
      close();
      resolve(null);
    };
    confirm.onclick = () => {
      try {
        const { drawX, drawY, drawW, drawH } = currentLayout();
        const scale = OUTPUT_SIZE / VIEWPORT_SIZE;
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('invalid_image_input');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        context.drawImage(
          img,
          drawX * scale,
          drawY * scale,
          drawW * scale,
          drawH * scale,
        );
        const uri = canvas.toDataURL('image/jpeg', 0.88);
        const base64 = validPickedImage(
          uri.slice(uri.indexOf(',') + 1),
          OUTPUT_SIZE,
          OUTPUT_SIZE,
        );
        close();
        resolve({ uri, base64, width: OUTPUT_SIZE, height: OUTPUT_SIZE });
      } catch (error) {
        close();
        reject(error);
      }
    };

    renderPreview();
    overlay.append(header, stage, zoomRow, controls);
    document.body.append(overlay);
  });
}
