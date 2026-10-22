import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { KamonSvg, DrawnKamonSvg } from './KamonSvg';
import { motifPeers, ancestorsOf, childrenOf } from '../catalog';
import { crestUrl } from '../routes';
import {
  lang, t, term, eraText, familyName, personName, parentNote, seatName, crestDescription, sourceNote, referenceTitle,
} from '../i18n';

function SourceCredit(props) {
  const source = () => props.crest.source;
  return (
    <Show when={source()} fallback={<span>{t('sourceUnknown')}</span>}>
      <Show when={source().type === 'commons'}>
        <a href={source().url} target="_blank" rel="noreferrer">{source().file}</a>
        <Show when={source().author}>{` · ${source().author}`}</Show>
        {' · '}
        <Show when={source().licenseUrl} fallback={source().license}>
          <a href={source().licenseUrl} target="_blank" rel="noreferrer">{source().license}</a>
        </Show>
      </Show>
      <Show when={source().type !== 'commons'}>
        <span>{sourceNote(props.crest)}</span>
        <Show when={source().file}>
          {`（${t('basedOn')} `}
          <a href={source().url} target="_blank" rel="noreferrer">{source().file}</a>
          <Show when={source().author}>{` · ${source().author}`}</Show>
          <Show when={source().license}>{` · ${source().license}`}</Show>
          {'）'}
        </Show>
      </Show>
    </Show>
  );
}

