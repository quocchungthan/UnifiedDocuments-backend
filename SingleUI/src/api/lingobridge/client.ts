import { Injectable } from '@angular/core';
import { ServiceRequestError, requestJson, requestOk } from '../http/request';
import {
  clientConfigSchema,
  engineInfoSchema,
  jobStatusSchema,
  sessionSchema,
  uploadSchema,
  type ClientConfig,
  type EngineInfo,
  type JobStatus,
  type LanguagePair,
  type Session,
  type Upload,
} from '../../contracts/lingobridge';

export interface LingoBridgeApi {
  config(): Promise<ClientConfig>;
  engine(): Promise<EngineInfo>;
  publicUploads(): Promise<Upload[]>;
  myUploads(): Promise<Upload[]>;
  session(): Promise<Session | null>;
  status(hash: string): Promise<JobStatus>;
  create(file: File, pair: LanguagePair): Promise<Upload>;
  visibility(id: string, isPublic: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  updateProfile(displayName: string): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class LingoBridgeClient implements LingoBridgeApi {
  config() {
    return requestJson('lingobridge', '/api/config', clientConfigSchema);
  }
  engine() {
    return requestJson('lingobridge', '/api/engine', engineInfoSchema);
  }
  publicUploads() {
    return requestJson('lingobridge', '/api/uploads/public', uploadSchema.array());
  }
  myUploads() {
    return requestJson('lingobridge', '/api/uploads/mine', uploadSchema.array());
  }
  async session() {
    try {
      return await requestJson('lingobridge', '/api/auth/me', sessionSchema);
    } catch (error) {
      if (error instanceof ServiceRequestError && error.status === 401) return null;
      throw error;
    }
  }
  status(hash: string) {
    return requestJson(
      'lingobridge',
      `/api/jobs/${encodeURIComponent(hash)}/status`,
      jobStatusSchema,
    );
  }
  create(file: File, pair: LanguagePair) {
    const body = new FormData();
    body.append('file', file);
    body.append('sourceLanguage', pair.source);
    body.append('targetLanguage', pair.target);
    return requestJson('lingobridge', '/api/uploads/', uploadSchema, { method: 'POST', body });
  }
  async visibility(id: string, isPublic: boolean) {
    await requestOk('lingobridge', `/api/uploads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic }),
    });
  }
  async remove(id: string) {
    await requestOk('lingobridge', `/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  async login(email: string, password: string) {
    await requestOk('lingobridge', '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }
  async register(email: string, password: string) {
    await requestOk('lingobridge', '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }
  async logout() {
    await requestOk('lingobridge', '/api/auth/logout', { method: 'POST' });
  }
  async updateProfile(displayName: string) {
    await requestOk('lingobridge', '/api/account/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
  }
}
