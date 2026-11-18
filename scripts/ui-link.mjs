import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_PACKAGE = '@preptex/ui';
const STATE_FILENAME = '.local-ui-state.json';
const PACK_DIR_NAME = '.local-ui';
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'overrides'];

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(websiteRoot, STATE_FILENAME);
const packDir = path.join(websiteRoot, PACK_DIR_NAME);

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

function runNpm(args, cwd, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && npmCli.endsWith('.js')) {
    return runCommand(process.execPath, [npmCli, ...args], cwd, options);
  }
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return runCommand(npmBin, args, cwd, options);
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

function resolveUiPaths(uiDirArg) {
  const rawDir = uiDirArg || process.env.PREPTEX_UI_DIR || path.resolve(websiteRoot, '../ui');
  const candidate = path.resolve(websiteRoot, rawDir);
  if (!existsSync(candidate)) {
    throw new Error(
      `UI directory not found at "${candidate}". Pass --ui-dir <path> or set PREPTEX_UI_DIR.`,
    );
  }
  const manifestPath = path.join(candidate, 'package.json');
  if (!existsSync(manifestPath) || readJsonFile(manifestPath).name !== TARGET_PACKAGE) {
    throw new Error(`Could not find ${TARGET_PACKAGE}/package.json inside "${candidate}".`);
  }
  return candidate;
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--no-build') {
      flags.noBuild = true;
    } else if (arg === '--ui-dir' && i + 1 < args.length) {
      flags.uiDir = args[++i];
    } else if (arg.startsWith('--ui-dir=')) {
      flags.uiDir = arg.slice('--ui-dir='.length);
    } else if (arg === '--version' && i + 1 < args.length) {
      flags.version = args[++i];
    } else if (arg.startsWith('--version=')) {
      flags.version = arg.slice('--version='.length);
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function findDroppedOptionalPeerEntries(prevLockRaw, nextLockRaw) {
  if (!prevLockRaw || !nextLockRaw) return [];
  let prevLock;
  let nextLock;
  try {
    prevLock = JSON.parse(prevLockRaw);
    nextLock = JSON.parse(nextLockRaw);
  } catch {
    return [];
  }
  const prevPkgs = prevLock?.packages ?? {};
  const nextPkgs = nextLock?.packages ?? {};
  const dropped = [];

  for (const [pkgPath, meta] of Object.entries(prevPkgs)) {
    if (!meta || typeof meta !== 'object') continue;
    if (meta.optional !== true || meta.peer !== true) continue;
    if (Object.prototype.hasOwnProperty.call(nextPkgs, pkgPath)) continue;

    const marker = '/node_modules/';
    const idx = pkgPath.lastIndexOf(marker);
    if (idx <= 0) continue;
    const parentPath = pkgPath.slice(0, idx);
    const prevParent = prevPkgs[parentPath];
    const nextParent = nextPkgs[parentPath];
    if (prevParent && nextParent && prevParent.version === nextParent.version) {
      dropped.push({ pkgPath, meta });
    }
  }
  return dropped;
}

function preserveOptionalPeerEntries(prevLockRaw, lockPath) {
  if (!prevLockRaw || !existsSync(lockPath)) return 0;
  const nextLockRaw = readFileSync(lockPath, 'utf8');
  const dropped = findDroppedOptionalPeerEntries(prevLockRaw, nextLockRaw);
  if (dropped.length === 0) return 0;

  const nextLock = parseJson(nextLockRaw, 'package-lock.json');
  const mergedPackages = { ...(nextLock.packages ?? {}) };
  for (const { pkgPath, meta } of dropped) {
    mergedPackages[pkgPath] = meta;
  }
  const sortedPackages = {};
  for (const key of Object.keys(mergedPackages).sort()) {
    sortedPackages[key] = mergedPackages[key];
  }
  writeJsonFile(lockPath, {
    ...nextLock,
    packages: sortedPackages,
  });
  return dropped.length;
}

function buildAndPackUi(uiDirArg, { noBuild = false } = {}) {
  const uiDir = resolveUiPaths(uiDirArg);
  const pkgManifest = readJsonFile(path.join(uiDir, 'package.json'));

  if (!noBuild) {
    console.log(`Building ${TARGET_PACKAGE} in ${uiDir}...`);
    runNpm(['run', 'build'], uiDir);
  }

  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });

  const packOut = runNpm(
    ['pack', '--ignore-scripts', '--pack-destination', packDir, '--json'],
    uiDir,
    { capture: true },
  );
  const packJson = JSON.parse(packOut);
  const packed = Array.isArray(packJson) ? packJson[0] : Object.values(packJson)[0];
  const tarballPath = path.join(packDir, packed.filename);
  if (!existsSync(tarballPath)) {
    throw new Error(`Expected packed tarball missing at ${tarballPath}`);
  }
  return {
    uiDir,
    version: pkgManifest.version,
    tarballRel: `${PACK_DIR_NAME}/${packed.filename}`,
  };
}