export function Detail(props) {
  let closeButton;
  let dialog;
  const family = () => props.entry.family;
  const crest = () => props.entry.crest;
  const peers = () => motifPeers(crest());
  const ancestors = () => ancestorsOf(family());
  const children = () => childrenOf(family());
  const openFamily = (f) => props.onOpen(f.crests[0].id);

  const [copied, setCopied] = createSignal(false);
  const share = async () => {
    const link = new URL(crestUrl(crest().id), location.href);
    if (lang() !== 'zh') link.searchParams.set('lang', lang());
    const url = link.href;
    const title = `${familyName(family())}「${crest().nameJa}」`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t('copyPrompt'), url);
    }
  };

  const trapTab = (e) => {
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), a[href]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab') trapTab(e);
    else if (e.key === 'Escape') props.onClose();
    else if (e.key === 'ArrowLeft' && props.prev) props.onOpen(props.prev.crest.id);
    else if (e.key === 'ArrowRight' && props.next) props.onOpen(props.next.crest.id);
  };

  onMount(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const page = document.getElementById('root');
    document.body.style.overflow = 'hidden';
    page.inert = true;
    document.addEventListener('keydown', onKeyDown);
    closeButton.focus();

    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      page.inert = false;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    });
  });

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div
        ref={dialog}
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${familyName(family())} ${crest().nameJa}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeButton} type="button" class="modal__close" aria-label={t('close')} onClick={props.onClose}>✕</button>

        <div class="modal__art-panel">
          <div class="modal__art">
            <Show when={crest()} keyed>
              {(c) => (
                <div class="modal__art-stage">
                  <DrawnKamonSvg crest={c} />
                </div>
              )}
            </Show>
          </div>
          <Show when={family().crests.length > 1}>
            <div class="crest-switcher" role="group" aria-label={t('switchCrest')}>
              <For each={family().crests}>
                {(c) => (
                  <button
                    type="button"
                    class="crest-switcher__item"
                    classList={{ 'is-active': c.id === crest().id }}
                    aria-pressed={c.id === crest().id}
                    onClick={() => props.onOpen(c.id)}
                  >
                    <KamonSvg crest={c} />
                    <span class="crest-switcher__name" lang="ja">{c.nameJa}</span>
                    <span class="crest-switcher__usage">{term('usage', c.usage)}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="modal__info">
          <div class="modal__clan">{familyName(family())}</div>
          <h2 class="modal__crest-name" lang="ja">{crest().nameJa}</h2>
          <div class="modal__crest-en">{crest().nameEn}</div>
          <button type="button" class="share-btn" onClick={share}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
            </svg>
            <span aria-live="polite">{copied() ? t('copied') : t('share')}</span>
          </button>

          <dl class="facts">
            <div><dt>{t('representative')}</dt><dd>{personName(family())}</dd></div>
            <div><dt>{t('rank')}</dt><dd>{term('rank', family().rank)}<span class="facts__sub">{term('class', family().class)}</span></dd></div>
            <div><dt>{t('era')}</dt><dd>{eraText(family().era)}</dd></div>
            <Show when={family().seat}>
              <div><dt>{t('seat')}</dt><dd lang="ja">{seatName(family())}</dd></div>
            </Show>
            <div>
              <dt>{t('pattern')}</dt>
              <dd>
                {term('category', crest().category)}
                <span class="facts__sub">{[crest().motif, term('usage', crest().usage)].filter(Boolean).join('・')}</span>
              </dd>
            </div>
          </dl>

          <p class="modal__description">
            {crestDescription(crest()) || t('fallbackDescription', { clan: familyName(family()) })}
          </p>

          <Show when={ancestors().length || children().length}>
            <section class="detail-block">
              <h3 class="detail-block__title">{t('lineage')}</h3>
              <Show when={ancestors().length}>
                <ol class="lineage">
                  <For each={ancestors()}>
                    {(f) => (
                      <li>
                        <button type="button" class="lineage__link" onClick={() => openFamily(f)}>{familyName(f)}</button>
                      </li>
                    )}
                  </For>
                  <li aria-current="true" class="lineage__current">{familyName(family())}</li>
                </ol>
                <p class="lineage__note">{parentNote(family())}</p>
              </Show>
              <Show when={children().length}>
                <div class="lineage__children">
                  <span class="lineage__label">{t('branches')}</span>
                  <For each={children()}>
                    {(f) => (
                      <button type="button" class="peer-chip" onClick={() => openFamily(f)} title={parentNote(f)}>
                        <KamonSvg crest={f.crests[0]} />
                        {familyName(f)}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </section>
          </Show>

          <Show when={peers().length}>
            <section class="detail-block">
              <h3 class="detail-block__title">{t('relatedCrests')}<span class="detail-block__sub">{crest().motif}</span></h3>
              <div class="peers">
                <For each={peers()}>
                  {(peer) => (
                    <button type="button" class="peer-chip" onClick={() => props.onOpen(peer.crest.id)}>
                      <KamonSvg crest={peer.crest} />
                      <span>
                        {familyName(peer.family)}
                        <span class="peer-chip__crest" lang="ja">{peer.crest.nameJa}</span>
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </section>
          </Show>

          <section class="detail-block detail-block--meta">
            <Show when={family().references?.length}>
              <p>
                <span class="detail-block__label">{t('references')}</span>
                <For each={family().references}>
                  {(ref, i) => (
                    <>
                      {i() > 0 && t('listSeparator')}
                      <a href={ref.url} target="_blank" rel="noreferrer">{referenceTitle(ref)}</a>
                    </>
                  )}
                </For>
              </p>
            </Show>
            <p>
              <span class="detail-block__label">{t('imageSource')}</span>
              <SourceCredit crest={crest()} />
            </p>
          </section>

          <nav class="modal__nav" aria-label={t('familyNav')}>
            <button type="button" class="nav-btn" disabled={!props.prev} onClick={() => props.onOpen(props.prev.crest.id)}>
              <span aria-hidden="true">‹</span>
              <span class="nav-btn__label">{props.prev ? familyName(props.prev.family) : t('prev')}</span>
            </button>
            <span class="modal__position">{props.position}</span>
            <button type="button" class="nav-btn nav-btn--next" disabled={!props.next} onClick={() => props.onOpen(props.next.crest.id)}>
              <span class="nav-btn__label">{props.next ? familyName(props.next.family) : t('next')}</span>
              <span aria-hidden="true">›</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
