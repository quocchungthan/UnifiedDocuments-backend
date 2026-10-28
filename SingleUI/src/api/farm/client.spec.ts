import { afterEach, describe, expect, it, vi } from 'vitest';
import { FarmClient } from './client';
import { gigSchema, platformSchema, toolSchema } from '../../contracts/farm';

describe('Farm API console diagnostics', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([429, 503])('keeps HTTP %s and real rate-limit headers visible', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":"rate_limited"}', {
          status,
          statusText: 'Diagnostic response',
          headers: {
            'Content-Type': 'application/json',
            'X-Total-Requests': '443',
            'X-Unique-Clients': '30',
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': '17',
          },
        }),
      ),
    );
    const result = await new FarmClient().probe('/api/metadata');
    expect(result).toMatchObject({
      status,
      statusText: 'Diagnostic response',
      requests: '443',
      clients: '30',
      limit: '60',
      remaining: '0',
      reset: '17',
    });
  });

  it('does not invent missing server counters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    expect(await new FarmClient().probe('/api/feeds')).toMatchObject({
      requests: null,
      clients: null,
      limit: null,
      remaining: null,
      reset: null,
    });
  });

  it('loads native tools without repositories and email feeds without dropping the portfolio', async () => {
    const tools = [
      {
        id: 1,
        name: 'Local tool',
        description: '',
        category: 'ObserveWatching',
        directUrl: 'https://example.com/tool/',
        repositoryUrl: '',
        issueUrl: '',
        displayOrder: 1,
      },
    ];
    const platforms = [
      {
        id: 1,
        platform: 'Email',
        platformId: 'email',
        description: '',
        url: 'mailto:owner@example.invalid',
        color: '',
        displayOrder: 1,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (path: string) =>
          new Response(
            JSON.stringify(
              path === '/api/tools'
                ? tools
                : path === '/api/feeds'
                  ? platforms
                  : path === '/api/metadata'
                    ? { developerName: 'Native owner', title: '', description: '' }
                    : [],
            ),
            { headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    expect(await new FarmClient().load()).toMatchObject({
      tools: [{ repositoryUrl: null, issueUrl: null }],
      platforms: [{ url: 'mailto:owner@example.invalid' }],
      metadata: { developerName: 'Native owner' },
    });
  });

  it('loads persisted gigs with nested steps and skills', async () => {
    const gig = {
      id: 31,
      title: 'Persisted case file',
      slug: 'persisted-case-file',
      category: 'Engineering',
      summary: 'A real API record',
      problem: 'The actual problem',
      outcome: 'The actual outcome',
      solvedOn: '2026-10-20',
      displayOrder: 2,
      steps: [{ id: 41, stepNumber: 1, title: 'Investigate', description: null }],
      skills: [{ id: 51, name: 'TypeScript' }],
    };
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        paths.push(path);
        const body =
          path === '/api/portfolio/gigs'
            ? [gig]
            : path === '/api/metadata'
              ? { developerName: 'Test owner', title: '', description: '' }
              : [];
        return new Response(JSON.stringify(body), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const result = await new FarmClient().load();

    expect(paths).toContain('/api/portfolio/gigs');
    expect(result.gigs).toEqual([gig]);
    expect(gigSchema.array().safeParse(result.gigs).success).toBe(true);
  });

  it('rejects malformed and executable URLs as validation errors, not URL constructor failures', () => {
    const tool = {
      id: 1,
      name: 'Tool',
      description: '',
      category: '',
      directUrl: '',
      repositoryUrl: '',
      displayOrder: 1,
    };
    expect(toolSchema.safeParse(tool).success).toBe(false);
    expect(toolSchema.safeParse({ ...tool, directUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(
      platformSchema.safeParse({
        id: 1,
        platform: 'Unsafe',
        platformId: '',
        description: '',
        url: 'javascript:alert(1)',
        color: '',
        displayOrder: 1,
      }).success,
    ).toBe(false);
  });
});
