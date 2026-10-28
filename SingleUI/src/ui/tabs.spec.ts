import { TestBed } from '@angular/core/testing';
import { Tabs } from './tabs';

it('skips unavailable capabilities when moving or wrapping between tabs', () => {
  const fixture = TestBed.createComponent(Tabs);
  fixture.componentRef.setInput('items', [
    { id: 'first', label: 'First' },
    { id: 'disabled', label: 'Unavailable', disabled: true },
    { id: 'last', label: 'Last' },
  ]);
  fixture.componentRef.setInput('selected', 'first');
  fixture.componentRef.setInput('label', 'Modes');
  fixture.componentRef.setInput('idPrefix', 'modes');
  const selected: string[] = [];
  fixture.componentInstance.selectionChange.subscribe(id => {
    selected.push(id);
    fixture.componentRef.setInput('selected', id);
  });
  fixture.detectChanges();
  const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
  for (const [index, key] of [[0, 'ArrowRight'], [2, 'ArrowRight'], [0, 'End'], [2, 'Home']] as const) {
    buttons[index].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }
  expect(selected).toEqual(['last', 'first', 'last', 'first']);
  expect(document.activeElement).toBe(buttons[0]);
});

it('links the selected tab to its panel and supports wrapping keyboard navigation', () => {
  const fixture = TestBed.createComponent(Tabs);
  fixture.componentRef.setInput('items', [
    { id: 'learn', label: 'Learn' },
    { id: 'references', label: 'References' },
    { id: 'book', label: 'Field book' },
  ]);
  fixture.componentRef.setInput('selected', 'learn');
  fixture.componentRef.setInput('label', 'Part information');
  fixture.componentRef.setInput('idPrefix', 'details');
  fixture.componentInstance.selectionChange.subscribe((id) =>
    fixture.componentRef.setInput('selected', id),
  );
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const tabs = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  expect(tabs[0].getAttribute('aria-controls')).toBe('details-panel-learn');
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  expect([...tabs].map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  fixture.detectChanges();
  expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  expect([...tabs].map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  fixture.detectChanges();
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  tabs[1].click();
  fixture.detectChanges();
  expect(tabs[1].getAttribute('aria-selected')).toBe('true');
});
