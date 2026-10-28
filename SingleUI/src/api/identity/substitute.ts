import type {
  AudienceRange,
  IdentityApp,
  IdentityAudience,
  IdentitySession,
} from '../../contracts/identity';
import type { SourceScenario } from '../../contracts/service-source';
import { scenarioResult } from '../substitution/source';
import { ServiceRequestError } from '../http/request';
import type { IdentityApi } from './client';

const apps: IdentityApp[] = [
  {
    key: 'storage',
    name: 'Storage',
    url: 'https://storage.eldervibe.dev',
    description: 'File and artifact storage.',
  },
  {
    key: 'note',
    name: 'Note',
    url: 'https://note.eldervibe.dev',
    description: 'Daily notes and whiteboard.',
  },
  {
    key: 'mail',
    name: 'Mail',
    url: 'https://mail.eldervibe.dev',
    description: 'Personal mailboxes.',
  },
];
function day(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export class IdentitySubstitute implements IdentityApi {
  constructor(private readonly scenario: SourceScenario) {}
  private result<R>(value: () => R) {
    return scenarioResult('identity', this.scenario, { default: value });
  }
  session(): Promise<IdentitySession> {
    return this.result(() =>
      this.scenario === 'signed-out'
        ? { isAuthenticated: false, brandName: 'Shuneo', loginUrl: '/auth/login', apps: [] }
        : {
            isAuthenticated: true,
            brandName: 'Shuneo',
            name: 'Alex Nguyen',
            email: 'alex@example.com',
            githubLogin: 'alex-nguyen',
            avatarUrl: null,
            hasGithubToken: true,
            apps: this.scenario === 'empty' ? [] : structuredClone(apps),
          },
    );
  }
  apps() {
    return this.result(() => (this.scenario === 'empty' ? [] : structuredClone(apps)));
  }
  audience(clientId: string, days: AudienceRange): Promise<IdentityAudience> {
    if (this.scenario === 'signed-out')
      return Promise.reject(new ServiceRequestError('identity', 401));
    return this.result(() => {
      const empty = this.scenario === 'empty';
      const users = empty
        ? []
        : ['alex-nguyen', 'linh-tran', 'morgan-lee', 'sam-rivera', 'mai-pham', 'jules-chen'].map(
            (username, index) => ({
              subject: `sample:${index}`,
              username,
              firstSeen: day(index < 2 ? index * 2 : 95 - index * 3),
              lastSeen: day(index),
              observedDays: index < 2 ? index + 1 : 12 + index * 7,
              seenInPeriod: index < days,
            }),
          );
      return {
        source: 'fences',
        clientId,
        from: day(days - 1),
        through: day(0),
        totalUsers: users.length,
        newUsers: users.filter((user) => user.firstSeen >= day(days - 1)).length,
        returningUsers: users.filter((user) => user.firstSeen < day(days - 1) && user.seenInPeriod)
          .length,
        growth: users
          .filter((user) => user.firstSeen >= day(days - 1))
          .map((user) => ({ date: user.firstSeen, users: 1 }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        users,
        coverage:
          'Observed app authorizations since tracking was enabled. First seen is not original registration; observed days are not login counts or online presence.',
      };
    });
  }
  repositories() {
    if (this.scenario === 'signed-out')
      return Promise.reject(new ServiceRequestError('identity', 401));
    return this.result(() => {
      const repos =
        this.scenario === 'empty'
          ? []
          : ['workspace-tools', 'daily-notes', 'artifact-pipeline', 'personal-site'].map(
              (name, index) => ({
                id: `sample-${index}`,
                name,
                fullName: `alex-nguyen/${name}`,
                isPrivate: index < 2,
                defaultBranch: 'main',
                htmlUrl: `https://github.com/alex-nguyen/${name}`,
                cloneUrl: null,
                pushedAt: `${day(index + 1)}T09:30:00Z`,
              }),
            );
      return { count: repos.length, repos };
    });
  }
}
