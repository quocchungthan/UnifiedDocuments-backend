import type { Config, Dashboard, Entry, EntryPage, Monitor, MonitorRequest, Progress, Scan } from '../../contracts/disklens';
import { filterEntries, LARGE_FILE_BYTES } from '../../domains/disklens/analysis';
import type { SourceScenario } from '../../contracts/service-source';
import { scenarioResult } from '../substitution/source';
import type { DiskLensApi, EntryQuery } from './client';

const now = Math.floor(Date.now() / 1000);
const root = 'C:\\Users\\Alex\\Documents';
const previous: Scan = { id: 'snapshot-older', root, started: now - 7 * 86400, completed: now - 7 * 86400 + 24, state: 'completed', files: 18421, bytes: 31_490_000_000, issues: 3, skippedLinks: 2, message: null };
const latest: Scan = { id: 'snapshot-latest', root, started: now - 3600, completed: now - 3570, state: 'completed', files: 18736, bytes: 33_204_000_000, issues: 1, skippedLinks: 2, message: null };
const roots = ['Projects\\atlas\\node_modules', 'Media\\raw-footage', 'Archives\\2023', 'Projects\\atlas\\dist', 'Photos\\exports', 'Downloads\\installers', 'Documents\\reports', 'Media\\podcasts'];
const files: Entry[] = [
  ['atlas-cache.tar', roots[0], '.tar', 'Archives', 1_820_000_000, 46, true],
  ['launch-film-4k.mp4', roots[1], '.mp4', 'Video', 1_460_000_000, 18, false],
  ['backup-2023-11.zip', roots[2], '.zip', 'Archives', 1_105_000_000, 420, false],
  ['dist-bundle.js.map', roots[3], '.map', 'Code & data', 820_000_000, 12, true],
  ['campaign-master.psd', roots[4], '.psd', 'Other', 743_000_000, 211, false],
  ['setup-suite.msi', roots[5], '.msi', 'Apps & packages', 628_000_000, 390, false],
  ['annual-review.pdf', roots[6], '.pdf', 'Documents', 289_000_000, 245, false],
  ['episode-18.flac', roots[7], '.flac', 'Audio', 188_000_000, 90, false],
  ['catalog-2024.xlsx', 'Documents\\finance', '.xlsx', 'Documents', 98_000_000, 250, false],
  ['portrait-final.heic', 'Photos\\family', '.heic', 'Images', 82_000_000, 100, false],
  ['archive-old.7z', 'Archives\\legacy', '.7z', 'Archives', 71_000_000, 900, false],
  ['mobile-build.apk', 'Projects\\mobile\\bin', '.apk', 'Apps & packages', 59_000_000, 31, true],
  ['notes.md', 'Documents\\planning', '.md', 'Documents', 6_400, 4, false],
].map(([name, folder, extension, category, bytes, age, build], id) => ({
  id: id + 1, name: String(name), folder: `${root}\\${folder}`, path: `${root}\\${folder}\\${name}`,
  extension: String(extension), category: String(category), bytes: Number(bytes), modified: now - Number(age) * 86400,
  buildArtifact: Boolean(build),
}));

const emptyProgress = (): Progress => ({ id: null, state: 'idle', root: '', files: 0, bytes: 0, issues: 0, skippedLinks: 0, currentPath: null, message: null });
const initialMonitor = (): Monitor => ({ enabled: false, root, intervalMinutes: 30, nextScan: null });

function makeDashboard(scan: Scan, old: Scan | null): Dashboard {
  const typeRows = [
    { label: 'Code & data', bytes: 12_100_000_000, files: 6940 }, { label: 'Video', bytes: 8_600_000_000, files: 402 },
    { label: 'Archives', bytes: 4_300_000_000, files: 728 }, { label: 'Images', bytes: 3_500_000_000, files: 5941 },
    { label: 'Documents', bytes: 2_100_000_000, files: 2128 }, { label: 'Apps & packages', bytes: 1_704_000_000, files: 355 },
    { label: 'Audio', bytes: 590_000_000, files: 1022 }, { label: 'Other', bytes: 310_000_000, files: 1220 },
  ];
  const folders = roots.map((label, i) => ({ label: `${root}\\${label}`, bytes: [5_300_000_000, 4_800_000_000, 3_900_000_000, 2_800_000_000, 2_200_000_000, 1_900_000_000, 1_200_000_000, 890_000_000][i], files: [2420, 408, 1230, 840, 1190, 113, 587, 410][i] }));
  return {
    scan, previous: old, delta: old ? scan.bytes - old.bytes : null,
    reviewBytes: 4_840_000_000, staleBytes: 6_120_000_000, buildBytes: 2_980_000_000,
    largeBytes: 7_430_000_000, types: typeRows, folders,
    growth: folders.slice(0, 5).map((folder, i) => ({ folder: folder.label, bytes: folder.bytes, delta: [840_000_000, 610_000_000, -310_000_000, 230_000_000, -125_000_000][i] })),
    issues: [{ path: `${root}\\.private`, message: 'Access denied for one protected folder.' }],
  };
}

