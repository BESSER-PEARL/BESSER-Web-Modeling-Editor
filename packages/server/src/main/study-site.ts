import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import express from 'express';
import JSZip from 'jszip';

const storage = process.env.STUDY_SITE_DIR || path.join(os.tmpdir(), 'besser-study-site');
const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const maxArchiveBytes = 50 * 1024 * 1024;
const maxExpandedBytes = 250 * 1024 * 1024;
const manifestName = '.versions.json';
let deploymentInProgress = false;

const run = (command: string, args: string[], cwd: string, timeout: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      env: { ...process.env, CI: 'true', NPM_CONFIG_CACHE: path.join(storage, 'npm-cache') },
    });
    let tail = '';
    const collect = (chunk: Buffer) => { tail = (tail + chunk.toString()).slice(-3000); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}: ${tail}`));
    });
  });

const deployedVersions = (): string[] => {
  try {
    const versions = JSON.parse(fs.readFileSync(path.join(storage, 'current', manifestName), 'utf8'));
    return Array.isArray(versions) ? versions.filter((v) => typeof v === 'string' && slugPattern.test(v)) : [];
  } catch { return []; }
};

export function registerStudySite(app: express.Application): void {
  const token = process.env.STUDY_DEPLOY_TOKEN;
  if (!token) return;
  const studyHost = process.env.STUDY_SITE_HOST?.toLowerCase();

  app.use('/study-site', (req, res, next) => {
    if (studyHost && req.hostname.toLowerCase() !== studyHost) {
      res.sendStatus(404);
      return;
    }
    next();
  });

  app.post('/api/study-site', (req, res, next) => {
    const supplied = req.header('X-Study-Deploy-Token') || '';
    const expected = Buffer.from(token);
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      res.status(401).json({ detail: 'Invalid study deployment token' });
      return;
    }
    next();
  }, express.raw({ type: 'application/zip', limit: `${maxArchiveBytes}b` }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      res.status(400).json({ detail: 'A generated website ZIP is required' });
      return;
    }
    if (deploymentInProgress) {
      res.status(409).json({ detail: 'Another study website deployment is in progress' });
      return;
    }
    deploymentInProgress = true;
    let stage: string | null = null;
    try {
      fs.mkdirSync(storage, { recursive: true });
      stage = fs.mkdtempSync(path.join(storage, 'pending-'));
      const zip = await JSZip.loadAsync(req.body);
      const files = Object.values(zip.files).filter((entry) => !entry.dir);
      if (!files.length || files.length > 2000) throw new Error('Invalid website archive size');
      let expanded = 0;
      for (const entry of files) {
        const segments = entry.name.split('/');
        if (segments.some((segment) => !segment || segment === '.' || segment === '..') || entry.name.includes('\\')) {
          throw new Error('Invalid website archive path');
        }
        const destination = path.resolve(stage, 'source', ...segments);
        if (!destination.startsWith(path.resolve(stage, 'source') + path.sep)) throw new Error('Invalid website archive path');
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        await pipeline(
          entry.nodeStream(),
          new Transform({ transform(chunk: Buffer, _encoding, callback) {
            expanded += chunk.length;
            callback(expanded > maxExpandedBytes ? new Error('Website archive exceeds size limit') : null, chunk);
          } }),
          fs.createWriteStream(destination),
        );
      }
      const source = path.join(stage, 'source');
      // The normal generator puts one app at the ZIP root and several apps in
      // profile folders. Both layouts contain frontend/ plus optional backend/.
      if (fs.existsSync(path.join(source, 'frontend', 'package.json'))) {
        fs.mkdirSync(path.join(source, 'base'));
        fs.renameSync(path.join(source, 'frontend'), path.join(source, 'base', 'frontend'));
      }
      const versions = fs.readdirSync(source, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(source, entry.name, 'frontend', 'package.json')))
        .map((entry) => entry.name);
      if (!versions.includes('base') || versions.length > 8 || versions.some((v) => !slugPattern.test(v))) {
        throw new Error('Website archive must contain a Base site and valid profile folders');
      }
      const packageFile = path.join(source, 'base', 'frontend', 'package.json');
      if (!fs.existsSync(packageFile)) throw new Error('Generated Base site has no package.json');
      const packageBytes = fs.readFileSync(packageFile);
      const dependencyHash = crypto.createHash('sha256').update(packageBytes).digest('hex');
      const dependencies = path.join(storage, 'dependencies', dependencyHash);
      if (!fs.existsSync(path.join(dependencies, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite'))) {
        fs.mkdirSync(path.dirname(dependencies), { recursive: true });
        const pendingDependencies = fs.mkdtempSync(path.join(storage, 'dependencies', 'pending-'));
        try {
          fs.writeFileSync(path.join(pendingDependencies, 'package.json'), packageBytes);
          await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], pendingDependencies, 300_000);
          if (fs.existsSync(dependencies)) fs.rmSync(dependencies, { recursive: true, force: true });
          fs.renameSync(pendingDependencies, dependencies);
        } finally {
          if (fs.existsSync(pendingDependencies)) {
            try { fs.rmSync(pendingDependencies, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
            catch (error) { console.error('Could not clean up dependency staging directory', error); }
          }
        }
      }
      fs.symlinkSync(path.join(dependencies, 'node_modules'), path.join(stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      const vite = path.join(stage, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
      for (const version of versions) {
        const siteRoot = path.join(source, version, 'frontend');
        if (!fs.existsSync(path.join(siteRoot, 'vite.config.ts'))) throw new Error(`Generated site ${version} has no Vite config`);
        await run(vite, ['build', siteRoot, '--config', path.join(siteRoot, 'vite.config.ts'), '--base', `/study-site/${version}/`, '--outDir', path.join(stage, 'dist', version)], stage, 180_000);
        if (!fs.existsSync(path.join(stage, 'dist', version, 'index.html'))) throw new Error(`Build produced no index for ${version}`);
      }
      fs.writeFileSync(path.join(stage, 'dist', manifestName), JSON.stringify(versions));
      const current = path.join(storage, 'current');
      const previous = path.join(storage, 'previous');
      fs.rmSync(previous, { recursive: true, force: true });
      if (fs.existsSync(current)) fs.renameSync(current, previous);
      try { fs.renameSync(path.join(stage, 'dist'), current); }
      catch (error) {
        if (fs.existsSync(previous)) fs.renameSync(previous, current);
        throw error;
      }
      try { fs.rmSync(previous, { recursive: true, force: true }); }
      catch (error) { console.error('Could not clean up prior study website', error); }
      res.json({ success: true, versions });
    } catch (error) {
      res.status(500).json({ detail: error instanceof Error ? error.message : 'Study website build failed' });
    } finally {
      if (stage) {
        try { fs.rmSync(stage, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
        catch (error) { console.error('Could not clean up study website staging directory', error); }
      }
      deploymentInProgress = false;
    }
  });

  app.get(['/study-site', '/study-site/'], (_req, res) => res.redirect(302, '/study-site/base/'));
  app.use('/study-site/:version', (req, res, next) => {
    const version = req.params.version;
    if (!slugPattern.test(version) || !deployedVersions().includes(version)) {
      res.sendStatus(404);
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    const siteRoot = path.join(storage, 'current', version);
    express.static(siteRoot, { index: 'index.html', fallthrough: true })(req, res, () => {
      if (req.path.includes('.')) { res.sendStatus(404); return; }
      res.sendFile(path.join(siteRoot, 'index.html'), next);
    });
  });
}
