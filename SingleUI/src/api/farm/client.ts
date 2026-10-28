import { Injectable } from '@angular/core';
import {
  associationSchema,
  clickSchema,
  experienceSchema,
  gigSchema,
  metadataSchema,
  profileSchema,
  socialLinkSchema,
  profileSkillSchema,
  projectSkillSchema,
  platformSchema,
  projectSchema,
  skillSchema,
  toolSchema,
  type Portfolio,
  type ProbeResult,
  type Tool,
} from '../../contracts/farm';
import { ServiceUnavailableError, request, requestJson, requestOk } from '../http/request';

export interface FarmPortfolioApi {
  load(): Promise<Portfolio>;
  probe(endpoint: '/api/metadata' | '/api/feeds'): Promise<ProbeResult>;
  visit(platform: string): Promise<void>;
  /** Browser-side reachability of a tool's own URL; not a Farm API call. */
  check(tool: Tool): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class FarmClient implements FarmPortfolioApi {
  async load(): Promise<Portfolio> {
    const [
      projects,
      associations,
      skills,
      experiences,
      platforms,
      tools,
      clicks,
      metadata,
      profiles,
      socialLinks,
      profileSkills,
      projectSkills,
      gigs,
    ] = await Promise.all([
      requestJson('farm', '/api/portfolio/projects', projectSchema.array()),
      requestJson('farm', '/api/portfolio/profile-projects', associationSchema.array()),
      requestJson('farm', '/api/portfolio/skills', skillSchema.array()),
      requestJson('farm', '/api/portfolio/experiences', experienceSchema.array()),
      requestJson('farm', '/api/feeds', platformSchema.array()),
      requestJson('farm', '/api/tools', toolSchema.array()),
      requestJson('farm', '/api/feeds/clicks', clickSchema.array()),
      requestJson('farm', '/api/metadata', metadataSchema),
      requestJson('farm', '/api/portfolio/profiles', profileSchema.array()),
      requestJson('farm', '/api/portfolio/social-links', socialLinkSchema.array()),
      requestJson('farm', '/api/portfolio/profile-skills', profileSkillSchema.array()),
      requestJson('farm', '/api/portfolio/project-skills', projectSkillSchema.array()),
      requestJson('farm', '/api/portfolio/gigs', gigSchema.array()),
    ]);
    return {
      projects,
      associations,
      skills,
      experiences,
      platforms,
      tools,
      clicks,
      metadata,
      profiles,
      socialLinks,
      profileSkills,
      projectSkills,
      gigs,
    };
  }
  async probe(endpoint: '/api/metadata' | '/api/feeds'): Promise<ProbeResult> {
    const response = await request('farm', endpoint, {
      headers: { Accept: 'application/json' },
      allowGatewayResponse: true,
    });
    if (!/\bjson\b/.test(response.headers.get('content-type') ?? ''))
      throw new ServiceUnavailableError('farm', `no JSON API at ${endpoint}`);
    const data: unknown = await response.json();
    const header = (name: string) => response.headers.get(name);
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      at: new Date().toISOString(),
      requests: header('X-Total-Requests'),
      clients: header('X-Unique-Clients'),
      limit: header('X-RateLimit-Limit'),
      remaining: header('X-RateLimit-Remaining'),
      reset: header('X-RateLimit-Reset'),
    };
  }
  async visit(platform: string): Promise<void> {
    await requestOk('farm', `/api/feeds/${encodeURIComponent(platform)}/click`, {
      method: 'POST',
    });
  }
  check(tool: Tool): Promise<void> {
    return checkTool(tool);
  }
}

/** Browser-to-tool health request; it never goes through Farm, so substitutes use it too. */
export async function checkTool(tool: Tool): Promise<void> {
  const response = await fetch(tool.directUrl, {
    method: 'HEAD',
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`Health request: HTTP ${response.status}`);
}
