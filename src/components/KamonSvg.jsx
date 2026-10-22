import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { splitSubpaths } from '../splitPath';

const strokeStyle = (width) => (width ? { 'stroke-width': width } : undefined);
const lineCap = (crest) => (crest.strokeWidth ? 'butt' : 'round');
const lineJoin = (crest) => (crest.strokeWidth ? 'miter' : 'round');
const fillRule = (crest) => crest.fillRule || 'evenodd';

export function KamonSvg(props) {
  return (
    <svg class="kamon-svg" viewBox={props.crest.viewBox} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <Show when={props.crest.ringPath}>
        <path
          class="kamon-path kamon-ring"
          classList={{ 'kamon-path--thick': !!props.crest.ringStrokeWidth }}
          d={props.crest.ringPath}
          style={strokeStyle(props.crest.ringStrokeWidth)}
        />
      </Show>
      <path
        class="kamon-path"
        classList={{
          'kamon-path--thick': !!props.crest.strokeWidth,
          'kamon-path--no-fill': !!props.crest.fillNone,
        }}
        d={props.crest.path}
        fill-rule={fillRule(props.crest)}
        style={strokeStyle(props.crest.strokeWidth)}
        stroke-linecap={lineCap(props.crest)}
        stroke-linejoin={lineJoin(props.crest)}
      />
    </svg>
  );
}

const DRAW_START = 0.4;
const DRAW_TOTAL = 6;
const MAX_STAGGER = 3.6;

export function DrawnKamonSvg(props) {
  let svg;
  const [ready, setReady] = createSignal(false);

  onMount(() => {
    const scale = svg.getScreenCTM()?.a || 1;
    for (const path of svg.querySelectorAll('.kamon-stroke')) {
      const thick = path.classList.contains('kamon-path--thick');
      const length = path.getTotalLength() * (thick ? 1 : scale);
      path.style.setProperty('--len', `${Math.ceil(length * 1.1) + 2}`);
    }
    setReady(true);
  });

  const pieces = createMemo(() => {
    const crest = props.crest;
    const sources = [
      ...(crest.ringPath ? [{ d: crest.ringPath, width: crest.ringStrokeWidth }] : []),
      { d: crest.path, width: crest.strokeWidth },
    ];
    const all = sources.flatMap((source) =>
      splitSubpaths(source.d).map((sub) => ({ ...sub, width: source.width }))
    );
    all.sort((a, b) => b.size - a.size);

    const stagger = Math.min(MAX_STAGGER, 0.5 * (all.length - 1));
    const duration = DRAW_TOTAL - stagger;
    return all.map((piece, i) => ({
      ...piece,
      delay: DRAW_START + (all.length > 1 ? (stagger * i) / (all.length - 1) : 0),
      duration,
    }));
  });

  return (
    <svg
      ref={svg}
      class="kamon-svg is-drawing"
      classList={{ 'is-ready': ready() }}
      viewBox={props.crest.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g class="kamon-guide">
        <Show when={props.crest.ringPath}>
          <path
            class="kamon-guide__ring"
            classList={{ 'kamon-path--thick': !!props.crest.ringStrokeWidth }}
            d={props.crest.ringPath}
            style={strokeStyle(props.crest.ringStrokeWidth)}
          />
        </Show>
        <path
          classList={{
            'kamon-path--thick': !!props.crest.strokeWidth,
            'kamon-guide__no-fill': !!props.crest.fillNone,
          }}
          d={props.crest.path}
          fill-rule={fillRule(props.crest)}
          style={strokeStyle(props.crest.strokeWidth)}
          stroke-linecap={lineCap(props.crest)}
          stroke-linejoin={lineJoin(props.crest)}
        />
      </g>
      <For each={pieces()}>
        {(piece) => (
          <path
            class="kamon-stroke"
            classList={{ 'kamon-path--thick': !!piece.width }}
            d={piece.d}
            stroke-linecap={lineCap(props.crest)}
            stroke-linejoin={lineJoin(props.crest)}
            style={{
              ...strokeStyle(piece.width),
              '--delay': `${piece.delay.toFixed(3)}s`,
              '--duration': `${piece.duration.toFixed(3)}s`,
            }}
          />
        )}
      </For>
    </svg>
  );
}
