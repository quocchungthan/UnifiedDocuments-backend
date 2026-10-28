import { SkipLink } from './skip-link';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import type { EntryCatalog } from '../contracts/entry';
import { entryMessages } from './entry.messages';
import { actionMessages } from './actions.messages';
import { SystemPreferences } from '../preferences/system-preferences';

@Component({
  selector: 'emfc-entry-page',
  imports: [SkipLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-page.html',
  styleUrl: '../design-system/entry.css',
})
export class EntryPage {
  readonly catalog = input.required<EntryCatalog>();
  private readonly preferences = inject(SystemPreferences);
  private readonly title = inject(Title);
  protected readonly copy = computed(() => ({
    ...entryMessages[this.preferences.locale()],
    skipToContent: actionMessages[this.preferences.locale()].skipToContent,
    availability: actionMessages[this.preferences.locale()].notConnected,
  }));
  protected readonly messages = computed(() => this.catalog()[this.preferences.locale()]);

  constructor() {
    effect(() => this.title.setTitle(this.messages().title));
  }
}
