import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Check, Copy, WrapText } from 'lucide';
import { useMessages } from '../i18n/localization';
import { Icon } from './icon';

export type CodeBlockPart = { text: string; href?: string };

/** Web and mail addresses that code blocks render as links; other schemes stay plain text. */
export const isCodeLink = (value: string) =>
  /^(?:https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(value);

/** Splits plain code into text and link parts without changing the concatenated text. */
export function codeLinkParts(code: string): CodeBlockPart[] {
  const parts: CodeBlockPart[] = [];
  let position = 0;
  for (const match of code.matchAll(/\b(?:https?:\/\/|mailto:)[^\s"'`<>]+/gi)) {
    // Sentence punctuation and closing brackets after an address are not part of it.
    const href = match[0].replace(/[.,;:!?)\]}]+$/, '');
    if (!isCodeLink(href)) continue;
    if (match.index > position) parts.push({ text: code.slice(position, match.index) });
    parts.push({ text: href, href });
    position = match.index + href.length;
  }
  if (position < code.length || !parts.length) parts.push({ text: code.slice(position) });
  return parts;
}

const messages = {
  en: {
    code: 'Code',
    copy: 'Copy',
    copied: 'Copied',
    wrap: 'Wrap long lines',
    failed: 'Could not copy. Select the text and copy it manually.',
  },
  vi: {
    code: 'Mã',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    wrap: 'Ngắt dòng dài',
    failed: 'Không thể sao chép. Hãy chọn văn bản và sao chép thủ công.',
  },
} as const;

@Component({
  selector: 'emfc-code-block',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="code-block">
    <div class="code-toolbar">
      @if (showLabel()) {
        <span>{{ label() || language() || m().code }}</span>
      }
      <div class="code-actions">
        <button
          type="button"
          class="button button--secondary icon-button"
          [attr.aria-label]="m().wrap + ': ' + (label() || language() || m().code)"
          [title]="m().wrap"
          [attr.aria-pressed]="wrapping()"
          (click)="wrapping.set(!wrapping())"
        >
          <emfc-icon [icon]="WrapText" [size]="16" />
        </button>
        <button
          type="button"
          class="button button--secondary icon-button"
          [disabled]="busy()"
          (click)="copy()"
          [attr.aria-label]="m().copy + ': ' + (label() || language() || m().code)"
          [title]="status() === 'copied' ? m().copied : m().copy"
        >
          <emfc-icon [icon]="status() === 'copied' ? Check : Copy" [size]="16" />
        </button>
      </div>
    </div>
    <pre
      tabindex="0"
      [attr.aria-label]="label() || language() || m().code"
      [class.wrap]="wrapping()"
    ><code [style.--line-number-width]="lineNumberWidth()">@for (line of lines(); track $index) {<span class="code-line"><span class="line-number" aria-hidden="true" [attr.data-line]="$index + 1"></span><span class="line-text">@for (part of line; track $index) {@if (part.href) {<a [href]="part.href" [attr.target]="part.href.startsWith('mailto:') ? null : '_blank'" rel="noreferrer">{{ part.text }}</a>} @else {{{ part.text }}}}</span></span>}</code></pre>
    @if (status()) {
      <p [attr.role]="status() === 'failed' ? 'alert' : 'status'">{{ status() === 'failed' ? m().failed : m().copied }}</p>
    }
  </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }
    /* Pair code, copy states and focus with shared surfaces in both themes. */
    .code-block {
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--emfc-control-line);
      border-radius: var(--emfc-radius-sm);
      background: var(--emfc-surface);
      color: var(--emfc-ink);
    }
    .code-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--emfc-space-3);
      padding: var(--emfc-space-2) var(--emfc-space-3);
      border-bottom: 1px solid var(--emfc-line);
      font-size: var(--emfc-text-sm);
    }
    .code-toolbar > span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .code-actions {
      display: flex;
      gap: var(--emfc-space-2);
      margin-left: auto;
    }
    button {
      flex-shrink: 0;
      min-height: 44px;
      padding: 0;
    }
    button[aria-pressed='true'] {
      background: var(--emfc-accent-soft);
      color: var(--emfc-on-accent-soft);
      border-color: var(--emfc-control-line);
    }
    pre {
      background: var(--emfc-code-surface);
      color: var(--emfc-ink);
      max-width: 100%;
      max-height: var(--code-block-max-height, none);
      margin: 0;
      padding: var(--emfc-space-4) 0;
      overflow: auto;
      white-space: pre;
      tab-size: 2;
      font: var(--emfc-text-sm)/1.6 var(--emfc-font-mono);
    }
    code {
      display: block;
      width: max-content;
      min-width: 100%;
      font: inherit;
      color: inherit;
    }
    .code-line {
      display: grid;
      grid-template-columns: var(--line-number-width) minmax(0, 1fr);
    }
    .line-number {
      position: sticky;
      left: 0;
      align-self: stretch;
      padding-right: var(--emfc-space-3);
      border-right: 1px solid var(--emfc-line);
      background: var(--emfc-code-surface);
      color: var(--emfc-muted);
      text-align: right;
      user-select: none;
    }
    .line-number::before {
      content: attr(data-line);
    }
    .line-text {
      min-width: 0;
      min-height: 1lh;
      padding: 0 var(--emfc-space-3);
    }
    a {
      color: var(--emfc-accent);
      text-decoration: underline;
    }
    pre.wrap {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre.wrap code {
      width: auto;
    }
    pre:focus-visible {
      outline: 3px solid var(--emfc-focus);
      outline-offset: -3px;
    }
    p {
      margin: 0;
      padding: var(--emfc-space-2) var(--emfc-space-3);
      font-size: var(--emfc-text-sm);
    }
    p[role='alert'] {
      color: var(--emfc-error);
    }
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly label = input('');
  readonly showLabel = input(true);
  readonly language = input('');
  readonly wrap = input(true);
  protected readonly wrapping = linkedSignal(() => this.wrap());
  readonly parts = input<readonly { text: string; href?: string }[] | null>(null);
  protected readonly lines = computed(() => {
    const lines: { text: string; href?: string }[][] = [[]];
    for (const part of this.parts() ?? codeLinkParts(this.code())) {
      for (const text of part.text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
        lines[lines.length - 1].push({ ...part, text });
        if (text.endsWith('\n')) lines.push([]);
      }
    }
    if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
    return lines;
  });
  protected readonly lineNumberWidth = computed(
    () => `${String(this.lines().length).length + 3}ch`,
  );
  protected readonly m = useMessages(messages);
  protected readonly Copy = Copy;
  protected readonly Check = Check;
  protected readonly WrapText = WrapText;
  protected readonly busy = signal(false);
  protected readonly status = signal<'' | 'copied' | 'failed'>('');

  constructor() {
    effect(() => {
      this.code();
      this.status.set('');
    });
  }

  protected async copy() {
    const code = this.code();
    this.busy.set(true);
    try {
      await navigator.clipboard.writeText(code);
      if (this.code() === code) this.status.set('copied');
    } catch {
      if (this.code() === code) this.status.set('failed');
    } finally {
      this.busy.set(false);
    }
  }
}
