import { IdentityClient, identityAuthUrl } from './client';
import { IdentitySubstitute } from './substitute';
import {
  identitySessionSchema,
  identityAudienceSchema,
  identityRepositoriesSchema,
} from '../../contracts/identity';
import { ServiceRequestError } from '../http/request';

describe('identity API boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses the current host and cookie credentials for every endpoint', async () => {
    const sample = new IdentitySubstitute('default');
    const replies = [
      await sample.session(),
      await sample.apps(),
      await sample.audience('a/b', 7),
      await sample.repositories(),
    ];
    const fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(replies.shift()), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const api = new IdentityClient();
    await api.session();
    await api.apps();
    await api.audience(' a/b ', 7);
    await api.repositories();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/session',
      '/api/apps',
      '/api/audience?clientId=a%2Fb&days=7',
      '/api/github/repos',
    ]);
    for (const [, init] of fetch.mock.calls) expect(init.credentials).toBe('include');
    await expect(api.audience('x', 8 as 7)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it('keeps permission denials as real errors even for empty non-JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(new IdentityClient().audience('farm-web', 30)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('constructs full-page auth URLs with an exact encoded return location', () => {
    const location = 'https://ui.example/?api=live&clientId=a#hub';
    for (const action of ['login', 'logout'] as const) {
      const url = new URL(identityAuthUrl(action, location));
      expect(url.origin).toBe(globalThis.location.origin);
      expect(url.pathname).toBe(`/auth/${action}`);
      expect(url.searchParams.get('returnUrl')).toBe(location);
    }
  });
  it('validates substitute owner, signed-out, empty and failure states against real contracts', async () => {
    for (const scenario of ['default', 'empty', 'signed-out'] as const) {
      const api = new IdentitySubstitute(scenario);
      const session = identitySessionSchema.parse(await api.session());
      if (scenario === 'signed-out') {
        expect(session.isAuthenticated).toBe(false);
        await expect(api.audience('x', 30)).rejects.toMatchObject({ status: 401 });
      } else {
        expect(session.isAuthenticated).toBe(true);
        const audience = identityAudienceSchema.parse(await api.audience('x', 30));
        expect(audience.totalUsers).toBe(audience.users.length);
        expect(identityRepositoriesSchema.parse(await api.repositories()).count).toBe(
          scenario === 'empty' ? 0 : 4,
        );
        if (scenario === 'empty') expect(session.apps).toEqual([]);
      }
    }
    await expect(new IdentitySubstitute('failure').session()).rejects.toBeInstanceOf(
      ServiceRequestError,
    );
  });
  it('rejects unsafe service destinations', async () => {
    const session = await new IdentitySubstitute('default').session();
    expect(() =>
      identitySessionSchema.parse({
        ...session,
        apps: [{ key: 'bad', name: 'bad', description: '', url: 'javascript:alert(1)' }],
      }),
    ).toThrow();
  });
  it('retains configured branding in both session variants and accepts older servers', async () => {
    for (const scenario of ['default', 'signed-out'] as const) {
      const session = await new IdentitySubstitute(scenario).session();
      expect(identitySessionSchema.parse({ ...session, brandName: ' ElderVibe ' }).brandName).toBe(
        'ElderVibe',
      );
      const { brandName, ...legacy } = session;
      expect(identitySessionSchema.parse(legacy).brandName).toBeUndefined();
      expect(() => identitySessionSchema.parse({ ...session, brandName: ' ' })).toThrow();
    }
  });
});
