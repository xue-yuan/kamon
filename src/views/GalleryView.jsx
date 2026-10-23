import { For, Show } from 'solid-js';
import { KamonSvg } from '../components/KamonSvg';
import { t, label, familyName, personName, groupLabel, groupNote } from '../i18n';

function FamilyCard(props) {
  return (
    <button type="button" class="kamon-card" onClick={() => props.onOpen(props.crest.id)}>
      <Show when={props.family.crests.length > 1}>
        <span class="kamon-card__count" title={t('ui.crestCountTitle', { count: props.family.crests.length })}>
          {t('ui.crestCount', { count: props.family.crests.length })}
        </span>
      </Show>
      <div class="kamon-card__art">
        <KamonSvg crest={props.crest} />
      </div>
      <div class="kamon-card__clan">{familyName(props.family)}</div>
      <div class="kamon-card__crest">
        <span lang="ja">{props.crest.nameJa}</span>
        <Show when={props.crest.usage !== 'jomon'}>
          <span class="kamon-card__usage">{label('usage', props.crest.usage)}</span>
        </Show>
      </div>
      <div class="kamon-card__person">{personName(props.family)}</div>
    </button>
  );
}

export function GalleryView(props) {
  return (
    <Show
      when={props.sections.length}
      fallback={
        <div class="empty">
          <p>{t('ui.noResults')}</p>
          <button type="button" class="link-btn" onClick={props.onReset}>{t('ui.clearFilters')}</button>
        </div>
      }
    >
      <For each={props.sections}>
        {(section) => (
          <section class="kamon-section">
            <header class="section-header">
              <h2 class="section-title">{groupLabel(section.group)}</h2>
              <span class="section-count">{section.items.length}</span>
              <p class="section-note">{groupNote(section.group)}</p>
            </header>
            <div class="kamon-grid">
              <For each={section.items}>
                {(item) => <FamilyCard family={item.family} crest={item.crest} onOpen={props.onOpen} />}
              </For>
            </div>
          </section>
        )}
      </For>
    </Show>
  );
}
