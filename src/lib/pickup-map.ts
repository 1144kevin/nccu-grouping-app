import assets from '@/vendor/leaflet-assets.json';
import type { Coordinates } from '@/types/domain';

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export function mapCoordinates(value: unknown): Coordinates | undefined {
  if (!value || typeof value !== 'object') return;
  const { latitude, longitude } = value as Coordinates;
  if (typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180) {
    return { latitude, longitude };
  }
}
export function readMapMessage(raw: unknown, channel: string): Coordinates | undefined {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (value?.type !== 'pickup-map' || value.channel !== channel) return;
    return mapCoordinates(value);
  } catch { return; }
}
export function mapTileUrl(): string {
  const value = process.env.EXPO_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password &&
      ['{z}', '{x}', '{y}'].every((t) => value.includes(t))) return value;
  } catch { /* Use the public standard endpoint when configuration is invalid. */ }
  return DEFAULT_TILE_URL;
}

// Leaflet JS/CSS are packaged locally; no remote scripts, credentials or parent DOM access.
export function buildPickupMap(initial: Coordinates, channel: string, tiles = mapTileUrl()): string {
  const point = mapCoordinates(initial);
  if (!point) throw new Error('invalid_map_coordinates');
  const tileOrigin = new URL(tiles).origin;
  const config = JSON.stringify({ point, channel, tiles }).replace(/</g, '\\u003c');
  const script = assets.js.replace(/<\/script/gi, '<\\/script').replace(/\/\/# sourceMappingURL=.*/g, '');
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src ${tileOrigin} data:; connect-src 'none'">
<style>${assets.css}
html,body,#map{height:100%;width:100%;margin:0}body{font-family:sans-serif}
.pickup-pin{width:26px;height:26px;background:#a43d27;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 5px #555}
#notice{position:absolute;top:8px;left:48px;right:8px;z-index:800;background:#fff;padding:7px;border-radius:6px;font-size:13px;pointer-events:none}
</style></head><body><div id="map" aria-label="取餐地圖"></div><div id="notice">點一下地圖放置圖釘，也可以拖動圖釘微調</div>
<script>${script}</script><script>
(function(){
 const cfg=${config};
 const map=L.map('map',{zoomControl:true,attributionControl:true}).setView([cfg.point.latitude,cfg.point.longitude],17);
 const tiles=L.tileLayer(cfg.tiles,{maxZoom:19,updateWhenIdle:true,keepBuffer:0,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(map);
 let marker;
 function emit(latlng){
  const msg=JSON.stringify({type:'pickup-map',channel:cfg.channel,latitude:latlng.lat,longitude:latlng.lng});
  if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  else window.parent.postMessage(msg,'*');
 }
 function put(latlng,notify){
  latlng=L.latLng(Math.max(-85.05112878,Math.min(85.05112878,latlng.lat)),latlng.wrap().lng);
  if(!marker){marker=L.marker(latlng,{draggable:true,icon:L.divIcon({className:'',html:'<div class="pickup-pin"></div>',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map);
   marker.on('dragend',function(){put(marker.getLatLng(),true)});
  } else marker.setLatLng(latlng);
  if(notify) emit(latlng);
 }
 put(L.latLng(cfg.point.latitude,cfg.point.longitude),false);
 map.on('click',function(e){put(e.latlng,true)});
 tiles.on('tileerror',function(){document.getElementById('notice').textContent='底圖暫時無法載入，請關閉後使用搜尋或常用地點';});
})();</script></body></html>`;
}
