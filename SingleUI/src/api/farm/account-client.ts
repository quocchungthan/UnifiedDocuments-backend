import { Injectable } from '@angular/core';
import {
  accessKeySchema,
  bandwidthDaySchema,
  createdKeySchema,
  farmSessionSchema,
  type AccessKey,
  type BandwidthDay,
  type FarmSession,
} from '../../contracts/farm-account';
import {
  audienceSchema,
  dashboardSchema,
  type AudienceData,
  type DashboardData,
} from '../../contracts/farm-dashboard';
import { requestJson, requestOk } from '../http/request';

export type UsageRange = 7 | 30 | 90;

export interface FarmAccountApi {
  session(): Promise<FarmSession>;
  dashboard(days: UsageRange): Promise<DashboardData>;
  audience(url: string): Promise<AudienceData>;
  keys(): Promise<AccessKey[]>;
  usage(days: UsageRange): Promise<BandwidthDay[]>;
  createKey(name: string): Promise<{ secret: string }>;
  revokeKey(id: string): Promise<void>;
}

export function validKeyName(name: string) {
  if (!name.trim() || name.length > 100) throw new Error('Key name must contain 1–100 characters.');
  return name.trim();
}

@Injectable({ providedIn: 'root' })
export class FarmAccountClient implements FarmAccountApi {
  session() {
    return requestJson('farm', '/api/me', farmSessionSchema, { credentials: 'same-origin' });
  }
  dashboard(days: UsageRange) {
    return requestJson('farm', `/api/dashboard?days=${days}`, dashboardSchema, {
      credentials: 'same-origin',
    });
  }
  async audience(url: string) {
    const target = new URL(url, location.origin);
    if (target.protocol !== 'https:' && target.origin !== location.origin)
      throw new Error('Audience data requires a secure identity-service URL.');
    return requestJson('identity', target.href, audienceSchema, { credentials: 'include' });
  }
  keys() {
    return requestJson('farm', '/api/memory/keys', accessKeySchema.array(), {
      credentials: 'same-origin',
    });
  }
  usage(days: UsageRange) {
    return requestJson('farm', `/api/memory/usage?days=${days}`, bandwidthDaySchema.array(), {
      credentials: 'same-origin',
    });
  }
  async createKey(name: string) {
    return requestJson('farm', '/api/memory/keys', createdKeySchema, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: validKeyName(name) }),
    });
  }
  async revokeKey(id: string) {
    await requestOk('farm', `/api/memory/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  }
}
