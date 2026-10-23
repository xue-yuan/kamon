import { For, Show, createMemo, createSignal, onMount, onCleanup } from 'solid-js';
import { JAPAN_MAP, project } from '../japanMap';
import { KamonSvg } from '../components/KamonSvg';
import { t, familyName, seatName } from '../i18n';

const FRAME = { north: 41.7, south: 30.9, west: 129.3, east: 142.3 };
const [FX0, FY0] = project(FRAME.north, FRAME.west);
const [FX1, FY1] = project(FRAME.south, FRAME.east);
const FULL = { x: FX0, y: FY0, w: FX1 - FX0, h: FY1 - FY0 };

const MARKER_PX = 34;
const MAX_ZOOM = 8;
const SAME_SPOT = 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function MapView(props) {
  let frame;
  const [width, setWidth] = createSignal(800);
  const [zoom, setZoom] = createSignal(1);
  const [center, setCenter] = createSignal({ x: FULL.x + FULL.w / 2, y: FULL.y + FULL.h / 2 });
  const [openCluster, setOpenCluster] = createSignal(null);

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(frame);
    const onKey = (e) => e.key === 'Escape' && setOpenCluster(null);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener('keydown', onKey);
    });
  });

  const view = createMemo(() => {
    const w = FULL.w / zoom();
    const h = FULL.h / zoom();
    return {
      x: clamp(center().x - w / 2, FULL.x, FULL.x + FULL.w - w),
      y: clamp(center().y - h / 2, FULL.y, FULL.y + FULL.h - h),
      w,
      h,
    };
  });

  const zoomTo = (z, c = center()) => {
    setOpenCluster(null);
    setZoom(clamp(z, 1, MAX_ZOOM));
    setCenter(c);
  };

  const placed = createMemo(() =>
    props.results
      .filter((r) => r.family.seat)
      .map((r) => {
        const [x, y] = project(r.family.seat.lat, r.family.seat.lon);
        return { ...r, x, y };
      })
  );

  const clusters = createMemo(() => {
    const v = view();
    const pxPerUnit = width() / v.w;
    const margin = MARKER_PX / pxPerUnit;
    const result = [];
    for (const item of placed()) {
      if (item.x < v.x - margin || item.x > v.x + v.w + margin || item.y < v.y - margin || item.y > v.y + v.h + margin) continue;
      const hit = result.find((c) => Math.hypot(c.x - item.x, c.y - item.y) * pxPerUnit < MARKER_PX * 0.9);
      if (hit) hit.items.push(item);
      else result.push({ x: item.x, y: item.y, items: [item] });
    }
    return result.map((c, i) => {
      const cx = c.items.reduce((s, it) => s + it.x, 0) / c.items.length;
      const cy = c.items.reduce((s, it) => s + it.y, 0) / c.items.length;
      const spread = Math.max(...c.items.map((it) => Math.hypot(it.x - cx, it.y - cy)));
      return {
        id: `${i}-${c.items[0].family.id}`,
        items: c.items,
        cx,
        cy,
        spread,
        left: (cx - v.x) / v.w,
        top: (cy - v.y) / v.h,
      };
    });
  });

  const onMarker = (cluster) => {
    if (cluster.items.length === 1) return props.onOpen(cluster.items[0].crest.id);
    if (cluster.spread > SAME_SPOT && zoom() < MAX_ZOOM) {
      const pxPerUnit = width() / view().w;
      const needed = (MARKER_PX * 1.2) / Math.max(cluster.spread * pxPerUnit, 1);
      zoomTo(zoom() * clamp(needed, 1.8, 4), { x: cluster.cx, y: cluster.cy });
    } else {
      setOpenCluster(openCluster()?.id === cluster.id ? null : cluster);
    }
  };

  let drag = null;
  const onPointerDown = (e) => {
    if (zoom() === 1 || e.target.closest('button, .map-popover')) return;
    drag = { x: e.clientX, y: e.clientY, center: center(), moved: false };
    frame.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    const unitsPerPx = view().w / width();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const v = view();
    setCenter({
      x: clamp(drag.center.x - dx * unitsPerPx, FULL.x + v.w / 2, FULL.x + FULL.w - v.w / 2),
      y: clamp(drag.center.y - dy * unitsPerPx, FULL.y + v.h / 2, FULL.y + FULL.h - v.h / 2),
    });
  };
  const onPointerUp = () => {
    if (drag?.moved) setOpenCluster(null);
    drag = null;
  };

  const label = (item) => `${familyName(item.family)}・${seatName(item.family)}`;

  return (
    <div class="map-view">
      <p class="map-view__hint">
        {t('ui.mapHint', { count: placed().length })}
      </p>
      <div
        class="map-frame"
        classList={{ 'is-zoomed': zoom() > 1 }}
        ref={frame}
        style={{ 'aspect-ratio': `${FULL.w} / ${FULL.h}` }}
        onClick={() => setOpenCluster(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg class="map-frame__land" viewBox={`${view().x} ${view().y} ${view().w} ${view().h}`} aria-hidden="true">
          <path d={JAPAN_MAP.path} />
        </svg>
        <For each={clusters()}>
          {(cluster) => (
            <button
              type="button"
              class="map-marker"
              classList={{ 'is-cluster': cluster.items.length > 1, 'is-open': openCluster()?.id === cluster.id }}
              style={{ left: `${cluster.left * 100}%`, top: `${cluster.top * 100}%` }}
              aria-label={
                cluster.items.length > 1
                  ? t('ui.mapCluster', { count: cluster.items.length, names: cluster.items.map((i) => familyName(i.family)).join(t('ui.listSeparator')) })
                  : label(cluster.items[0])
              }
              onClick={(e) => {
                e.stopPropagation();
                onMarker(cluster);
              }}
            >
              <KamonSvg crest={cluster.items[0].crest} />
              <Show when={cluster.items.length > 1}>
                <span class="map-marker__count">{cluster.items.length}</span>
              </Show>
              <Show when={cluster.items.length === 1}>
                <span class="map-marker__label">{label(cluster.items[0])}</span>
              </Show>
            </button>
          )}
        </For>
        <Show when={openCluster()} keyed>
          {(cluster) => (
            <div
              class="map-popover"
              classList={{ 'is-left': cluster.left > 0.6, 'is-up': cluster.top > 0.55 }}
              style={{ left: `${cluster.left * 100}%`, top: `${cluster.top * 100}%` }}
              onClick={(e) => e.stopPropagation()}
            >
              <For each={cluster.items}>
                {(item) => (
                  <button type="button" class="map-popover__item" onClick={() => props.onOpen(item.crest.id)}>
                    <KamonSvg crest={item.crest} />
                    <span>
                      {familyName(item.family)}
                      <span class="map-popover__seat" lang="ja">{seatName(item.family)}</span>
                    </span>
                  </button>
                )}
              </For>
            </div>
          )}
        </Show>
        <div class="map-controls" onClick={(e) => e.stopPropagation()}>
          <button type="button" class="map-controls__btn" aria-label={t('ui.zoomIn')} disabled={zoom() >= MAX_ZOOM} onClick={() => zoomTo(zoom() * 2)}>＋</button>
          <button type="button" class="map-controls__btn" aria-label={t('ui.zoomOut')} disabled={zoom() <= 1} onClick={() => zoomTo(zoom() / 2)}>－</button>
          <Show when={zoom() > 1}>
            <button
              type="button"
              class="map-controls__btn map-controls__btn--text"
              onClick={() => zoomTo(1, { x: FULL.x + FULL.w / 2, y: FULL.y + FULL.h / 2 })}
            >
              {t('ui.zoomReset')}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
