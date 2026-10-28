import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type HunterCharacterSpec,
  type StandableSurface,
  computeGazeTransform,
  pickNextHunterPose,
  pickRandomQuote,
  resolveNearestStandablePoint,
} from '../contracts/case-scene';
import { CaseScene } from './case-scene';
import { AnimateTabs } from './animate-tabs';

const sampleHunter: HunterCharacterSpec = {
  id: 'bobby',
  name: 'Bobby Singer',
  sheetUrl: 'sprites/bobby-chibi.png',
  initialXRatio: 0.75,
  quotes: {
    en: ['Check the lore first.', 'Salt the perimeter.'],
    vi: ['Tra sổ tay trước đi.', 'Rải muối quanh vành đai.'],
  },
};

@Component({
  imports: [CaseScene, AnimateTabs],
  template: `
    <nav class="segmented" emfcAnimateTabs>
      <button type="button" aria-current="page">Overview</button>
      <button type="button">Tasks</button>
    </nav>
    <div class="panel" style="width: 320px; height: 120px; margin-top: 120px">Panel surface</div>
    <emfc-case-scene [hunters]="hunters" />
  `,
})
class Host {
  hunters = [sampleHunter];
}

describe('CaseScene contract & component', () => {
  it('snaps to the nearest standable component surface near the actor position', () => {
    const surfaces: StandableSurface[] = [
      { id: 'panel-1', left: 100, right: 500, y: 220, bottom: 360, climbable: true },
      { id: 'panel-2', left: 520, right: 900, y: 420, bottom: 540, climbable: true },
    ];
    const point = resolveNearestStandablePoint(surfaces, 260, 245, 1200, 800);
    expect(point.surfaceId).toBe('panel-1');
    expect(point.x).toBe(260);
    expect(point.y).toBe(220);

    const interiorPoint = resolveNearestStandablePoint(surfaces, 260, 245, 1200, 800, true);
    expect(interiorPoint.surfaceId).toBe('panel-1');
    expect(interiorPoint.x).toBe(260);
    expect(interiorPoint.y).toBe(245);
    expect(interiorPoint.v).toBeGreaterThan(0);
  });

  it('orients gaze toward the mouse cursor and avoids immediate quote repetition', () => {
    const leftGaze = computeGazeTransform(400, 300, 120, 260);
    expect(leftGaze.facing).toBe(-1);
    const rightGaze = computeGazeTransform(400, 300, 680, 320);
    expect(rightGaze.facing).toBe(1);

    const next = pickRandomQuote(['Line A', 'Line B'], 'Line A', () => 0);
    expect(next).toBe('Line B');

    const nextPose = pickNextHunterPose('walk', true, true, () => 0);
    expect(nextPose).not.toBe('walk');
  });

  it('renders hunter actors and enters 5s cursor-staring talk state on click', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const actor: HTMLElement | null = fixture.nativeElement.querySelector('[data-hunter="bobby"]');
    expect(actor).not.toBeNull();
    expect(actor?.getAttribute('data-staring')).toBe('false');

    const scene = fixture.debugElement.children[2].componentInstance as CaseScene;
    scene.triggerStopAndTalk('bobby', 180, 210);
    fixture.detectChanges();

    expect(actor?.getAttribute('data-pose')).toBe('talk');
    expect(actor?.getAttribute('data-staring')).toBe('true');
    const bubble: HTMLElement | null = fixture.nativeElement.querySelector('[data-bubble-for="bobby"]');
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toContain('Bobby Singer');

    const nav: HTMLElement | null = fixture.nativeElement.querySelector('nav.animate-tabs');
    expect(nav?.getAttribute('data-aui-tabs')).toBe('ready');
  });
});
