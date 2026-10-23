import { For, Show, Switch, Match, createSignal, createMemo, createEffect, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { KAMON_FAMILIES } from './data';
import { ALL_GROUPS, CATEGORIES, ERA_BUCKETS, searchTerms } from './taxonomy';
import { CREST_INDEX, CREST_COUNT, SEARCH_INDEX, filterFamilies } from './catalog';
import { HOME_URL, crestUrl, crestIdFromLocation } from './routes';
import { LANGS, lang, setLang, t, label, groupLabel, familyName } from './i18n';
import { Detail } from './components/Detail';
import { GalleryView } from './views/GalleryView';
import { MapView } from './views/MapView';
import './index.css';

const VIEWS = [
  { id: 'gallery', labelKey: 'viewGallery' },
  { id: 'map', labelKey: 'viewMap' },
];

function viewFromUrl() {
  const view = new URLSearchParams(location.search).get('view');
  return VIEWS.some((v) => v.id === view) ? view : 'gallery';
}

function ChipRow(props) {
  return (
    <div class="chip-row" role="group" aria-label={props.label}>
      <span class="chip-row__label">{props.label}</span>
      <div class="chip-row__chips">
        <button
          type="button"
          class="chip"
          classList={{ 'is-active': !props.value }}
          aria-pressed={!props.value}
          onClick={() => props.onChange(null)}
        >
          {t('ui.all')}
        </button>
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              class="chip"
              classList={{ 'is-active': props.value === option.id, 'is-empty': !option.count }}
              aria-pressed={props.value === option.id}
              disabled={!option.count && props.value !== option.id}
              onClick={() => props.onChange(props.value === option.id ? null : option.id)}
            >
              {option.label}
              <span class="chip__count">{option.count}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

function App() {
  const [query, setQuery] = createSignal('');
  const [group, setGroup] = createSignal(null);
  const [category, setCategory] = createSignal(null);
  const [era, setEra] = createSignal(null);
  const [selectedId, setSelectedId] = createSignal(crestIdFromLocation());
  const [view, setView] = createSignal(viewFromUrl());

  let pushedHistory = false;
  const syncFromLocation = () => {
    const id = crestIdFromLocation();
    if (id && location.hash) history.replaceState(null, '', crestUrl(id) + location.search);
    setSelectedId(id);
    setView(viewFromUrl());
  };
  onMount(() => {
    syncFromLocation();
    const onPopState = () => {
      pushedHistory = false;
      syncFromLocation();
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    onCleanup(() => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
    });
  });

  const open = (id) => {
    if (selectedId()) {
      history.replaceState(null, '', crestUrl(id) + location.search);
    } else {
      history.pushState(null, '', crestUrl(id) + location.search);
      pushedHistory = true;
    }
    setSelectedId(id);
  };

  const close = () => {
    setSelectedId(null);
    if (pushedHistory) {
      pushedHistory = false;
      history.back();
    } else {
      history.replaceState(null, '', HOME_URL + location.search);
    }
  };

  const switchView = (id) => {
    const search = id === 'gallery' ? '' : `?view=${id}`;
    history.pushState(null, '', HOME_URL + search);
    pushedHistory = false;
    setSelectedId(null);
    setView(id);
  };

  const terms = createMemo(() => searchTerms(query()));
  const filters = () => ({ terms: terms(), group: group(), category: category(), era: era() });

  const results = createMemo(() => filterFamilies(filters()));

  const countBy = (override, key, ids) => {
    const pool = filterFamilies({ ...filters(), ...override });
    return ids.map((id) => pool.filter((r) => key(r) === id).length);
  };

  const groupOptions = createMemo(() => {
    const counts = countBy({ group: null }, (r) => r.group.id, ALL_GROUPS.map((g) => g.id));
    return ALL_GROUPS.map((g, i) => ({ id: g.id, label: groupLabel(g), count: counts[i] })).filter((g) => g.id !== 'other' || g.count);
  });

  const categoryOptions = createMemo(() =>
    CATEGORIES.map((cat) => ({ id: cat, label: label('category', cat), count: filterFamilies({ ...filters(), category: cat }).length }))
  );

  const eraOptions = createMemo(() =>
    ERA_BUCKETS.map((b) => ({ id: b.id, label: label('eraBucket', b.id), count: filterFamilies({ ...filters(), era: b.id }).length }))
  );

  const sections = createMemo(() =>
    ALL_GROUPS.map((g) => ({ group: g, items: results().filter((r) => r.group.id === g.id) })).filter((s) => s.items.length)
  );

  const visibleOrder = createMemo(() => sections().flatMap((s) => s.items));

  const selectedEntry = createMemo(() => (selectedId() ? CREST_INDEX.get(selectedId()) : null));

  createEffect(() => {
    const entry = selectedEntry();
    document.title = entry ? `${familyName(entry.family)}「${entry.crest.nameJa}」｜${t('ui.siteTitle')}` : t('ui.siteTitle');
  });

  const neighbours = createMemo(() => {
    const entry = selectedEntry();
    if (!entry) return {};
    let list = visibleOrder();
    let index = list.findIndex((r) => r.family === entry.family);
    if (index === -1) {
      list = SEARCH_INDEX.map((e) => ({ family: e.family, crest: e.family.crests[0] }));
      index = list.findIndex((r) => r.family === entry.family);
    }
    return {
      prev: list[index - 1],
      next: list[index + 1],
      position: `${index + 1} / ${list.length}`,
    };
  });

  const hasFilters = () => query() || group() || category() || era();
  const resetFilters = () => {
    setQuery('');
    setGroup(null);
    setCategory(null);
    setEra(null);
  };

  return (
    <div class="container">
      <a
        class="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main').focus();
        }}
      >
        {t('ui.skipLink')}
      </a>
      <div class="lang-switch" role="group" aria-label={t('ui.language')}>
        <For each={LANGS}>
          {(l) => (
            <button
              type="button"
              class="lang-switch__btn"
              classList={{ 'is-active': lang() === l.id }}
              aria-pressed={lang() === l.id}
              lang={l.id}
              onClick={() => setLang(l.id)}
            >
              {l.label}
            </button>
          )}
        </For>
      </div>
      <header class="header">
        <h1>{t('ui.siteTitle')}</h1>
        <p class="header__en">Sengoku Daimyo Kamon Archives</p>
        <p class="header__stats">{t('ui.stats', { families: KAMON_FAMILIES.length, crests: CREST_COUNT })}</p>
      </header>

      <nav class="view-tabs" aria-label={t('ui.viewTabs')}>
        <For each={VIEWS}>
          {(v) => (
            <button
              type="button"
              class="view-tab"
              classList={{ 'is-active': view() === v.id }}
              aria-current={view() === v.id ? 'page' : undefined}
              onClick={() => view() !== v.id && switchView(v.id)}
            >
              {t(`ui.${v.labelKey}`)}
            </button>
          )}
        </For>
      </nav>

      <div class="toolbar">
        <div class="search">
          <svg class="search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            type="search"
            class="search__input"
            placeholder={t('ui.searchPlaceholder')}
            aria-label={t('ui.search')}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
        <ChipRow label={t('ui.facetGroup')} options={groupOptions()} value={group()} onChange={setGroup} />
        <ChipRow label={t('ui.facetEra')} options={eraOptions()} value={era()} onChange={setEra} />
        <ChipRow label={t('ui.facetCategory')} options={categoryOptions()} value={category()} onChange={setCategory} />
        <div class="toolbar__status" aria-live="polite">
          <span>{t('ui.showing', { count: results().length })}</span>
          <Show when={hasFilters()}>
            <button type="button" class="link-btn" onClick={resetFilters}>{t('ui.clearFilters')}</button>
          </Show>
        </div>
      </div>

      <main id="main" tabindex="-1">
        <Switch>
          <Match when={view() === 'gallery'}>
            <GalleryView sections={sections()} onOpen={open} onReset={resetFilters} />
          </Match>
          <Match when={view() === 'map'}>
            <MapView results={results()} onOpen={open} />
          </Match>
        </Switch>
      </main>

      <Show when={selectedEntry()}>
        <Portal>
          <Detail
            entry={selectedEntry()}
            prev={neighbours().prev}
            next={neighbours().next}
            position={neighbours().position}
            onOpen={open}
            onClose={close}
          />
        </Portal>
      </Show>

      <footer class="footer">
        <p>{t('ui.footer')}</p>
        <p>© 2026 Sengoku Kamon Archives.</p>
      </footer>
    </div>
  );
}

export default App;
