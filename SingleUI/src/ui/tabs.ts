import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'emfc-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tab-strip" role="tablist" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <button
          type="button"
          role="tab"
          [id]="idPrefix() + '-tab-' + item.id"
          [attr.aria-controls]="idPrefix() + '-panel-' + item.id"
          [attr.aria-selected]="selected() === item.id"
          [disabled]="item.disabled === true"
          [tabIndex]="!item.disabled && selected() === item.id ? 0 : -1"
          (click)="selectionChange.emit(item.id)"
          (keydown)="navigate($event, $index)"
        >
          {{ item.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .tab-strip {
      display: flex;
      gap: var(--emfc-space-2);
      border-bottom: 1px solid var(--emfc-line);
    }
    /* Keep selected text/underline and focus readable on both system surfaces. */
    .tab-strip button {
      flex: 1 1 0;
      min-width: 0;
      min-height: 44px;
      padding: var(--emfc-space-2);
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      background: transparent;
      color: var(--emfc-muted);
      font: inherit;
      font-weight: 600;
      line-height: 1.4;
      box-shadow: none;
      cursor: pointer;
    }
    .tab-strip button:hover:not(:disabled) {
      background: var(--emfc-surface-alt);
      color: var(--emfc-ink);
    }
    .tab-strip button:active:not(:disabled) {
      background: var(--emfc-accent-soft);
    }
    .tab-strip button[aria-selected='true'] {
      color: var(--emfc-accent);
      border-bottom-color: var(--emfc-accent);
    }
    .tab-strip button:focus-visible {
      outline: 2px solid var(--emfc-focus);
      outline-offset: -3px;
    }
    .tab-strip button:disabled {
      cursor: not-allowed;
      color: var(--emfc-muted);
      opacity: 1;
    }
  `,
})
export class Tabs<T extends string = string> {
  readonly items = input.required<readonly TabOption<T>[]>();
  readonly selected = input.required<T>();
  readonly label = input.required<string>();
  readonly idPrefix = input.required<string>();
  readonly selectionChange = output<T>();

  protected navigate(event: KeyboardEvent, index: number) {
    const items = this.items();
    const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled);
    if (!enabled.length) return;
    const position = enabled.findIndex(item => item.index === index);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = enabled[(position + 1) % enabled.length].index;
        break;
      case 'ArrowLeft':
        next = enabled[(position - 1 + enabled.length) % enabled.length].index;
        break;
      case 'Home':
        next = enabled[0].index;
        break;
      case 'End':
        next = enabled.at(-1)!.index;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.selectionChange.emit(items[next].id);
    const button = event.currentTarget;
    if (button instanceof HTMLElement) {
      button.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }
  }
}
