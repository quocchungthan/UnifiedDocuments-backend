import type { z } from 'zod';

/**
 * Origins of every backend in one place. '' means same origin as the static
 * front end. Cross-origin services need CORS for that front end (issue #2).
 */
export const serviceOrigins = {
  farm: '',
  chess: '',
  mail: '',
  identity: '',
  bridge: 'http://localhost:5310',
  car: 'http://localhost:5311',
  unifiedDocuments: '',
  disklens: 'http://127.0.0.1:5274',
  productioncore: 'http://localhost:5311',
  exploring: 'http://localhost:5312',
  lingobridge: '',
} as const;
export type ServiceName = keyof typeof serviceOrigins;

/** The service could not be reached or no API answered: a substitute may stand in. */
export class ServiceUnavailableError extends Error {
  constructor(
    readonly service: ServiceName,
    detail: string,
  ) {
    super(`${service} service unavailable: ${detail}`);
  }
}

/** The service answered with an error. This is real state; never substituted. */
export class ServiceRequestError extends Error {
  constructor(
    readonly service: ServiceName,
    readonly status: number,
    readonly detail = '',
  ) {
    super(`${service} request failed (HTTP ${status})${detail ? `: ${detail}` : ''}`);
  }
}

export function serviceUrl(service: ServiceName, path: string) {
  return /^https?:\/\//.test(path) ? path : `${serviceOrigins[service]}${path}`;
}

export interface ServiceRequest extends RequestInit {
  timeout?: number;
  /** Diagnostic consoles inspect a gateway response instead of substituting it. */
  allowGatewayResponse?: boolean;
}

const gatewayFailures = new Set([502, 503, 504]);

/** Fetch with timeout and availability classification. Callers own parsing. */
export async function request(
  service: ServiceName,
  path: string,
  { timeout = 10000, allowGatewayResponse = false, ...init }: ServiceRequest = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(serviceUrl(service, path), {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeout),
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ServiceUnavailableError(service, String(error));
  }
  if (!allowGatewayResponse && gatewayFailures.has(response.status))
    throw new ServiceUnavailableError(service, `HTTP ${response.status}`);
  return response;
}

function isJson(response: Response) {
  return /\bjson\b/.test(response.headers.get('content-type') ?? '');
}

/**
 * Request JSON validated by a schema. A non-JSON answer (a static host's 404 page
 * or SPA fallback) means no API is deployed there, so it counts as unavailable.
 */
export async function requestJson<T>(
  service: ServiceName,
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init: ServiceRequest = {},
): Promise<T> {
  const response = await request(service, path, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  });
  if (!isJson(response)) {
    if (response.ok || response.status === 404)
      throw new ServiceUnavailableError(service, `no JSON API at ${path}`);
    throw new ServiceRequestError(service, response.status);
  }
  const body: unknown = await response.json();
  if (!response.ok) throw new ServiceRequestError(service, response.status, JSON.stringify(body));
  return schema.parse(body);
}

/** For commands without a response body. */
export async function requestOk(service: ServiceName, path: string, init: ServiceRequest = {}) {
  const response = await request(service, path, init);
  if (!response.ok) {
    if (response.status === 404 && !isJson(response))
      throw new ServiceUnavailableError(service, `no API at ${path}`);
    throw new ServiceRequestError(service, response.status, await response.text());
  }
  return response;
}
