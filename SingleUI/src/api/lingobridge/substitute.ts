import { ServiceRequestError } from '../http/request';
import { scenarioResult } from '../substitution/source';
import type { SourceScenario } from '../../contracts/service-source';
import type { EngineInfo, JobStatus, LanguagePair, Session, Upload } from '../../contracts/lingobridge';
import type { LingoBridgeApi } from './client';

const now = () => new Date().toISOString();
const fixtures: Upload[] = [
  { id: 'demo-01', hash: '7b9f848b3d24e8a3c17f0b1e8f64c7a2276c8f19a04d3bb2d62a5c5e19f2a410', fileName: 'Vietnamese literature review.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-19T08:30:00Z' },
  { id: 'demo-02', hash: '1a82cf14b5207d2e709b246a2f771e8d9b70a46ca6201f3d4f82b5a739d61c0e', fileName: 'Research methods and field notes.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: false, createdAtUtc: '2026-10-18T14:15:00Z' },
  { id: 'demo-03', hash: '49c2301ab5d73a0104ff8d8cda9f31e0870a4dcf95b65e2318c4b71f0b53a22d', fileName: 'Community health policy.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-15T09:05:00Z' },
  { id: 'demo-04', hash: 'b0b511a5a6908e3cc2327c793e8bd8e61f4b5881388b6c34e43fd00708c6f174', fileName: 'Climate adaptation field guide.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-14T11:20:00Z' },
  { id: 'demo-05', hash: 'c152e07c3b771fd3159067297ac8c9444f49e15a9367b1fd8b7eeb08924c219a', fileName: 'Urban mobility survey results.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-13T16:45:00Z' },
  { id: 'demo-06', hash: 'd967c146236e9bba10bcfd64a2a5d8cc3ab66b2c56bed0565502f7eac5de870a', fileName: 'Vietnamese culinary heritage.pdf', sourceLanguage: 'en', targetLanguage: 'vi', isPublic: true, createdAtUtc: '2026-10-11T07:10:00Z' },
];
const makeJob = (upload: Upload, state: JobStatus['state'], completed: number, stage: string | null): JobStatus => ({
  state,
  fileName: upload.fileName,
  sizeBytes: 2_480_000,
  queuePosition: state === 'Queued' ? 2 : null,
  stage,
  chunksCompleted: completed,
  chunksTotal: 12,
  message: null,
  resultAvailable: state === 'Completed',
  createdAt: upload.createdAtUtc,
  startedAt: state === 'Queued' ? null : upload.createdAtUtc,
  completedAt: state === 'Completed' ? now() : null,
});

export class LingoBridgeSubstitute implements LingoBridgeApi {
  private uploads = fixtures.map((item) => ({ ...item }));
  private me: Session | null;
  private readonly statuses = new Map<string, JobStatus>();

  constructor(private readonly scenario: SourceScenario) {
    this.me = scenario === 'signed-out' ? null : { email: 'alex.nguyen@example.test', roles: ['User'], displayName: 'Alex Nguyen' };
    this.statuses.set(fixtures[0].hash, makeJob(fixtures[0], 'Completed', 12, null));
    this.statuses.set(fixtures[1].hash, makeJob(fixtures[1], 'Running', 7, 'Translate'));
    this.statuses.set(fixtures[2].hash, makeJob(fixtures[2], 'Completed', 12, null));
    this.statuses.set(fixtures[3].hash, makeJob(fixtures[3], 'Running', 5, 'Translate'));
    this.statuses.set(fixtures[4].hash, makeJob(fixtures[4], 'Queued', 0, null));
    this.statuses.set(fixtures[5].hash, makeJob(fixtures[5], 'Completed', 12, null));
  }

  private read<T>(fallback: () => T, empty: () => T = fallback) {
    return scenarioResult('lingobridge', this.scenario, {
      default: fallback,
      empty,
      'signed-out': fallback,
    });
  }
  config() {
    return this.read(() => ({ maxSizeBytes: 20 * 1024 * 1024, accept: ['.pdf', 'application/pdf'], languagePairs: [{ source: 'en', target: 'vi' }] }));
  }
  engine(): Promise<EngineInfo> {
    return this.read(() => ({ queued: 2, running: 1 }));
  }
  publicUploads() {
    return this.read(
      () => this.uploads.filter((item) => item.isPublic).map((item) => ({ ...item })),
      () => [],
    );
  }
  myUploads() {
    if (!this.me) return Promise.reject(new ServiceRequestError('lingobridge', 401, 'sign in required'));
    return this.read(
      () => this.uploads.map((item) => ({ ...item })),
      () => [],
    );
  }
  session() {
    return scenarioResult('lingobridge', this.scenario, {
      default: () => this.me && { ...this.me },
      empty: () => this.me && { ...this.me },
      'signed-out': () => this.me && { ...this.me },
    });
  }
  status(hash: string) {
    return this.read(() => {
      const status = this.statuses.get(hash);
      if (!status) throw new ServiceRequestError('lingobridge', 404, 'file not found');
      return { ...status };
    });
  }
  private async writable() {
    await scenarioResult('lingobridge', this.scenario, { default: () => undefined });
  }
  async create(file: File, pair: LanguagePair) {
    await this.writable();
    if (!this.me) throw new ServiceRequestError('lingobridge', 401, 'sign in required');
    const upload: Upload = {
      id: `local-${Date.now()}`,
      hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join(''),
      fileName: file.name,
      sourceLanguage: pair.source,
      targetLanguage: pair.target,
      isPublic: false,
      createdAtUtc: now(),
    };
    this.uploads = [upload, ...this.uploads];
    this.statuses.set(upload.hash, makeJob(upload, 'Queued', 0, null));
    return upload;
  }
  async visibility(id: string, isPublic: boolean) {
    await this.writable();
    this.uploads = this.uploads.map((item) => (item.id === id ? { ...item, isPublic } : item));
  }
  async remove(id: string) {
    await this.writable();
    this.uploads = this.uploads.filter((item) => item.id !== id);
  }
  async login(email: string) {
    await this.writable();
    this.me = { email, roles: ['User'], displayName: null };
  }
  async register(email: string) {
    await this.writable();
    this.me = { email, roles: ['User'], displayName: null };
  }
  async logout() {
    await this.writable();
    this.me = null;
  }
  async updateProfile(displayName: string) {
    await this.writable();
    if (!this.me) throw new ServiceRequestError('lingobridge', 401, 'sign in required');
    this.me = { ...this.me, displayName: displayName || null };
  }
}
