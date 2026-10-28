import { z } from 'zod';
import { parseSourceSelection } from '../../contracts/service-source';
import { ServiceRequestError, ServiceUnavailableError, requestJson } from '../http/request';
import { ServiceSource, scenarioResult } from './source';

interface Api {
  read(): Promise<string>;
}
const answer = (value: string | Error): Api => ({
  read: () => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value)),
});
const auto = parseSourceSelection('');

describe('service substitution', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses selections and rejects unknown or meaningless ones', () => {
    expect(parseSourceSelection('?api=substitute&scenario=signed-out')).toEqual({
      policy: 'substitute',
      scenario: 'signed-out',
    });
    expect(() => parseSourceSelection('?api=demo')).toThrow(/Unknown api policy/);
    expect(() => parseSourceSelection('?scenario=empty')).toThrow(/only with api=substitute/);
  });

  it('falls back for reads only when the live service is unreachable', async () => {
    const source = new ServiceSource(
      'farm',
      answer(new ServiceUnavailableError('farm', 'offline')),
      answer('substitute'),
      auto,
    );
    await expect(source.call((api) => api.read(), { command: true })).rejects.toThrow(
      /unavailable/,
    );
    expect(source.mode()).toBe('live');
    await expect(source.call((api) => api.read())).resolves.toBe('substitute');
    expect([source.mode(), source.reason()]).toEqual(['substitute', 'unavailable']);
  });

  it('never substitutes real server errors, other services or the live policy', async () => {
    const cases: [Error, string][] = [
      [new ServiceRequestError('farm', 401), ''],
      [new ServiceUnavailableError('identity', 'offline'), ''],
      [new ServiceUnavailableError('farm', 'offline'), '?api=live'],
    ];
    for (const [error, search] of cases) {
      const source = new ServiceSource(
        'farm',
        answer(error),
        answer('substitute'),
        parseSourceSelection(search),
      );
      await expect(source.call((api) => api.read())).rejects.toBe(error);
      expect(source.mode()).toBe('live');
    }
  });

  it('shapes failure and loading scenarios', async () => {
    await expect(scenarioResult('mail', 'failure', { default: () => 1 })).rejects.toBeInstanceOf(
      ServiceRequestError,
    );
    const pending = await Promise.race([
      scenarioResult('mail', 'loading', { default: () => 1 }),
      new Promise((done) => setTimeout(() => done('pending'), 20)),
    ]);
    expect(pending).toBe('pending');
    await expect(
      scenarioResult('mail', 'empty', { default: () => 1, empty: () => 0 }),
    ).resolves.toBe(0);
  });

  it('classifies static-host HTML and gateway errors as unavailable', async () => {
    const respond = (body: string, status: number, type: string) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body, { status, headers: { 'content-type': type } })),
      );
    respond('<html>Not found</html>', 404, 'text/html');
    await expect(requestJson('farm', '/api/x', z.unknown())).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    respond('', 503, 'text/plain');
    await expect(requestJson('farm', '/api/x', z.unknown())).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    respond('{"error":"denied"}', 403, 'application/json');
    await expect(requestJson('farm', '/api/x', z.unknown())).rejects.toMatchObject({ status: 403 });
    respond('{"ok":true}', 200, 'application/json; charset=utf-8');
    await expect(requestJson('farm', '/api/x', z.object({ ok: z.boolean() }))).resolves.toEqual({
      ok: true,
    });
  });
});
