import { TestBed } from '@angular/core/testing';
import { CountChart } from './count-chart';

it('keeps count ticks distinct and provides an accessible daily-value transcript', () => {
  const fixture = TestBed.createComponent(CountChart);
  fixture.componentRef.setInput('label', 'Daily observations');
  fixture.componentRef.setInput('labels', ['2026-10-21', '2026-10-22']);
  fixture.componentRef.setInput('values', [0, 1]);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  expect(element.querySelector('figure')?.getAttribute('aria-label')).toBe('Daily observations');
  expect(
    [...element.querySelectorAll('.axis span')].map((tick) => tick.textContent?.trim()),
  ).toEqual(['0', '1']);
  expect(element.querySelectorAll('rect')).toHaveLength(2);
  expect(element.querySelector('summary')?.textContent).toContain('Daily observations');
  expect(element.querySelector('.values')?.textContent).toContain('2026-10-22: 1');
});
