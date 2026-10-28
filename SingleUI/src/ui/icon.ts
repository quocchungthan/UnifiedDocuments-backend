import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
} from '@angular/core';
import type { IconNode } from 'lucide';

const svgNs = 'http://www.w3.org/2000/svg';

/**
 * Shared icon language: pass a tree-shaken Lucide node, e.g.
 * `import { Mail } from 'lucide'` then `<emfc-icon [icon]="Mail" />`.
 * Decorative by default; give `label` only when the icon alone carries meaning.
 */
@Component({
  selector: 'emfc-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    class: 'icon-glyph',
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': "label() ? null : 'true'",
    '[style.--icon-size]': "size() + 'px'",
  },
})
export class Icon {
  readonly icon = input.required<IconNode>();
  readonly size = input(18);
  readonly label = input('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const document = this.host.ownerDocument;
      const svg = document.createElementNS(svgNs, 'svg');
      for (const [name, value] of Object.entries({
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        focusable: 'false',
      }))
        svg.setAttribute(name, value);
      for (const [tag, attributes] of this.icon()) {
        const child = document.createElementNS(svgNs, tag);
        for (const [name, value] of Object.entries(attributes))
          if (value !== undefined) child.setAttribute(name, String(value));
        svg.append(child);
      }
      this.host.replaceChildren(svg);
    });
  }
}
