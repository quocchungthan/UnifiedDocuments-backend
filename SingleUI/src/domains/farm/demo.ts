import type { Portfolio } from '../../contracts/farm';

export function demoPortfolio(): Portfolio {
  return {
    metadata: null,
    profiles: [],
    socialLinks: [],
    profileSkills: [],
    projectSkills: [],
    gigs: [
      {
        id: 101,
        title: 'Environment variable shadow in deployment pipeline · sample',
        slug: 'environment-variable-shadow-sample',
        category: 'DevOps',
        summary: '',
        problem:
          'Consumer deployments read stale artifact pins when environment-scoped variables shadowed repository variables.',
        outcome:
          'Synced `SINGLE_UI_RUN_ID` and `SINGLE_UI_REVISION` across both repository and environment scopes.',
        solvedOn: '2026-10-24',
        displayOrder: 1,
        steps: [
          {
            id: 1,
            stepNumber: 1,
            title: 'Inspect deployment environment scope',
            description: 'Verified `hostkey-server` shadowed repository variables.',
          },
        ],
        skills: [
          { id: 9, name: 'GitHub Actions' },
          { id: 3, name: 'Contract-first design' },
        ],
      },
    ],
    projects: [
      {
        id: 1,
        title: '30s · Car 3D Models',
        slug: '30s',
        summary: 'An educational workshop for exploring how a car works.',
        sourceUrl: 'https://github.com/quocchungthan/30s',
      },
      {
        id: 2,
        title: 'PARA Bridge',
        slug: 'para',
        summary: 'Agent sessions, assignments and human replies in one mission control.',
        sourceUrl: 'https://github.com/quocchungthan/PARA-AI-solution',
      },
      {
        id: 3,
        title: 'SingleUI',
        slug: 'singleui',
        summary: 'Composable Angular interfaces and portable CSS.',
        sourceUrl: 'https://github.com/quocchungthan/EMFc-experiments',
      },
    ],
    associations: [
      {
        profileId: 1,
        projectId: 1,
        role: 'Demonstration project',
        organization: 'Local sample',
        isFeatured: true,
        displayOrder: 1,
      },
    ],
    experiences: [
      {
        id: 1,
        company: 'Illustrative organization',
        jobTitle: 'Software developer · sample, not employment history',
        description:
          'Demonstrating the original experience-table layout without inventing personal history.',
        startDate: '2025-01-01',
        isCurrent: true,
        displayOrder: 1,
      },
      {
        id: 2,
        company: 'Sample studio',
        jobTitle: 'Frontend engineer · sample',
        description: 'Placeholder row showing how past roles render.',
        startDate: '2022-03-01',
        endDate: '2024-12-01',
        isCurrent: false,
        displayOrder: 2,
      },
    ],
    skills: [
      { id: 1, name: 'Angular', category: 'Frontend' },
      { id: 2, name: 'TypeScript', category: 'Frontend' },
      { id: 3, name: 'Contract-first design', category: 'Engineering' },
      { id: 4, name: 'Three.js', category: 'Frontend' },
      { id: 5, name: 'C# / .NET', category: 'Backend' },
      { id: 6, name: 'PostgreSQL', category: 'Backend' },
      { id: 7, name: 'SQLite', category: 'Backend' },
      { id: 8, name: 'Docker', category: 'DevOps' },
      { id: 9, name: 'GitHub Actions', category: 'DevOps' },
      { id: 10, name: 'Accessibility testing', category: 'Engineering' },
    ],
    platforms: [
      {
        id: 1,
        platform: 'GitHub',
        platformId: 'github',
        description: 'Source repositories',
        url: 'https://github.com/quocchungthan',
        color: '',
        displayOrder: 1,
      },
      {
        id: 2,
        platform: 'YouTube',
        platformId: 'youtube',
        description: 'Build sessions and walkthroughs',
        url: 'https://www.youtube.com/',
        color: '',
        displayOrder: 2,
      },
      {
        id: 3,
        platform: 'LinkedIn',
        platformId: 'linkedin',
        description: 'Professional updates',
        url: 'https://www.linkedin.com/',
        color: '',
        displayOrder: 3,
      },
    ],
    tools: [
      {
        id: 1,
        name: 'PARA Bridge',
        description: 'Agent coordination service',
        category: 'ObserveWatching',
        directUrl: 'https://quocchungthan.github.io/para-bridge/',
        repositoryUrl: 'https://github.com/quocchungthan/PARA-AI-solution',
        displayOrder: 1,
      },
      {
        id: 2,
        name: 'DiskLens',
        description: 'Read-only disk usage scans',
        category: 'SearchCollect',
        directUrl: 'https://quocchungthan.github.io/tools-w-disklens/',
        repositoryUrl: 'https://github.com/quocchungthan/tools-w-disklens',
        displayOrder: 2,
      },
      {
        id: 3,
        name: 'ProductionCore Aids',
        description: 'Service health and production checks',
        category: 'CalculatingAnalysing',
        directUrl: 'https://quocchungthan.github.io/tools-w-productioncore-aids/',
        repositoryUrl: 'https://github.com/quocchungthan/tools-w-productioncore-aids',
        displayOrder: 3,
      },
      {
        id: 4,
        name: 'Exploring Local',
        description: 'Places worth stepping out for',
        category: 'SearchCollect',
        directUrl: 'https://quocchungthan.github.io/tools-s-exploring-local/',
        repositoryUrl: 'https://github.com/quocchungthan/tools-s-exploring-local',
        displayOrder: 4,
      },
    ],
    clicks: sampleClicks(['GitHub', 'YouTube', 'LinkedIn']),
  };
}

/** Deterministic sample visits over the last 14 weeks, so heatmaps have shape. */
export function sampleClicks(platforms: readonly string[], today = new Date()) {
  const clicks: Portfolio['clicks'] = [];
  for (let offset = 0; offset < 98; offset++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    platforms.forEach((platform, index) => {
      const count = (offset * 7 + index * 13 + day.getUTCDay() * 3) % 9;
      if (count > 3)
        clicks.push({ platform, day: day.toISOString().slice(0, 10), count: count - 3 });
    });
  }
  return clicks;
}