/** Simulated local scan: realistic paths and incremental progress; it never reads a disk. */
export class DiskLensSubstitute implements DiskLensApi {
  private scans: Scan[];
  private current: Progress;
  private monitor = initialMonitor();
  private scanTimer?: ReturnType<typeof setInterval>;
  private step = 0;
  private sequence = 1;
  private readonly emptyScenario: boolean;

  constructor(private readonly scenario: SourceScenario) {
    this.emptyScenario = scenario === 'empty';
    this.scans = this.emptyScenario ? [] : [latest, previous];
    this.current = this.emptyScenario
      ? emptyProgress()
      : { id: latest.id, state: 'completed', root: latest.root, files: latest.files, bytes: latest.bytes, issues: latest.issues, skippedLinks: latest.skippedLinks, currentPath: null, message: null };
  }
  private result<R>(value: () => R, empty?: () => R): Promise<R> {
    return scenarioResult('disklens', this.scenario, { default: value, 'signed-out': value, ...(empty ? { empty } : {}) });
  }
  config(): Promise<Config> {
    return this.result(() => ({ defaultRoot: root, dataDirectory: 'Local substitute index · not a real path', explorerSupported: false,
      drives: [{ root: 'C:\\', total: 512_000_000_000, free: 146_000_000_000 }, { root: 'D:\\', total: 1_000_000_000_000, free: 388_000_000_000 }], monitor: this.monitor }),
    () => ({ defaultRoot: root, dataDirectory: 'Local substitute index · not a real path', explorerSupported: false, drives: [], monitor: this.monitor }));
  }
  status() { return this.result(() => ({ scan: this.current, monitor: this.monitor })); }
  history() { return this.result(() => [...this.scans], () => [...this.scans]); }
  dashboard(scanId: string): Promise<Dashboard> {
    return this.result(() => {
      const scan = this.scans.find((item) => item.id === scanId && item.state === 'completed');
      if (!scan) throw new Error('No completed snapshot. Run a scan first.');
      const old = this.scans.find((item) => item.root === scan.root && item.id !== scan.id && item.state === 'completed') ?? null;
      return makeDashboard(scan, old);
    });
  }
  entries(query: EntryQuery): Promise<EntryPage> {
    return this.result(() => {
      const filtered = filterEntries(files, query.kind as Parameters<typeof filterEntries>[1], query.search, query.category, query.minBytes, query.sort as Parameters<typeof filterEntries>[5]);
      const pageSize = 50;
      return { items: filtered.slice(query.page * pageSize, (query.page + 1) * pageSize), total: filtered.length, bytes: filtered.reduce((sum, entry) => sum + entry.bytes, 0), page: query.page, pageSize };
    }, () => ({ items: [], total: 0, bytes: 0, page: query.page, pageSize: 50 }));
  }
  async start(scanRoot: string): Promise<void> {
    await this.result(() => {
      if (!scanRoot.trim()) throw new Error('Choose a folder before scanning.');
      if (this.current.state === 'scanning') throw new Error('A scan is already running. Cancel it or wait for completion.');
      clearInterval(this.scanTimer);
      this.step = 0;
      const id = `local-scan-${this.sequence++}`;
      this.current = { id, state: 'scanning', root: scanRoot, files: 0, bytes: 0, issues: 0, skippedLinks: 0, currentPath: scanRoot, message: null };
      this.scanTimer = setInterval(() => {
        const paths = ['Projects\\atlas', 'Media\\raw-footage', 'Archives\\2023', 'Photos\\exports', 'Documents\\reports'];
        this.step++;
        if (this.step >= paths.length) {
          clearInterval(this.scanTimer);
          const completed = Math.floor(Date.now() / 1000);
          const scan: Scan = { id, root: scanRoot, started: completed - 4, completed, state: 'completed', files: 18736, bytes: 33_204_000_000, issues: 1, skippedLinks: 2, message: null };
          this.scans = [scan, ...this.scans].slice(0, 50);
          this.current = { id, state: 'completed', root: scanRoot, files: scan.files, bytes: scan.bytes, issues: scan.issues, skippedLinks: scan.skippedLinks, currentPath: null, message: null };
        } else {
          this.current = { ...this.current, files: (this.step + 1) * 3248, bytes: (this.step + 1) * 5_500_000_000, issues: this.step > 2 ? 1 : 0, skippedLinks: this.step > 1 ? 2 : 0, currentPath: `${scanRoot}\\${paths[this.step]}` };
        }
      }, 1100);
    });
  }
  async cancel() {
    await this.result(() => {
      clearInterval(this.scanTimer);
      this.current = { ...this.current, state: 'cancelled', currentPath: null, message: 'Scan cancellation requested.' };
      if (this.current.id) this.scans = [{ ...this.current, started: Math.floor(Date.now() / 1000), completed: Math.floor(Date.now() / 1000) }, ...this.scans].slice(0, 50) as Scan[];
    });
  }
  async setMonitor(settings: MonitorRequest) {
    return this.result(() => {
      this.monitor = { ...settings, nextScan: settings.enabled ? Math.floor(Date.now() / 1000) + settings.intervalMinutes * 60 : null };
      return this.monitor;
    });
  }
  async reveal(_scanId: string, _entryId: number) {
    return this.result(() => 'Substitute mode: no file was opened or changed.');
  }
}
