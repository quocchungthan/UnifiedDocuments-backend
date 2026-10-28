import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  ViewEncapsulation,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  type GazeTransform,
  type HunterCharacterSpec,
  type HunterPose,
  type StandableSurface,
  type SurfaceEdge,
  computeGazeTransform,
  pickNextHunterPose,
  pickRandomQuote,
  resolveNearestStandablePoint,
} from '../contracts/case-scene';
import { SystemPreferences } from '../preferences/system-preferences';

const TALK_DURATION_MS = 5000;
const SURFACE_DISCOVERY_MS = 900;

/**
 * All standable & climbable UI components across PARA-AI and DiskLens,
 * excluding the global background (`body`, `.app`, `.shell`, `.workspace`, `main`)
 * and excluding the top navigation bar (`.header`, `.topbar`).
 */
const STANDABLE_SELECTOR = [
  '.metric',
  'emfc-metric',
  '.opportunity',
  '.agent-card',
  '.drive-card',
  '.notice',
  '.local-notice',
  '.analysis-grid > section',
  '.table-panel',
  '.table-wrap',
  '.canvas-region',
  'bridge-network',
  '.hotspots button',
  '.type-list button',
  'disklens-controls',
  '.scan-progress',
  '.coverage',
  '.empty-state',
  '.side-nav',
  '.privacy',
  '.panel',
  '.card',
  'emfc-panel',
].join(', ');

interface HunterActorView {
  readonly spec: HunterCharacterSpec;
  readonly x: number;
  readonly y: number;
  readonly pose: HunterPose;
  readonly frameCol: number;
  readonly frameRow: number;
  readonly facing: 1 | -1;
  readonly tiltDeg: number;
  readonly lookX: number;
  readonly lookY: number;
  readonly quote: string | null;
  readonly surfaceId: string;
  readonly edge: SurfaceEdge;
  readonly bubbleSide: 'left' | 'right' | 'center';
  readonly bubbleLow: boolean;
}

interface MutableActor {
  spec: HunterCharacterSpec;
  x: number;
  y: number;
  pose: HunterPose;
  edge: SurfaceEdge;
  /** Normalized horizontal coordinate (0..1) within the component flat. */
  u: number;
  /** Normalized vertical coordinate (0..1) within the component flat (0 = top ledge, >0 = interior flat). */
  v: number;
  /** Horizontal travel direction (+1 or -1). */
  dir: 1 | -1;
  /** Vertical climb direction within the component flat (+1 down or -1 up). */
  dirV: 1 | -1;
  /** Subtle horizontal drift while climbing within the component flat. */
  climbDriftU: number;
  animFrame: number;
  lastFrameAt: number;
  phaseUntil: number;
  talkUntil: number;
  quote: string | null;
  surfaceId: string;
  /** Jump / transfer interpolation state between components. */
  transferring: boolean;
  fromX: number;
  fromY: number;
  toSurfaceId: string;
  toEdge: SurfaceEdge;
  toU: number;
  toV: number;
  transferStartAt: number;
  transferDurationMs: number;
  arcHeightPx: number;
  facing: 1 | -1;
  gaze: GazeTransform;
}

