import { readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

// Collect all main-session metadata; selection and HTML belong to the caller.
export function listSessions(projectsDirectory) {
  const result = { state: 'complete', sessions: [], skippedProjects: 0, skippedFiles: 0 };
  let projects;
  try {
    projects = readdirSync(projectsDirectory, { withFileTypes: true });
  } catch {
    try {
      if (!lstatSync(projectsDirectory, { throwIfNoEntry: false })) return result;
    } catch { /* An inaccessible root is not an empty source. */ }
    result.state = 'unavailable';
    return result;
  }

  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const projectDirectory = join(projectsDirectory, project.name);
    let files;
    try {
      files = readdirSync(projectDirectory, { withFileTypes: true });
    } catch {
      result.skippedProjects++;
      continue;
    }
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;
      let metadata;
      try {
        metadata = lstatSync(join(projectDirectory, file.name));
      } catch {
        // Diagnose a project loss only after a failed file access, never with a final probe.
        let projectAvailable = false;
        try {
          projectAvailable = lstatSync(projectDirectory, { throwIfNoEntry: false })?.isDirectory() ?? false;
        } catch { /* Preserve the rows obtained before the project became inaccessible. */ }
        if (!projectAvailable) {
          result.skippedProjects++;
          break;
        }
        result.skippedFiles++;
        continue;
      }
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

  if (result.skippedProjects || result.skippedFiles) result.state = 'partial';
  return result;
}
