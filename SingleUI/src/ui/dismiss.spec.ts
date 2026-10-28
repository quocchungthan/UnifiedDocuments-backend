import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Dismiss } from './dismiss';

@Component({
  imports: [Dismiss],
  template: `<button #toggle (click)="open.set(!open())">toggle</button>
    @if (open()) {
      <div class="popup" [emfcDismissIgnore]="[toggle]" (emfcDismiss)="open.set(false)"><a>inside</a></div>
    }
    <p class="outside">outside</p>`,
})
class Host {
  readonly open = signal(true);
}

const press = (element: Element) =>
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

it('collapses on outside pointer or Escape but not on inside or toggle presses', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.autoDetectChanges();
  document.body.append(fixture.nativeElement);
  const root = fixture.nativeElement as HTMLElement;
  press(root.querySelector('.popup a')!);
  press(root.querySelector('button')!);
  expect(fixture.componentInstance.open()).toBe(true);
  press(root.querySelector('.outside')!);
  expect(fixture.componentInstance.open()).toBe(false);
  fixture.componentInstance.open.set(true);
  fixture.detectChanges();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(fixture.componentInstance.open()).toBe(false);
  root.remove();
});
