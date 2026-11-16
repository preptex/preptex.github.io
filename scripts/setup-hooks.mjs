import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Configure Git to use the repository-tracked `.githooks/` directory locally
 * and ensure hook scripts are executable. Safe no-op in CI or non-git copies.
 */
export function setupHooks({ silent = false } = {}) {
  if (process.env.CI === 'true' || process.env.CI === '1') {
    return false;
  }
  if (!existsSync(path.join(websiteRoot, '.git'))) {
    return false;
  }

  const hooksDir = path.join(websiteRoot, '.githooks');
  if (!existsSync(hooksDir)) {
    return false;
  }

  if (process.platform !== 'win32') {
    for (const entry of readdirSync(hooksDir)) {
      const fullPath = path.join(hooksDir, entry);
      chmodSync(fullPath, 0o755);
    }
  }

  let current = '';
  try {
    current = execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], {
      cwd: websiteRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    current = '';
  }

  if (current !== '.githooks') {
    execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
      cwd: websiteRoot,
      stdio: 'ignore',
    });
    if (!silent) {
      console.log('Configured Git hooks path to .githooks');
    }
  }

  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    setupHooks();
  } catch (error) {
    console.warn(`Warning: could not configure .githooks: ${error instanceof Error ? error.message : String(error)}`);
  }
}
