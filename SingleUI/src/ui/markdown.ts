import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  ElementRef,
  ViewContainerRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { marked } from 'marked';
import { CodeBlock } from './code-block';

/**
 * Renders untrusted GitHub-flavoured Markdown as themed prose.
 * Only empty named anchors are preserved from raw HTML; Angular sanitizes the rendered output.
 */
@Component({
  selector: 'emfc-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #content class="markdown" [innerHTML]="html()"></div>`,
  styles: `
    /* Contrast: prose uses ink/muted on the inherited surface; code uses surface + line. */
    emfc-markdown {
      display: block;
      min-width: 0;
    }
    emfc-markdown .markdown {
      color: var(--emfc-ink);
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    emfc-markdown .markdown > :first-child {
      margin-top: 0;
    }
    emfc-markdown .markdown > :last-child {
      margin-bottom: 0;
    }
    emfc-markdown .markdown :is(p, ul, ol, blockquote, pre, table):not(emfc-code-block *) {
      margin: 0 0 var(--emfc-space-3);
    }
    emfc-markdown :is(h1, h2, h3, h4) {
      margin: var(--emfc-space-4) 0 var(--emfc-space-2);
      line-height: 1.25;
      font-weight: 700;
    }
    emfc-markdown h1 {
      font-size: 1.35rem;
    }
    emfc-markdown h2 {
      font-size: 1.15rem;
      padding-bottom: var(--emfc-space-1);
      border-bottom: 1px solid var(--emfc-line);
    }
    emfc-markdown :is(h3, h4) {
      font-size: 1rem;
    }
    emfc-markdown :is(ul, ol) {
      padding-left: 1.4em;
    }
    emfc-markdown li + li {
      margin-top: 0.25em;
    }
    emfc-markdown li::marker {
      color: var(--emfc-muted);
    }
    emfc-markdown a {
      color: var(--emfc-accent);
      text-underline-offset: 2px;
    }
    emfc-markdown blockquote {
      padding: var(--emfc-space-1) var(--emfc-space-3);
      border-left: 3px solid var(--emfc-line);
      color: var(--emfc-muted);
    }
    emfc-markdown code:not(emfc-code-block code) {
      font-family: var(--emfc-font-mono, monospace);
      font-size: 0.875em;
      padding: 0.1em 0.35em;
      border-radius: 4px;
      background: var(--emfc-surface-hover);
    }
    emfc-markdown pre:not(emfc-code-block pre) {
      padding: var(--emfc-space-3);
      overflow-x: auto;
      border: 1px solid var(--emfc-line);
      border-radius: var(--emfc-radius-sm, 8px);
      background: var(--emfc-surface);
    }
    emfc-markdown pre code:not(emfc-code-block code) {
      padding: 0;
      background: none;
      font-size: 0.85rem;
    }
    emfc-markdown table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
    }
    emfc-markdown :is(th, td) {
      padding: var(--emfc-space-1) var(--emfc-space-2);
      border: 1px solid var(--emfc-line);
      text-align: left;
    }
    emfc-markdown th {
      background: var(--emfc-surface);
      font-weight: 600;
    }
    emfc-markdown hr {
      border: 0;
      border-top: 1px solid var(--emfc-line);
      margin: var(--emfc-space-4) 0;
    }
    emfc-markdown img {
      max-width: 100%;
      height: auto;
      border-radius: var(--emfc-radius-sm, 8px);
    }
    emfc-markdown input[type='checkbox'] {
      margin-right: 0.4em;
      accent-color: var(--emfc-action);
    }
  `,
})
export class Markdown {
  readonly text = input('');
  protected readonly html = computed(() => renderMarkdown(this.text()));
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly blocks = inject(ViewContainerRef);

  constructor() {
    afterRenderEffect(() => {
      this.text();
      this.blocks.clear();
      for (const code of this.content().nativeElement.querySelectorAll('pre > code')) {
        const pre = code.parentElement!;
        const block = this.blocks.createComponent(CodeBlock);
        block.setInput('code', code.textContent ?? '');
        block.setInput('language', [...code.classList].find(value => value.startsWith('language-'))?.slice(9) ?? '');
        pre.replaceWith(block.location.nativeElement);
      }
    });
  }
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderMarkdown(text: string): string {
  return marked.parse(text ?? '', {
    async: false,
    gfm: true,
    breaks: true,
    renderer: Object.assign(new marked.Renderer(), {
      html: ({ text: raw }: { text: string }) =>
        /^(?:<a id="[a-zA-Z][\w-]*">(?:<\/a>)?|<\/a>)\s*$/.test(raw) ? raw : escapeHtml(raw),
    }),
  }) as string;
}
