import { describe, expect, it } from 'vitest';
import type { Portfolio } from '../../contracts/farm';
import { displayProjects } from './projects';

describe('displayProjects', () => {
  it('puts featured projects first, retaining profile/display order and every association', () => {
    const portfolio: Portfolio = {
      metadata: null,
      profiles: [],
      socialLinks: [],
      profileSkills: [],
      projectSkills: [],
      gigs: [],
      projects: [1, 2, 3].map((id) => ({ id, title: String(id), slug: String(id), summary: '' })),
      associations: [
        { profileId: 2, projectId: 1, displayOrder: 0, isFeatured: false },
        { profileId: 1, projectId: 1, displayOrder: 2, isFeatured: true },
        { profileId: 1, projectId: 2, displayOrder: 1, isFeatured: false },
      ],
      skills: [],
      experiences: [],
      platforms: [],
      tools: [],
      clicks: [],
    };
    expect(
      displayProjects(portfolio).map((project) => [project.id, project.association?.profileId]),
    ).toEqual([
      [1, 1],
      [2, 1],
      [1, 2],
      [3, undefined],
    ]);
    expect(portfolio.projects).toHaveLength(3);
  });
});