function handleLink(flags) {
  const { uiDir, version, tarballRel } = buildAndPackUi(flags.uiDir, { noBuild: flags.noBuild });
  const manifestPath = path.join(websiteRoot, 'package.json');
  const manifest = readJsonFile(manifestPath);
  const currentSpec = manifest.dependencies?.[TARGET_PACKAGE];

  if (typeof currentSpec === 'string' && !isNonRegistrySpecifier(currentSpec)) {
    writeJsonFile(statePath, {
      previousVersion: currentSpec,
      uiDir,
      linkedAt: new Date().toISOString(),
    });
  } else if (!existsSync(statePath)) {
    writeJsonFile(statePath, {
      previousVersion: `^${version}`,
      uiDir,
      linkedAt: new Date().toISOString(),
    });
  }

  const lockPath = path.join(websiteRoot, 'package-lock.json');
  const prevLockRaw = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null;
  if (prevLockRaw) {
    const parsedLock = parseJson(prevLockRaw, 'package-lock.json');
    if (parsedLock.packages && parsedLock.packages[`node_modules/${TARGET_PACKAGE}`]) {
      delete parsedLock.packages[`node_modules/${TARGET_PACKAGE}`];
      writeJsonFile(lockPath, parsedLock);
    }
  }

  const localSpec = `file:${tarballRel}`;
  manifest.dependencies = manifest.dependencies ?? {};
  manifest.dependencies[TARGET_PACKAGE] = localSpec;
  writeJsonFile(manifestPath, manifest);

  const installedModule = path.join(websiteRoot, 'node_modules', ...TARGET_PACKAGE.split('/'));
  rmSync(installedModule, { recursive: true, force: true });

  console.log(`Installing packed ${TARGET_PACKAGE} -> ${localSpec}...`);
  runNpm(['install', localSpec, '--prefer-offline', '--no-audit', '--no-fund'], websiteRoot);

  const restoredCount = preserveOptionalPeerEntries(prevLockRaw, lockPath);
  if (restoredCount > 0) {
    console.log(
      `Preserved ${restoredCount} unchanged optional peer lockfile ${restoredCount === 1 ? 'entry' : 'entries'}.`,
    );
  }

  console.log(`Linked ${TARGET_PACKAGE} (${version}) -> ${localSpec}`);
  console.log('To rebuild and re-sync after UI edits: npm run ui:build');
}

function handleUnlink(flags) {
  const explicitVersion = flags.version || flags._[0];
  let targetVersion = explicitVersion;
  if (!targetVersion && existsSync(statePath)) {
    const state = readJsonFile(statePath);
    if (typeof state.previousVersion === 'string' && !isNonRegistrySpecifier(state.previousVersion)) {
      targetVersion = state.previousVersion;
    }
  }
  if (!targetVersion) {
    const headRaw = gitShow('HEAD:package.json');
    if (headRaw) {
      const headSpec = parseJson(headRaw, 'HEAD:package.json').dependencies?.[TARGET_PACKAGE];
      if (typeof headSpec === 'string' && !isNonRegistrySpecifier(headSpec)) {
        targetVersion = headSpec;
      }
    }
  }
  if (!targetVersion) {
    throw new Error(
      `Could not determine npm version to restore for ${TARGET_PACKAGE}. Pass --version <semver>.`,
    );
  }

  const manifestPath = path.join(websiteRoot, 'package.json');
  const manifest = readJsonFile(manifestPath);
  manifest.dependencies = manifest.dependencies ?? {};
  manifest.dependencies[TARGET_PACKAGE] = targetVersion;
  writeJsonFile(manifestPath, manifest);

  const installedModule = path.join(websiteRoot, 'node_modules', ...TARGET_PACKAGE.split('/'));
  rmSync(installedModule, { recursive: true, force: true });
  rmSync(packDir, { recursive: true, force: true });
  rmSync(statePath, { force: true });

  const lockPath = path.join(websiteRoot, 'package-lock.json');
  const prevLockRaw = gitShow('HEAD:package-lock.json') || (existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null);
  runNpm(['install', `${TARGET_PACKAGE}@${targetVersion}`, '--save-exact'], websiteRoot);
  preserveOptionalPeerEntries(prevLockRaw, lockPath);
  console.log(`Unlinked: ${TARGET_PACKAGE} is now ${targetVersion} from npm.`);
}

function handleStatus() {
  const manifest = readJsonFile(path.join(websiteRoot, 'package.json'));
  const spec = manifest.dependencies?.[TARGET_PACKAGE];
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
  console.log(`package.json: ${TARGET_PACKAGE} = ${JSON.stringify(spec)}`);
  console.log(`node_modules: ${installKind}`);
}

function handleCheck() {
  const manifest = readJsonFile(path.join(websiteRoot, 'package.json'));
  for (const section of DEP_SECTIONS) {
    const spec = manifest?.[section]?.[TARGET_PACKAGE];
    if (spec !== undefined && isNonRegistrySpecifier(spec)) {
      console.error(
        `[preptex] ${section}["${TARGET_PACKAGE}"] is "${spec}" (local tarball/path link). Publish ${TARGET_PACKAGE} and run "npm run ui:unlink" before deploying.`,
      );
      process.exit(1);
    }
  }
  console.log(`OK: ${TARGET_PACKAGE} is linked to an npm registry version.`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (command) {
    case 'build':
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
      handleCheck();
      break;
    default:
      console.error('Usage: node scripts/ui-link.mjs <build|link|unlink|status|check> [--ui-dir <path>] [--no-build] [--version <semver>]');
      process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
