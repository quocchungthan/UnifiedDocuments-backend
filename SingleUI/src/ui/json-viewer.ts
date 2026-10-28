import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CodeBlock, CodeBlockPart, isCodeLink } from './code-block';

@Component({
  selector: 'emfc-json-viewer',
  imports: [CodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<emfc-code-block
    [code]="json()"
    [label]="label()"
    [showLabel]="showLabel()"
    language="json"
    [parts]="parts()"
  />`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        --code-block-max-height: 280px;
      }
    `,
  ],
})
export class JsonViewer {
  readonly value = input.required<unknown>();
  readonly label = input.required<string>();
  readonly showLabel = input(true);
  protected readonly json = computed(() => JSON.stringify(this.value(), null, 2) ?? '');
  protected readonly parts = computed(() => jsonParts(this.value()));
}

export function jsonParts(value: unknown): CodeBlockPart[] {
  const json = JSON.stringify(value, null, 2) ?? '';
  const parts: CodeBlockPart[] = [];
  let position = 0;
  for (const match of json.matchAll(/"(?:\\.|[^"\\])*"/g)) {
    const parsed: unknown = JSON.parse(match[0]);
    if (typeof parsed !== 'string' || !isCodeLink(parsed)) continue;
    // A quoted JSON key is not a response URL value.
    if (/^\s*:/.test(json.slice(match.index + match[0].length))) continue;
    parts.push({ text: json.slice(position, match.index + 1) });
    parts.push({ text: match[0].slice(1, -1), href: parsed });
    position = match.index + match[0].length - 1;
  }
  parts.push({ text: json.slice(position) });
  return parts;
}
