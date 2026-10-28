import { Injectable } from '@angular/core';
import {
  audienceRangeSchema,
  identityAppSchema,
  identityAudienceSchema,
  identityRepositoriesSchema,
  identitySessionSchema,
  type AudienceRange,
  type IdentityApp,
  type IdentityAudience,
  type IdentityRepositories,
  type IdentitySession,
} from '../../contracts/identity';
import { requestJson, serviceUrl } from '../http/request';

export interface IdentityApi {
  session(): Promise<IdentitySession>;
  apps(): Promise<IdentityApp[]>;
  audience(clientId: string, days: AudienceRange): Promise<IdentityAudience>;
  repositories(): Promise<IdentityRepositories>;
}

/** Authentication is a browser navigation, not a fetch/OAuth token exchange. */
export function identityAuthUrl(action: 'login' | 'logout', returnUrl: string): string {
  const url = new URL(serviceUrl('identity', `/auth/${action}`), globalThis.location.href);
  url.searchParams.set('returnUrl', returnUrl);
  return url.href;
}

@Injectable({ providedIn: 'root' })
export class IdentityClient implements IdentityApi {
  session() {
    return requestJson('identity', '/api/session', identitySessionSchema, {
      credentials: 'include',
    });
  }
  apps() {
    return requestJson('identity', '/api/apps', identityAppSchema.array(), {
      credentials: 'include',
    });
  }
  async audience(clientId: string, days: AudienceRange) {
    audienceRangeSchema.parse(days);
    const query = new URLSearchParams({ clientId: clientId.trim(), days: String(days) });
    return requestJson('identity', `/api/audience?${query}`, identityAudienceSchema, {
      credentials: 'include',
    });
  }
  repositories() {
    return requestJson('identity', '/api/github/repos', identityRepositoriesSchema, {
      credentials: 'include',
    });
  }
}
