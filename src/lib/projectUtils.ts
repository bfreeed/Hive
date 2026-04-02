import type { Project } from '../types';

export interface FlatProject {
  project: Project;
  depth: number;
}

/**
 * Returns projects sorted hierarchically — root projects first,
 * with their children directly beneath them, indented by depth.
 */
export function flattenProjects(projects: Project[]): FlatProject[] {
  const roots = projects.filter(p => !p.parentId);
  const result: FlatProject[] = [];

  function addWithChildren(p: Project, depth: number) {
    result.push({ project: p, depth });
    projects.filter(c => c.parentId === p.id).forEach(c => addWithChildren(c, depth + 1));
  }

  roots.forEach(p => addWithChildren(p, 0));

  // Append any orphaned sub-projects that weren't reached
  projects.forEach(p => {
    if (!result.find(r => r.project.id === p.id)) {
      result.push({ project: p, depth: 0 });
    }
  });

  return result;
}
