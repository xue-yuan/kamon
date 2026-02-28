import { For, createSignal, Show, onMount, createMemo } from 'solid-js';
import { KAMON_DATA } from './data';
import './index.css';

function KamonCard(props) {
  return (
    <div class="kamon-card" onClick={() => props.onSelect(props.kamon)}>
      <div class="kamon-svg-container">
        <svg viewBox={props.kamon.viewBox} xmlns="http://www.w3.org/2000/svg">
          <path
            class="kamon-path"
            d={props.kamon.path}
            stroke-linecap="round"
            stroke-linejoin="round"
            pathLength="1"
          />
        </svg>
      </div>
      <div class="kamon-info">
        <div class="kamon-name-ja">{props.kamon.nameJa}</div>
        <div class="kamon-name-en">{props.kamon.nameEn}</div>
        <div class="daimyo-name">{props.kamon.daimyo}</div>
      </div>
    </div>
  );
}

function Modal(props) {
  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <button class="modal-close" onClick={props.onClose}>✕</button>
        <div class="modal-svg-large">
          <svg viewBox={props.kamon.viewBox} xmlns="http://www.w3.org/2000/svg">
            <path
              class="kamon-path"
              d={props.kamon.path}
              stroke-linecap="round"
              stroke-linejoin="round"
              pathLength="1"
              style={{ "stroke-dashoffset": "0", "transition-delay": "0.2s" }}
            />
          </svg>
        </div>
        <div class="kamon-info">
          <div class="kamon-name-ja" style={{ "font-size": "2.5rem" }}>{props.kamon.nameJa}</div>
          <div class="kamon-name-en" style={{ "font-size": "1.2rem", "margin-bottom": "1.5rem" }}>{props.kamon.nameEn}</div>
          <div class="kamon-tags">
            <span class="kamon-tag">{props.kamon.class}</span>
            <span class="kamon-tag">{props.kamon.clan}</span>
            <span class="kamon-tag">{props.kamon.category}</span>
            <span class="kamon-tag">{props.kamon.usage}</span>
          </div>
          <div class="daimyo-name" style={{ "font-size": "1.2rem", color: "var(--accent-gold)" }}>{props.kamon.daimyo}</div>
          <p style={{ "margin-top": "2rem", "max-width": "500px", "line-height": "1.8", color: "var(--text-secondary)", "font-family": "var(--font-serif)" }}>
            這是 {props.kamon.clan} 代表人物 {props.kamon.daimyo.split(' ')[0]} 所使用的家徽。
            歷史上的家徽不僅是家族代表，更象徵著傳統與威信。
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [items] = createSignal(KAMON_DATA);
  const [selectedKamon, setSelectedKamon] = createSignal(null);
  const [selectedClass, setSelectedClass] = createSignal('全部');

  const classes = ['全部', ...new Set(KAMON_DATA.map(k => k.class))];

  const filteredItems = createMemo(() => {
    if (selectedClass() === '全部') {
      return items();
    }
    return items().filter(k => k.class === selectedClass());
  });

  return (
    <div class="container">
      <header class="header">
        <h1>戰國家徽圖鑑</h1>
        <p>Sengoku Daimyo Kamon Archives</p>
      </header>

      <div class="filter-bar">
        <For each={classes}>
          {(cls) => (
            <button
              class={`filter-btn ${selectedClass() === cls ? 'active' : ''}`}
              onClick={() => setSelectedClass(cls)}
            >
              {cls}
            </button>
          )}
        </For>
      </div>

      <main class="kamon-grid">
        <For each={filteredItems()}>
          {(kamon) => <KamonCard kamon={kamon} onSelect={setSelectedKamon} />}
        </For>
      </main>

      <Show when={selectedKamon()}>
        <Modal kamon={selectedKamon()} onClose={() => setSelectedKamon(null)} />
      </Show>

      <footer style={{ "text-align": "center", "margin-top": "8rem", color: "var(--text-secondary)", "font-size": "0.9rem", "letter-spacing": "0.1em" }}>
        <p>© 2026 Sengoku Kamon Archives. Crafted with Solid.js. Minimalist & Premium Design.</p>
      </footer>
    </div>
  );
}

export default App;
