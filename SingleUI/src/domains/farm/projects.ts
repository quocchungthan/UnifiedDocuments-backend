import type { Portfolio, ProfileProject, Project } from '../../contracts/farm';

type DisplayProject = Project & { association: ProfileProject | undefined };

export function displayProjects(portfolio: Portfolio) {
  return portfolio.projects
    .flatMap<DisplayProject>((project) => {
      const associations = portfolio.associations.filter((link) => link.projectId === project.id);
      return associations.length
        ? associations.map((association) => ({ ...project, association }))
        : [{ ...project, association: undefined }];
    })
    .sort(
      (a, b) =>
        Number(b.association?.isFeatured ?? false) - Number(a.association?.isFeatured ?? false) ||
        (a.association?.profileId ?? 999) - (b.association?.profileId ?? 999) ||
        (a.association?.displayOrder ?? 999) - (b.association?.displayOrder ?? 999),
    );
}
