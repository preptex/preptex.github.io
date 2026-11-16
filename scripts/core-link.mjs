import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupHooks } from './setup-hooks.mjs';

const TARGET_PACKAGE = '@preptex/core';
const STATE_FILENAME = '.local-core-state.json';
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'overrides'];

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(websiteRoot, STATE_FILENAME);

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readJsonFile(filePath) {
  return parseJson(readFileSync(filePath, 'utf8'), filePath);
}

function writeJsonFile(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function isNonRegistrySpecifier(spec) {
  if (typeof spec !== 'string') return true;
  const trimmed = spec.trim();
  if (!trimmed) return true;
  return (
    /^(file:|link:|portal:|workspace:|git\+|git:|github:|https?:|npm:|\.{0,2}[/\\])/i.test(trimmed) ||
    /[\\/]/.test(trimmed)
  );
}

function runCommand(cmd, args, cwd, { capture = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = capture && result.stderr ? `\n${result.stderr.trim()}` : '';
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}${details}`);
  }
  return result.stdout ?? '';
}

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && npmCli.endsWith('.js')) {
    runCommand(process.execPath, [npmCli, ...args], cwd);
    return;
  }
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  runCommand(npmBin, args, cwd);
}

function gitShow(revAndPath) {
  try {
    return execFileSync('git', ['show', revAndPath], {
      cwd: websiteRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function resolveCorePaths(coreDirArg) {
  const rawDir = coreDirArg || process.env.PREPTEX_CORE_DIR || path.resolve(websiteRoot, '../core');
  const candidate = path.resolve(websiteRoot, rawDir);

  if (!existsSync(candidate)) {
    throw new Error(
      `Core directory not found at "${candidate}". Pass --core-dir <path> or set PREPTEX_CORE_DIR.`
    );
  }

  const directManifestPath = path.join(candidate, 'package.json');
  if (existsSync(directManifestPath)) {
    const directManifest = readJsonFile(directManifestPath);
    if (directManifest.name === TARGET_PACKAGE) {
      return { coreRepoDir: candidate, corePkgDir: candidate };
    }
  }

  const workspacePkgDir = path.join(candidate, 'core');
  const workspaceManifestPath = path.join(workspacePkgDir, 'package.json');
  if (existsSync(workspaceManifestPath)) {
    const workspaceManifest = readJsonFile(workspaceManifestPath);
    if (workspaceManifest.name === TARGET_PACKAGE) {
      return { coreRepoDir: candidate, corePkgDir: workspacePkgDir };
    }
  }

  throw new Error(
    `Could not find ${TARGET_PACKAGE}/package.json inside "${candidate}" or "${workspacePkgDir}".`
  );
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--no-build') {
      flags.noBuild = true;
    } else if (arg === '--staged') {
      flags.staged = true;
    } else if (arg === '--index') {
      flags.index = true;
    } else if (arg === '--pre-push') {
      flags.prePush = true;
    } else if (arg === '--core-dir' && i + 1 < args.length) {
      flags.coreDir = args[++i];
    } else if (arg.startsWith('--core-dir=')) {
      flags.coreDir = arg.slice('--core-dir='.length);
    } else if (arg === '--version' && i + 1 < args.length) {
      flags.version = args[++i];
    } else if (arg.startsWith('--version=')) {
      flags.version = arg.slice('--version='.length);
    } else if (arg === '--ref' && i + 1 < args.length) {
      flags.ref = args[++i];
    } else if (arg.startsWith('--ref=')) {
      flags.ref = arg.slice('--ref='.length);
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function buildCore(coreDirArg) {
  const { coreRepoDir, corePkgDir } = resolveCorePaths(coreDirArg);
  const pkgManifest = readJsonFile(path.join(corePkgDir, 'package.json'));
  const hasPrepack = Boolean(pkgManifest.scripts?.prepack);
  const scriptName = hasPrepack ? 'prepack' : 'build';

  console.log(`Building ${TARGET_PACKAGE} in ${corePkgDir} (npm run ${scriptName})...`);
  if (coreRepoDir !== corePkgDir) {
    runNpm(['run', scriptName, `--workspace=${TARGET_PACKAGE}`], coreRepoDir);
  } else {
    runNpm(['run', scriptName], corePkgDir);
  }

  const distEntry = path.join(corePkgDir, 'dist/index.js');
  const distTypes = path.join(corePkgDir, 'dist/index.d.ts');
  if (!existsSync(distEntry) || !existsSync(distTypes)) {
    throw new Error(`Expected build artifacts missing in ${path.join(corePkgDir, 'dist')}.`);
  }

  return { coreRepoDir, corePkgDir, version: pkgManifest.version };
}

function validateManifest(manifest, sourceLabel) {
  const issues = [];
  for (const section of DEP_SECTIONS) {
    const spec = manifest?.[section]?.[TARGET_PACKAGE];
    if (spec !== undefined && isNonRegistrySpecifier(spec)) {
      issues.push(`${sourceLabel}: ${section}["${TARGET_PACKAGE}"] is "${spec}" (local/non-registry).`);
    }
  }
  return issues;
}

function validateLockfile(lock, sourceLabel) {
  const issues = [];
  if (!lock || typeof lock !== 'object') {
    return issues;
  }

  const rootPkg = lock.packages?.[''];
  if (rootPkg) {
    issues.push(...validateManifest(rootPkg, `${sourceLabel} (packages[""])`));
  }

  const legacyDep = lock.dependencies?.[TARGET_PACKAGE];
  if (legacyDep && typeof legacyDep.version === 'string' && isNonRegistrySpecifier(legacyDep.version)) {
    issues.push(`${sourceLabel}: dependencies["${TARGET_PACKAGE}"].version is "${legacyDep.version}".`);
  }

  for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
    if (!meta || typeof meta !== 'object') continue;
    const isCoreEntry = pkgPath === `node_modules/${TARGET_PACKAGE}` || meta.name === TARGET_PACKAGE;
    if (!isCoreEntry) continue;

    if (meta.link === true) {
      issues.push(`${sourceLabel}: packages["${pkgPath}"] has "link": true.`);
    }
    if (pkgPath.startsWith('..') || pkgPath.startsWith('file:')) {
      issues.push(`${sourceLabel}: packages["${pkgPath}"] references an outside local path.`);
    }
    if (typeof meta.resolved === 'string' && !/^https?:\/\//i.test(meta.resolved)) {
      issues.push(`${sourceLabel}: packages["${pkgPath}"].resolved is "${meta.resolved}".`);
    }
  }

  return issues;
}

function checkSources({ manifestRaw, lockRaw, manifestLabel, lockLabel }) {
  const issues = [];
  if (manifestRaw !== null) {
    issues.push(...validateManifest(parseJson(manifestRaw, manifestLabel), manifestLabel));
  }
  if (lockRaw !== null) {
    issues.push(...validateLockfile(parseJson(lockRaw, lockLabel), lockLabel));
  }
  return issues;
}

function failWithIssues(issues, contextHint) {
  console.error(`\n[preptex] Refusing ${contextHint}: ${TARGET_PACKAGE} is locally linked.\n`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  console.error('\nRun `npm run core:unlink` before committing/pushing/merging manifest or lockfile changes.\n');
  process.exit(1);
}

function handleCheck(flags) {
  if (flags.staged) {
    const stagedFiles = new Set(
      runCommand('git', ['diff', '--cached', '--name-only'], websiteRoot, { capture: true })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
    const checkManifest = stagedFiles.has('package.json');
    const checkLock = stagedFiles.has('package-lock.json');
    if (!checkManifest && !checkLock) {
      return;
    }
    const issues = checkSources({
      manifestRaw: checkManifest ? gitShow(':package.json') : null,
      lockRaw: checkLock ? gitShow(':package-lock.json') : null,
      manifestLabel: 'staged package.json',
      lockLabel: 'staged package-lock.json',
    });
    if (issues.length > 0) {
      failWithIssues(issues, 'commit');
    }
    return;
  }

  if (flags.index) {
    const issues = checkSources({
      manifestRaw: gitShow(':package.json'),
      lockRaw: gitShow(':package-lock.json'),
      manifestLabel: 'index package.json',
      lockLabel: 'index package-lock.json',
    });
    if (issues.length > 0) {
      failWithIssues(issues, 'merge commit');
    }
    return;
  }

  if (flags.prePush) {
    const stdin = readFileSync(0, 'utf8').trim();
    if (!stdin) return;
    const zeroOid = /^0+$/;
    const issues = [];
    for (const line of stdin.split(/\r?\n/)) {
      const [localRef, localOid] = line.trim().split(/\s+/);
      if (!localOid || zeroOid.test(localOid)) continue;
      issues.push(
        ...checkSources({
          manifestRaw: gitShow(`${localOid}:package.json`),
          lockRaw: gitShow(`${localOid}:package-lock.json`),
          manifestLabel: `${localRef} package.json`,
          lockLabel: `${localRef} package-lock.json`,
        })
      );
    }
    if (issues.length > 0) {
      failWithIssues(issues, 'push');
    }
    return;
  }

  if (flags.ref) {
    const issues = checkSources({
      manifestRaw: gitShow(`${flags.ref}:package.json`),
      lockRaw: gitShow(`${flags.ref}:package-lock.json`),
      manifestLabel: `${flags.ref}:package.json`,
      lockLabel: `${flags.ref}:package-lock.json`,
    });
    if (issues.length > 0) {
      failWithIssues(issues, `ref ${flags.ref}`);
    }
    return;
  }

  const manifestPath = path.join(websiteRoot, 'package.json');
  const lockPath = path.join(websiteRoot, 'package-lock.json');
  const issues = checkSources({
    manifestRaw: existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null,
    lockRaw: existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null,
    manifestLabel: 'package.json',
    lockLabel: 'package-lock.json',
  });
  if (issues.length > 0) {
    failWithIssues(issues, 'non-registry dependency check');
  }
  console.log(`OK: ${TARGET_PACKAGE} is linked to an npm registry version.`);
}

function getCoreGitSummary(coreRepoDir) {
  try {
    const branch = runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], coreRepoDir, {
      capture: true,
    }).trim();
    const sha = runCommand('git', ['rev-parse', '--short', 'HEAD'], coreRepoDir, {
      capture: true,
    }).trim();
    const dirty = runCommand('git', ['status', '--porcelain'], coreRepoDir, {
      capture: true,
    }).trim();
    return `${branch}@${sha}${dirty ? ' (dirty working tree)' : ''}`;
  } catch {
    return 'unknown git state';
  }
}

function resolvePreviousVersion() {
  if (existsSync(statePath)) {
    const state = readJsonFile(statePath);
    if (typeof state.previousVersion === 'string' && !isNonRegistrySpecifier(state.previousVersion)) {
      return state.previousVersion;
    }
  }
  const headManifestRaw = gitShow('HEAD:package.json');
  if (headManifestRaw) {
    const headManifest = parseJson(headManifestRaw, 'HEAD:package.json');
    const headSpec = headManifest.dependencies?.[TARGET_PACKAGE];
    if (typeof headSpec === 'string' && !isNonRegistrySpecifier(headSpec)) {
      return headSpec;
    }
  }
  return null;
}

function handleLink(flags) {
  setupHooks();
  const { coreRepoDir, corePkgDir, version } = flags.noBuild
    ? { ...resolveCorePaths(flags.coreDir), version: readJsonFile(path.join(resolveCorePaths(flags.coreDir).corePkgDir, 'package.json')).version }
    : buildCore(flags.coreDir);

  const manifestPath = path.join(websiteRoot, 'package.json');
  const manifest = readJsonFile(manifestPath);
  const currentSpec = manifest.dependencies?.[TARGET_PACKAGE];

  if (typeof currentSpec === 'string' && !isNonRegistrySpecifier(currentSpec)) {
    writeJsonFile(statePath, {
      previousVersion: currentSpec,
      corePackageDir: corePkgDir,
      linkedAt: new Date().toISOString(),
    });
  } else if (!existsSync(statePath)) {
    const fallback = resolvePreviousVersion();
    if (fallback) {
      writeJsonFile(statePath, {
        previousVersion: fallback,
        corePackageDir: corePkgDir,
        linkedAt: new Date().toISOString(),
      });
    }
  }

  const relPosix = path.relative(websiteRoot, corePkgDir).split(path.sep).join('/');
  const localSpec = `file:${relPosix.startsWith('.') ? relPosix : `./${relPosix}`}`;

  manifest.dependencies = manifest.dependencies ?? {};
  manifest.dependencies[TARGET_PACKAGE] = localSpec;
  writeJsonFile(manifestPath, manifest);

  console.log(`Installing local link ${TARGET_PACKAGE} -> ${localSpec}...`);
  runNpm(['install'], websiteRoot);

  console.log('');
  console.log(`Linked ${TARGET_PACKAGE} (${version}) -> ${localSpec}`);
  console.log(`Core checkout: ${getCoreGitSummary(coreRepoDir)}`);
  console.log('Safeguards active: package.json / package-lock.json cannot be committed, pushed, or merged while linked.');
  console.log('To rebuild core after edits: npm run core:build');
  console.log('To restore npm dependency:   npm run core:unlink');
}

function handleUnlink(flags) {
  const explicitVersion = flags.version || flags._[0];
  const targetVersion = explicitVersion || resolvePreviousVersion();
  if (!targetVersion) {
    throw new Error(
      `Could not determine npm version to restore for ${TARGET_PACKAGE}. Pass --version <semver> (e.g. npm run core:unlink -- --version 0.4.1).`
    );
  }
  if (isNonRegistrySpecifier(targetVersion)) {
    throw new Error(`Refusing to unlink to non-registry specifier "${targetVersion}".`);
  }

  const manifestPath = path.join(websiteRoot, 'package.json');
  const manifest = readJsonFile(manifestPath);
  manifest.dependencies = manifest.dependencies ?? {};
  manifest.dependencies[TARGET_PACKAGE] = targetVersion;
  writeJsonFile(manifestPath, manifest);

  const installedModule = path.join(websiteRoot, 'node_modules', ...TARGET_PACKAGE.split('/'));
  // Remove symlinked/local package first so npm does not treat matching semver as up-to-date.
  rmSync(installedModule, { recursive: true, force: true });

  console.log(`Restoring ${TARGET_PACKAGE}@${targetVersion} from npm...`);
  runNpm(['install', `${TARGET_PACKAGE}@${targetVersion}`, '--save-exact'], websiteRoot);

  const lockPath = path.join(websiteRoot, 'package-lock.json');
  const postIssues = checkSources({
    manifestRaw: readFileSync(manifestPath, 'utf8'),
    lockRaw: existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null,
    manifestLabel: 'package.json',
    lockLabel: 'package-lock.json',
  });
  if (postIssues.length > 0) {
    throw new Error(`Unlink completed but non-registry references remain:\n${postIssues.join('\n')}`);
  }

  if (existsSync(statePath)) {
    rmSync(statePath, { force: true });
  }

  console.log(`Unlinked: ${TARGET_PACKAGE} is now ${targetVersion} from npm.`);
}

function handleStatus() {
  const manifest = readJsonFile(path.join(websiteRoot, 'package.json'));
  const spec = manifest.dependencies?.[TARGET_PACKAGE];
  const lockPath = path.join(websiteRoot, 'package-lock.json');
  const lock = existsSync(lockPath) ? readJsonFile(lockPath) : null;
  const lockEntry = lock?.packages?.[`node_modules/${TARGET_PACKAGE}`];
  const installedModule = path.join(websiteRoot, 'node_modules', ...TARGET_PACKAGE.split('/'));

  let installKind = 'not installed';
  try {
    const stat = lstatSync(installedModule);
    if (stat.isSymbolicLink()) {
      installKind = `symlink -> ${readlinkSync(installedModule)}`;
    } else {
      const installedPkg = path.join(installedModule, 'package.json');
      const installedVer = existsSync(installedPkg) ? readJsonFile(installedPkg).version : 'unknown';
      installKind = `directory (v${installedVer})`;
    }
  } catch {
    installKind = 'not installed';
  }

  console.log(`package.json:      ${TARGET_PACKAGE} = ${JSON.stringify(spec)}`);
  console.log(`package-lock.json: resolved=${lockEntry?.resolved ?? 'n/a'} link=${Boolean(lockEntry?.link)}`);
  console.log(`node_modules:      ${installKind}`);
  if (existsSync(statePath)) {
    const state = readJsonFile(statePath);
    console.log(`saved npm version: ${state.previousVersion ?? 'unknown'}`);
  }
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (command) {
    case 'build':
      buildCore(flags.coreDir);
      break;
    case 'link':
      handleLink(flags);
      break;
    case 'unlink':
      handleUnlink(flags);
      break;
    case 'status':
      handleStatus();
      break;
    case 'check':
      handleCheck(flags);
      break;
    default:
      console.error(
        'Usage: node scripts/core-link.mjs <build|link|unlink|status|check> [--core-dir <path>] [--no-build] [--version <semver>]'
      );
      process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