@Component({
  selector: 'emfc-case-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="emfc-case-scene"
      aria-hidden="true"
      data-case-scene="ready"
      [style.height.px]="docHeight()"
    >
      @for (actor of actors(); track actor.spec.id) {
        <div
          class="hunter-actor"
          [class.is-talking]="actor.pose === 'talk'"
          [class.is-climbing]="actor.pose === 'climb'"
          [class.is-jumping]="actor.pose === 'jump'"
          [class.is-running]="actor.pose === 'run'"
          [attr.data-hunter]="actor.spec.id"
          [attr.data-pose]="actor.pose"
          [attr.data-edge]="actor.edge"
          [attr.data-staring]="actor.pose === 'talk' ? 'true' : 'false'"
          [attr.data-surface]="actor.surfaceId"
          [style.left.px]="actor.x"
          [style.top.px]="actor.y"
        >
          @if (actor.quote) {
            <div
              class="hunter-bubble"
              [attr.data-bubble-for]="actor.spec.id"
              [attr.data-side]="actor.bubbleSide"
              [class.is-low]="actor.bubbleLow"
              [style.max-width.px]="actor.bubbleLow ? bubbleWidth(actor.x, actor.bubbleSide) : null"
            >
              <strong class="hunter-name">{{ actor.spec.name }}</strong>
              <span class="hunter-line">{{ actor.quote }}</span>
            </div>
          }
          <div
            class="hunter-sprite"
            [style.background-image]="'url(' + actor.spec.sheetUrl + ')'"
            [style.--frame-col]="actor.frameCol"
            [style.--frame-row]="actor.frameRow"
            [style.--facing]="actor.facing"
            [style.--tilt]="actor.tiltDeg + 'deg'"
            [style.--look-x]="actor.lookX + 'px'"
            [style.--look-y]="actor.lookY + 'px'"
          ></div>
        </div>
      }
    </div>
  `,
  styles: `
    body {
      position: relative;
    }
    emfc-case-scene {
      display: contents;
    }
    .emfc-case-scene {
      --hunter-size: 96px;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      pointer-events: none;
      overflow: hidden;
      z-index: 38;
      contain: layout style;
    }
    @media (max-width: 520px) {
      .emfc-case-scene {
        --hunter-size: 82px;
      }
    }
    .hunter-actor {
      position: absolute;
      width: var(--hunter-size);
      height: var(--hunter-size);
      transform: translate(-50%, -94%);
      pointer-events: none;
      user-select: none;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      cursor: pointer;
      pointer-events: auto;
      will-change: left, top;
    }
    .hunter-sprite {
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      /* 4 columns x 3 rows (512x384) sheet */
      background-size: 400% 300%;
      background-position: calc(var(--frame-col, 0) * 33.3333%) calc(var(--frame-row, 0) * 50%);
      transform-origin: 50% 92%;
      transform: translate(var(--look-x, 0px), var(--look-y, 0px))
        scaleX(var(--facing, 1))
        rotate(var(--tilt, 0deg));
      transition: transform 90ms ease-out;
      filter: drop-shadow(0 4px 7px rgba(24, 18, 12, 0.28));
    }
    .hunter-actor.is-talking .hunter-sprite {
      transform: translate(var(--look-x, 0px), var(--look-y, 0px))
        scaleX(var(--facing, 1))
        rotate(var(--tilt, 0deg))
        scale(1.06);
      filter: drop-shadow(0 6px 12px rgba(24, 18, 12, 0.36));
    }
    .hunter-bubble {
      box-sizing: border-box;
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      max-width: 240px;
      padding: var(--emfc-space-2) var(--emfc-space-3);
      border-radius: var(--emfc-radius-sm);
      border: 1.5px solid var(--emfc-accent);
      background: var(--emfc-surface);
      color: var(--emfc-ink);
      box-shadow: var(--shadow-card), var(--card-highlight);
      font-size: var(--emfc-text-xs, 0.78rem);
      line-height: 1.38;
      pointer-events: none;
      z-index: 2;
      animation: hunter-bubble-pop 160ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .hunter-bubble[data-side='left'] {
      left: auto;
      right: 0;
      transform: none;
    }
    .hunter-bubble[data-side='right'] {
      left: 0;
      transform: none;
    }
    .hunter-bubble.is-low {
      bottom: auto;
      top: 6px;
      left: auto;
      right: calc(100% + 6px);
      transform: none;
    }
    .hunter-bubble.is-low[data-side='right'] {
      right: auto;
      left: calc(100% + 6px);
    }
    @keyframes hunter-bubble-pop {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(6px) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
    }
    .hunter-name {
      display: block;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--emfc-accent);
      margin-bottom: 2px;
    }
    .hunter-line {
      display: block;
      color: var(--emfc-ink);
      overflow-wrap: anywhere;
    }
  `,
})
export class CaseScene {
  readonly hunters = input.required<readonly HunterCharacterSpec[]>();

  protected bubbleWidth(x: number, side: 'left' | 'right' | 'center') {
    return Math.max(96, Math.min(240, (side === 'right' ? this.cachedDocWidth - x : x) - 60));
  }
  protected readonly actors = signal<readonly HunterActorView[]>([]);
  protected readonly docHeight = signal<number>(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );

  private readonly preferences = inject(SystemPreferences);
  private readonly zone = inject(NgZone);
  private readonly mutableActors: MutableActor[] = [];
  private readonly elementSurfaceIds = new WeakMap<Element, string>();
  private nextSurfaceSeq = 1;
  private surfaces: StandableSurface[] = [];
  private cursorX = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 400;
  private cursorY = typeof window !== 'undefined' ? window.innerHeight * 0.4 : 300;
  private lastDiscoveryAt = 0;
  private topNavBottom = 68;
  private cachedDocWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  private cachedDocHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  constructor() {
    effect(() => {
      const specs = this.hunters();
      this.preferences.locale();
      untracked(() => this.syncActorsFromSpecs(specs));
    });

    if (typeof window === 'undefined') return;

    const toDocPoint = (clientX: number, clientY: number) => ({
      x: clientX + (window.scrollX || 0),
      y: clientY + (window.scrollY || 0),
    });

    const updatePointer = (clientX: number, clientY: number) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const pt = toDocPoint(clientX, clientY);
      this.cursorX = pt.x;
      this.cursorY = pt.y;
      let changed = false;
      for (const actor of this.mutableActors) {
        if (actor.pose === 'talk') {
          actor.gaze = computeGazeTransform(actor.x, actor.y, this.cursorX, this.cursorY);
          actor.facing = actor.gaze.facing;
          changed = true;
        }
      }
      if (changed) this.publish();
    };

    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      updatePointer(event.clientX, event.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updatePointer(touch.clientX, touch.clientY);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    const onWindowPointerDown = (event: PointerEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-hunter]')
          : null;
      const hunterId = target?.dataset['hunter'];
      if (!hunterId) return;
      event.stopPropagation();
      this.zone.run(() =>
        this.triggerStopAndTalk(
          hunterId,
          event.clientX + (window.scrollX || 0),
          event.clientY + (window.scrollY || 0),
        ),
      );
    };
    window.addEventListener('pointerdown', onWindowPointerDown, { capture: true });

    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0.016, (now - lastTick) / 1000));
      lastTick = now;
      this.step(now, dt);
    }, 45);

    inject(DestroyRef).onDestroy(() => {
      window.clearInterval(timer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerdown', onWindowPointerDown, { capture: true });
    });
  }

  /**
   * Stops the clicked/touched hunter (or all hunters when targetHunterId is null) within the flat
   * of their nearest component near their document position, staring at the cursor/touch point for 5 seconds.
   */
  triggerStopAndTalk(targetHunterId: string | null, cursorX: number, cursorY: number) {
    const now = performance.now();
    this.discoverSurfaces(now, true);

    for (const actor of this.mutableActors) {
      if (targetHunterId !== null && actor.spec.id !== targetHunterId) continue;
      const stand = resolveNearestStandablePoint(
        this.surfaces,
        actor.x,
        actor.y,
        this.cachedDocWidth,
        this.cachedDocHeight,
        true,
      );
      actor.transferring = false;
      actor.surfaceId = stand.surfaceId;
      actor.edge = stand.v > 0.04 ? 'flat' : 'top';
      actor.u = stand.u;
      actor.v = stand.v;
      actor.x = stand.x;
      actor.y = stand.y;
      actor.pose = 'talk';
      actor.talkUntil = now + TALK_DURATION_MS;
      actor.phaseUntil = actor.talkUntil;
      actor.gaze = computeGazeTransform(actor.x, actor.y, cursorX, cursorY);
      actor.facing = actor.gaze.facing;
      const lang = this.preferences.locale();
      const pool = lang === 'vi' ? actor.spec.quotes.vi : actor.spec.quotes.en;
      actor.quote = pickRandomQuote(pool, actor.quote);
    }
    this.publish();
  }

  private syncActorsFromSpecs(specs: readonly HunterCharacterSpec[]) {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    this.discoverSurfaces(now, true);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

    this.mutableActors.length = 0;
    specs.forEach((spec, index) => {
      const ratio = spec.initialXRatio ?? (0.66 + index * 0.16);
      const startX = Math.max(56, Math.min(vw - 56, Math.round(vw * ratio)));
      const startY = Math.max(180, Math.min(vh - 60, Math.round(vh * (0.42 + index * 0.16))));
      const stand = resolveNearestStandablePoint(
        this.surfaces,
        startX,
        startY,
        this.cachedDocWidth,
        this.cachedDocHeight,
        true,
      );
      const facing: 1 | -1 = index % 2 === 0 ? -1 : 1;
      const initialPose: HunterPose = index % 2 === 0 ? 'run' : 'walk';
      this.mutableActors.push({
        spec,
        x: stand.x,
        y: stand.y,
        pose: initialPose,
        edge: stand.v > 0.04 ? 'flat' : 'top',
        u: stand.u,
        v: stand.v,
        dir: facing,
        dirV: 1,
        climbDriftU: 0.18 * facing,
        animFrame: index % 4,
        lastFrameAt: now,
        phaseUntil: now + 2000 + index * 650,
        talkUntil: 0,
        quote: null,
        surfaceId: stand.surfaceId,
        transferring: false,
        fromX: stand.x,
        fromY: stand.y,
        toSurfaceId: stand.surfaceId,
        toEdge: 'flat',
        toU: stand.u,
        toV: stand.v,
        transferStartAt: 0,
        transferDurationMs: 450,
        arcHeightPx: 36,
        facing,
        gaze: { facing, tiltDeg: 0, lookX: 0, lookY: 0 },
      });
    });
    this.publish();
  }

  private getTopNavBottom(scrollY: number): number {
    if (typeof document === 'undefined') return 68;
    const nav = document.querySelector('.header, .topbar');
    if (!nav) return 68;
    const rect = nav.getBoundingClientRect();
    this.topNavBottom = Math.max(56, Math.min(180, Math.round(rect.bottom + scrollY)));
    return this.topNavBottom;
  }

  private discoverSurfaces(now: number, force = false) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (!force && now - this.lastDiscoveryAt < SURFACE_DISCOVERY_MS && this.surfaces.length > 1) {
      this.refreshLiveSurfaceBoxes(true);
      return;
    }
    this.lastDiscoveryAt = now;

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const docEl = document.documentElement;
    this.cachedDocWidth = Math.max(320, docEl?.clientWidth || vw);
    this.cachedDocHeight = Math.max(vh, docEl?.scrollHeight || vh);
    if (this.docHeight() !== this.cachedDocHeight) {
      this.docHeight.set(this.cachedDocHeight);
    }

    const minTop = this.getTopNavBottom(scrollY) + 18;
    const elements = Array.from(document.querySelectorAll(STANDABLE_SELECTOR));
    const discovered: StandableSurface[] = [];

    elements.forEach((el) => {
      if (el.closest('.header, .topbar')) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 84 || rect.height < 28) return;
      const docLeft = Math.round(rect.left + scrollX);
      const docRight = Math.round(rect.right + scrollX);
      const docTop = Math.round(rect.top + scrollY);
      const docBottom = Math.round(rect.bottom + scrollY);
      if (docBottom < minTop + 16) return;
      const left = Math.max(48, docLeft);
      const right = Math.min(this.cachedDocWidth - 48, docRight);
      if (right - left < 64) return;
      const topY = Math.max(minTop, docTop);
      const bottomY = Math.max(topY + 24, Math.min(this.cachedDocHeight - 16, docBottom));
      let surfaceId = this.elementSurfaceIds.get(el);
      if (!surfaceId) {
        surfaceId = `surface-${this.nextSurfaceSeq++}`;
        this.elementSurfaceIds.set(el, surfaceId);
      }
      discovered.push({
        id: surfaceId,
        left,
        right,
        y: topY,
        bottom: bottomY,
        climbable: bottomY - topY >= 36,
        element: el,
      });
    });

    if (!discovered.length) {
      discovered.push({
        id: 'fallback-component',
        left: 56,
        right: Math.max(140, this.cachedDocWidth - 56),
        y: Math.max(minTop + 40, Math.round(vh * 0.55)),
        bottom: Math.max(minTop + 120, Math.round(vh * 0.82)),
        climbable: true,
      });
    }

    this.surfaces = discovered;
  }

  private refreshLiveSurfaceBoxes(onlyActive = false) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const minTop = this.topNavBottom + 18;
    const activeIds = onlyActive
      ? new Set(this.mutableActors.flatMap((a) => [a.surfaceId, a.toSurfaceId]))
      : null;

    this.surfaces = this.surfaces.map((s) => {
      if (activeIds && !activeIds.has(s.id)) return s;
      if (!s.element || !s.element.isConnected) return s;
      const rect = s.element.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 16) return s;
      const left = Math.max(48, Math.round(rect.left + scrollX));
      const right = Math.min(this.cachedDocWidth - 48, Math.round(rect.right + scrollX));
      if (right <= left) return s;
      const topY = Math.max(minTop, Math.round(rect.top + scrollY));
      const bottomY = Math.max(
        topY + 20,
        Math.min(this.cachedDocHeight - 16, Math.round(rect.bottom + scrollY)),
      );
      return {
        ...s,
        left,
        right,
        y: topY,
        bottom: bottomY,
        climbable: bottomY - topY >= 36,
      };
    });
  }

  /**
   * Computes document-space `(x, y)` inside the 2D flat of `surface`, keeping horizontal coordinates
   * padded well inside the component (`padX`) so characters never touch narrow viewport borders.
   */
  private coordsOnSurface(
    surface: StandableSurface,
    u: number,
    v: number,
  ): { x: number; y: number } {
    const clampedU = Math.max(0.06, Math.min(0.94, u));
    const clampedV = Math.max(0, Math.min(0.92, v));
    const width = Math.max(40, surface.right - surface.left);
    const padX = Math.min(34, Math.max(16, Math.round(width * 0.1)));
    const innerLeft = Math.min(surface.left + padX, (surface.left + surface.right) * 0.5);
    const innerRight = Math.max(innerLeft, surface.right - padX);
    const topY = Math.max(this.topNavBottom + 18, surface.y);
    const bottomY = Math.max(topY + 16, surface.bottom - 8);
    return {
      x: innerLeft + clampedU * (innerRight - innerLeft),
      y: topY + clampedV * (bottomY - topY),
    };
  }

  private projectActorOntoSurface(actor: MutableActor) {
    const surface = this.surfaces.find((s) => s.id === actor.surfaceId) ?? this.surfaces[0];
    if (!surface) return;
    actor.surfaceId = surface.id;
    const pt = this.coordsOnSurface(surface, actor.u, actor.v);
    actor.x = pt.x;
    actor.y = pt.y;
  }

  private step(now: number, dt: number) {
    this.discoverSurfaces(now, false);

    for (const actor of this.mutableActors) {
      if (actor.pose === 'talk') {
        this.projectActorOntoSurface(actor);
        if (now >= actor.talkUntil) {
          actor.quote = null;
          actor.pose = 'run';
          actor.edge = actor.v > 0.04 ? 'flat' : 'top';
          actor.gaze = { facing: actor.facing, tiltDeg: 0, lookX: 0, lookY: 0 };
          actor.phaseUntil = now + 1800 + Math.random() * 1200;
        } else {
          actor.gaze = computeGazeTransform(actor.x, actor.y, this.cursorX, this.cursorY);
          actor.facing = actor.gaze.facing;
          continue;
        }
      }

      if (actor.transferring) {
        const destSurface =
          this.surfaces.find((s) => s.id === actor.toSurfaceId) ?? this.surfaces[0];
        if (!destSurface) {
          actor.transferring = false;
          continue;
        }
        const targetPt = this.coordsOnSurface(destSurface, actor.toU, actor.toV);
        const progress = Math.min(
          1,
          Math.max(0, (now - actor.transferStartAt) / Math.max(120, actor.transferDurationMs)),
        );
        if (actor.pose === 'climb' && now - actor.lastFrameAt >= 135) {
          actor.animFrame = (actor.animFrame + 1) % 2;
          actor.lastFrameAt = now;
        }
        const arc =
          actor.pose === 'jump' ? Math.sin(progress * Math.PI) * actor.arcHeightPx : 0;
        actor.x = actor.fromX + (targetPt.x - actor.fromX) * progress;
        actor.y = actor.fromY + (targetPt.y - actor.fromY) * progress - arc;
        actor.facing = targetPt.x < actor.fromX - 2 ? -1 : 1;

        if (progress >= 1) {
          actor.transferring = false;
          actor.surfaceId = destSurface.id;
          actor.edge = actor.toEdge;
          actor.u = actor.toU;
          actor.v = actor.toV;
          actor.x = targetPt.x;
          actor.y = targetPt.y;
          if (destSurface.climbable && Math.random() < 0.48) {
            actor.pose = 'climb';
            actor.edge = 'flat';
            actor.dirV = actor.v > 0.5 ? -1 : 1;
            actor.climbDriftU = (Math.random() * 0.35 + 0.1) * (actor.u > 0.5 ? -1 : 1);
            actor.facing = actor.climbDriftU < 0 ? -1 : 1;
            actor.phaseUntil = now + 1300 + Math.random() * 1200;
          } else {
            actor.pose = Math.random() < 0.5 ? 'run' : 'walk';
            actor.dir = actor.facing;
            actor.phaseUntil = now + 1500 + Math.random() * 1600;
          }
        }
        continue;
      }

      // Only re-anchor if the component element itself disconnected (e.g. view switch), never on scroll
      let currentSurface = this.surfaces.find((s) => s.id === actor.surfaceId);
      if (!currentSurface || (currentSurface.element && !currentSurface.element.isConnected)) {
        const stand = resolveNearestStandablePoint(
          this.surfaces,
          actor.x,
          actor.y,
          this.cachedDocWidth,
          this.cachedDocHeight,
          true,
        );
        actor.surfaceId = stand.surfaceId;
        actor.edge = stand.v > 0.04 ? 'flat' : 'top';
        actor.u = stand.u;
        actor.v = stand.v;
        currentSurface = this.surfaces.find((s) => s.id === actor.surfaceId) ?? this.surfaces[0];
      }
      if (!currentSurface) continue;

      const baseSpeed = actor.spec.speedPxPerSec ?? 78;

      if (actor.pose === 'climb') {
        if (now - actor.lastFrameAt >= 140) {
          actor.animFrame = (actor.animFrame + 1) % 2;
          actor.lastFrameAt = now;
        }
        actor.edge = 'flat';
        const flatHeight = Math.max(40, currentSurface.bottom - currentSurface.y);
        const flatWidth = Math.max(60, currentSurface.right - currentSurface.left);
        const climbSpeed = baseSpeed * 0.82;
        actor.v += (actor.dirV * climbSpeed * dt) / flatHeight;
        actor.u += (actor.climbDriftU * climbSpeed * dt) / flatWidth;

        if (actor.u <= 0.1 || actor.u >= 0.9) {
          actor.u = Math.max(0.1, Math.min(0.9, actor.u));
          actor.climbDriftU = -actor.climbDriftU;
        }
        actor.facing = actor.climbDriftU < -0.02 ? -1 : 1;

        if (actor.v <= 0.02) {
          actor.v = 0;
          actor.edge = 'top';
          if (Math.random() < 0.45 && this.startComponentTransfer(actor, currentSurface, now)) {
            continue;
          }
          actor.pose = Math.random() < 0.55 ? 'run' : 'walk';
          actor.dir = actor.u > 0.5 ? -1 : 1;
          actor.facing = actor.dir;
          actor.phaseUntil = now + 1500 + Math.random() * 1400;
        } else if (actor.v >= 0.9) {
          actor.v = 0.9;
          if (Math.random() < 0.5 && this.startComponentTransfer(actor, currentSurface, now)) {
            continue;
          }
          actor.dirV = -1;
          actor.climbDriftU = (Math.random() * 0.35 + 0.1) * (actor.u > 0.5 ? -1 : 1);
          actor.pose = Math.random() < 0.5 ? 'climb' : 'walk';
          actor.phaseUntil = now + 1300 + Math.random() * 1100;
        } else if (now >= actor.phaseUntil) {
          this.chooseNextBehavior(actor, currentSurface, now);
        }
        this.projectActorOntoSurface(actor);
        continue;
      }

      if (actor.pose === 'investigate' || actor.pose === 'look' || actor.pose === 'idle') {
        if (actor.pose === 'look' && now - actor.lastFrameAt >= 420) {
          actor.animFrame = (actor.animFrame + 1) % 2;
          actor.facing = actor.animFrame === 0 ? -1 : 1;
          actor.lastFrameAt = now;
        }
        this.projectActorOntoSurface(actor);
        if (now >= actor.phaseUntil) {
          this.chooseNextBehavior(actor, currentSurface, now);
        }
        continue;
      }

      const isSprint = actor.pose === 'run';
      const stepFrameMs = isSprint ? 85 : 125;
      if (now - actor.lastFrameAt >= stepFrameMs) {
        actor.animFrame = (actor.animFrame + 1) % 4;
        actor.lastFrameAt = now;
      }

      const span = Math.max(60, currentSurface.right - currentSurface.left);
      const moveSpeed = isSprint ? baseSpeed * 1.45 : baseSpeed * 0.88;
      actor.u += (actor.dir * moveSpeed * dt) / span;
      actor.facing = actor.dir;

      if (actor.u <= 0.08 || actor.u >= 0.92) {
        const hitLeft = actor.u <= 0.08;
        actor.u = hitLeft ? 0.08 : 0.92;
        actor.dir = hitLeft ? 1 : -1;
        actor.facing = actor.dir;

        const roll = Math.random();
        if (currentSurface.climbable && roll < 0.48) {
          actor.edge = 'flat';
          actor.dirV = actor.v > 0.5 ? -1 : 1;
          actor.climbDriftU = (0.18 + Math.random() * 0.25) * actor.dir;
          actor.pose = 'climb';
          actor.phaseUntil = now + 1300 + Math.random() * 1100;
        } else if (roll < 0.85 && this.startComponentTransfer(actor, currentSurface, now)) {
          continue;
        } else {
          actor.pose = Math.random() < 0.5 ? 'run' : 'walk';
          actor.phaseUntil = now + 1400 + Math.random() * 1400;
        }
      } else if (now >= actor.phaseUntil) {
        this.chooseNextBehavior(actor, currentSurface, now);
      }

      this.projectActorOntoSurface(actor);
    }

    this.publish();
  }

  private chooseNextBehavior(
    actor: MutableActor,
    currentSurface: StandableSurface,
    now: number,
  ) {
    const canClimb = currentSurface.climbable || this.surfaces.length > 1;
    const canJump = this.surfaces.length > 1;
    const next = pickNextHunterPose(actor.pose, canClimb, canJump);

    if (next === 'jump' && this.startComponentTransfer(actor, currentSurface, now, 'jump')) {
      return;
    }
    if (next === 'climb') {
      if (currentSurface.climbable && Math.random() < 0.62) {
        actor.edge = 'flat';
        actor.dirV = actor.v > 0.55 ? -1 : actor.v < 0.2 ? 1 : Math.random() < 0.5 ? 1 : -1;
        actor.climbDriftU = (0.15 + Math.random() * 0.3) * (actor.u > 0.5 ? -1 : 1);
        actor.facing = actor.climbDriftU < 0 ? -1 : 1;
        actor.pose = 'climb';
        actor.phaseUntil = now + 1200 + Math.random() * 1200;
        return;
      }
      if (this.startComponentTransfer(actor, currentSurface, now, 'climb')) {
        return;
      }
    }

    if (next === 'walk' || next === 'run') {
      if (Math.random() < 0.35) {
        actor.dir = actor.dir === 1 ? -1 : 1;
      }
      actor.facing = actor.dir;
      actor.pose = next;
      actor.edge = actor.v > 0.04 ? 'flat' : 'top';
      actor.phaseUntil = now + 1400 + Math.random() * 1700;
      return;
    }

    actor.pose = next;
    actor.animFrame = 0;
    actor.lastFrameAt = now;
    actor.phaseUntil = now + 1100 + Math.random() * 900;
  }

  private startComponentTransfer(
    actor: MutableActor,
    current: StandableSurface,
    now: number,
    preferredMode?: 'jump' | 'climb',
  ): boolean {
    const minTop = this.topNavBottom + 18;
    const candidates = this.surfaces.filter((s) => {
      if (s.id === current.id) return false;
      if (s.bottom < minTop + 16) return false;
      const midX = (s.left + s.right) * 0.5;
      const midY = (s.y + s.bottom) * 0.5;
      const dist = Math.hypot(midX - actor.x, midY - actor.y);
      return dist >= 28 && dist <= 560;
    });
    if (!candidates.length) return false;

    candidates.sort(
      (a, b) =>
        Math.hypot((a.left + a.right) * 0.5 - actor.x, (a.y + a.bottom) * 0.5 - actor.y) +
        Math.random() * 150 -
        (Math.hypot((b.left + b.right) * 0.5 - actor.x, (b.y + b.bottom) * 0.5 - actor.y) +
          Math.random() * 150),
    );
    const target = candidates[0];

    const landInsideFlat = target.climbable && Math.random() < 0.55;
    const toEdge: SurfaceEdge = landInsideFlat ? 'flat' : 'top';
    const toU = 0.14 + Math.random() * 0.72;
    const toV = landInsideFlat ? 0.18 + Math.random() * 0.68 : 0;
    const destPt = this.coordsOnSurface(target, toU, toV);
    const dist = Math.hypot(destPt.x - actor.x, destPt.y - actor.y);

    const mode: 'jump' | 'climb' =
      preferredMode ??
      (Math.abs(destPt.y - actor.y) > Math.abs(destPt.x - actor.x) ? 'climb' : 'jump');

    actor.transferring = true;
    actor.fromX = actor.x;
    actor.fromY = actor.y;
    actor.toSurfaceId = target.id;
    actor.toEdge = toEdge;
    actor.toU = toU;
    actor.toV = toV;
    actor.transferStartAt = now;
    actor.transferDurationMs = Math.max(340, Math.min(820, Math.round(dist * 1.9)));
    actor.arcHeightPx =
      mode === 'jump' ? Math.max(24, Math.min(64, Math.round(dist * 0.18))) : 10;
    actor.pose = mode;
    actor.facing = destPt.x < actor.x ? -1 : 1;
    return true;
  }

  private publish() {
    const dw = this.cachedDocWidth || 1024;
    this.actors.set(
      this.mutableActors.map((actor) => {
        const [frameRow, frameCol] = this.frameCoordinates(actor);
        const bubbleSide: 'left' | 'right' | 'center' =
          actor.x > dw - 180 ? 'left' : actor.x < 180 ? 'right' : 'center';
        const sprintLean = actor.pose === 'run' ? actor.facing * 4 : 0;
        return {
          spec: actor.spec,
          x: Math.round(actor.x),
          y: Math.round(actor.y),
          pose: actor.pose,
          frameCol,
          frameRow,
          facing: actor.facing,
          tiltDeg: actor.pose === 'talk' ? actor.gaze.tiltDeg : sprintLean,
          lookX: actor.pose === 'talk' ? Math.round(actor.gaze.lookX * 4) : 0,
          lookY: actor.pose === 'talk' ? Math.round(actor.gaze.lookY * 3) : 0,
          quote: actor.quote,
          surfaceId: actor.surfaceId,
          edge: actor.edge,
          bubbleSide,
          bubbleLow: actor.y < 195,
        };
      }),
    );
  }

  private frameCoordinates(actor: MutableActor): [number, number] {
    switch (actor.pose) {
      case 'walk':
      case 'run':
        return [0, actor.animFrame % 4];
      case 'climb':
        return [1, actor.animFrame % 2];
      case 'jump':
        return [1, 2];
      case 'investigate':
        return [1, 3];
      case 'idle':
        return [2, 0];
      case 'look':
        return [2, 1 + (actor.animFrame % 2)];
      case 'talk':
        return [2, 3];
    }
  }
}
