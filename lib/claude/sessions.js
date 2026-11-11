import { readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

// Collect all main-session metadata; selection and HTML belong to the caller.
export function listSessions(projectsDirectory) {
  const result = { state: 'complete', sessions: [], skippedProjects: 0, skippedFiles: 0 };
  let projects;
  try {
    projects = readdirSync(projectsDirectory, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const projectDirectory = join(projectsDirectory, project.name);
    for (const file of readdirSync(projectDirectory, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;
      const metadata = lstatSync(join(projectDirectory, file.name));
      if (!metadata.isFile()) continue;
      result.sessions.push({
        id: file.name.slice(0, -'.jsonl'.length),
        projectKey: project.name,
        projectPath: project.name.replaceAll('-', '/'),
        sizeBytes: metadata.size,
        mtimeMs: metadata.mtimeMs,
      });
    }
  }

  return result;
}
