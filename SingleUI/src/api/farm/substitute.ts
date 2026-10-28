import type { Portfolio, ProbeResult, Tool } from '../../contracts/farm';
import type { AccessKey, BandwidthDay, FarmSession } from '../../contracts/farm-account';
import type { AudienceData, DashboardData, TaskUsage } from '../../contracts/farm-dashboard';
import type { SourceScenario } from '../../contracts/service-source';
import { demoPortfolio } from '../../domains/farm/demo';
import { scenarioResult } from '../substitution/source';
import { validKeyName, type FarmAccountApi, type UsageRange } from './account-client';
import { checkTool, type FarmPortfolioApi } from './client';

const day = (offset: number, today = new Date()) => {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

const emptyPortfolio = (): Portfolio => ({
  metadata: null,
  profiles: [],
  socialLinks: [],
  profileSkills: [],
  projectSkills: [],
  projects: [],
  associations: [],
  skills: [],
  experiences: [],
  platforms: [],
  tools: [],
  clicks: [],
  gigs: [],
});

const signedOut: FarmSession = {
  isAuthenticated: false,
  signInAvailable: true,
  subject: null,
  name: null,
  username: null,
  picture: null,
  email: null,
};

const sampleSession: FarmSession = {
  isAuthenticated: true,
  signInAvailable: true,
  subject: 'sample-owner',
  name: 'Sample Owner',
  username: 'sample-owner',
  picture: null,
  email: 'owner@example.com',
};

const models = ['gpt-5-mini', 'claude-sonnet', 'gpt-5'];
const taskNames = ['Summarize inbox', 'Refactor module', 'Write release notes', 'Review PR'];

function sampleTasks(days: number): TaskUsage[] {
  return Array.from({ length: Math.min(days, 30) * 2 }, (_, index) => {
    const input = 1200 + ((index * 977) % 9000);
    const output = 300 + ((index * 431) % 2400);
    const cost = Number(((input * 0.4 + output * 1.6) / 1_000_000).toFixed(4));
    return {
      id: `sample-${index}`,
      date: day(Math.floor(index / 2)),
      name: taskNames[index % taskNames.length],
      model: models[index % models.length],
      inputTokens: input,
      outputTokens: output,
      durationSeconds: 4 + (index % 37),
      inputBytes: input * 4,
      outputBytes: output * 4,
      costUsd: cost,
      feeUsd: Number((cost * 0.1).toFixed(4)),
      baselineCostUsd: Number((cost * 1.8).toFixed(4)),
    };
  });
}

function sampleBandwidth(days: number): BandwidthDay[] {
  return Array.from({ length: days }, (_, index) => ({
    date: day(days - 1 - index),
    readBytes: 40_000 + ((index * 7919) % 260_000),
    writeBytes: 8_000 + ((index * 3571) % 90_000),
  }));
}

/**
 * Same contract as the Farm service, answered in this browser. Keys created here
 * are local samples; secrets are visibly marked and never reach a server.
 */
export class FarmSubstitute implements FarmPortfolioApi, FarmAccountApi {
  private localKeys: AccessKey[];
  private next = 1;
  constructor(private readonly scenario: SourceScenario) {
    this.localKeys =
      scenario === 'empty'
        ? []
        : [
            {
              id: 'sample-laptop',
              name: 'Laptop agent',
              preview: 'evk_…4f2a',
              createdAt: `${day(41)}T09:12:00Z`,
              lastUsedAt: `${day(0)}T07:45:00Z`,
            },
            {
              id: 'sample-ci',
              name: 'CI pipeline',
              preview: 'evk_…91c0',
              createdAt: `${day(12)}T15:30:00Z`,
              lastUsedAt: null,
            },
          ];
  }
  private result<R>(value: () => R, variants: { 'signed-out'?: () => R; empty?: () => R } = {}) {
    return scenarioResult('farm', this.scenario, { default: value, ...variants });
  }
  load() {
    return this.result(demoPortfolio, { empty: emptyPortfolio });
  }
  probe(endpoint: '/api/metadata' | '/api/feeds'): Promise<ProbeResult> {
    return this.result(() => ({
      data:
        endpoint === '/api/metadata'
          ? { name: 'Farm', source: 'substitute', persistent: false }
          : demoPortfolio().platforms,
      status: 200,
      statusText: 'Substitute · no HTTP request',
      at: new Date().toISOString(),
      requests: null,
      clients: null,
      limit: null,
      remaining: null,
      reset: null,
    }));
  }
  visit() {
    return this.result(() => undefined);
  }
  check(tool: Tool) {
    return checkTool(tool);
  }
  session() {
    return this.result(() => sampleSession, { 'signed-out': () => signedOut });
  }
  dashboard(days: UsageRange): Promise<DashboardData> {
    return this.result(() => ({
      source: 'demo' as const,
      currency: 'USD' as const,
      days,
      from: day(days - 1),
      through: day(0),
      isOwner: true,
      tasks: this.scenario === 'empty' ? [] : sampleTasks(days),
      audience: { source: 'fences' as const, url: 'https://identity.example/api/audience' },
    }));
  }
  audience(): Promise<AudienceData> {
    return this.result(() => ({
      source: 'fences' as const,
      totalUsers: 128,
      newUsers: 17,
      returningUsers: 64,
      growth: Array.from({ length: 30 }, (_, index) => ({
        date: day(29 - index),
        users: 90 + Math.round(index * 1.3 + ((index * 7) % 5)),
      })),
      users: ['minh', 'lan', 'hoa', 'tuan', 'an'].map((name, index) => ({
        subject: `sample-${name}`,
        username: name,
        firstSeen: `${day(60 - index * 9)}T08:00:00Z`,
        lastSeen: `${day(index)}T18:00:00Z`,
        observedDays: 20 - index * 3,
      })),
      coverage: 'Sample audience · substitute data',
    }));
  }
  keys() {
    return this.result(() => [...this.localKeys]);
  }
  usage(days: UsageRange) {
    return this.result(() => sampleBandwidth(days), { empty: () => [] });
  }
  createKey(name: string) {
    const trimmed = validKeyName(name);
    return this.result(() => {
      const id = `local-${this.next++}`;
      this.localKeys = [
        ...this.localKeys,
        {
          id,
          name: trimmed,
          preview: 'local…',
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
      ];
      return { secret: `local-sample-${id}-not-a-real-key` };
    });
  }
  revokeKey(id: string) {
    return this.result(() => {
      this.localKeys = this.localKeys.filter((key) => key.id !== id);
    });
  }
}
