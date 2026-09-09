'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const yaml = require('js-yaml');
const { validate } = require('./validate-build');
const root = path.resolve(__dirname, '..');
const run = (file, args, cwd = root) => execFileSync(file, args, { cwd, stdio: 'inherit' });
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const node = (file, args = []) => run(process.execPath, [file, ...args]);

function build() {
  node('tools/sync-version.js');
  node('content-pipeline/sync-metadata.js');
  node('node_modules/hexo/bin/hexo', ['clean']);
  node('node_modules/hexo/bin/hexo', ['generate']);
  fs.writeFileSync(path.join(root, 'public/build-info.json'), JSON.stringify({
    version: require('../site-version.json').version,
    sourceCommit: git(['rev-parse', 'HEAD']),
    sourceDirty: Boolean(git(['status', '--porcelain', '--untracked-files=no'])), builtAt: new Date().toISOString()
  }, null, 2));
  validate(root);
}

async function deploy() {
  build();
  const config = yaml.load(fs.readFileSync(path.join(root, '_config.yml'), 'utf8'));
  const repository = config.deploy.repository;
  const branch = config.deploy.branch;
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(repository)) throw new Error('Only the configured GitHub HTTPS repository is supported');
  if (!/^[\w/-]+$/.test(branch)) throw new Error('Invalid deploy branch');
  if (process.argv.includes('--dry-run')) {
    console.log(`Dry run passed. Would publish validated public/ to ${repository} (${branch}); nothing pushed.`);
    return;
  }
  const stage = fs.mkdtempSync(path.join(root, '.deploy-safe-'));
  try {
    run('git', ['clone', '--depth', '1', '--branch', branch, repository, stage]);
    const cname = path.join(stage, 'CNAME');
    const retainedCname = fs.existsSync(cname) ? fs.readFileSync(cname) : null;
    for (const entry of fs.readdirSync(stage)) {
      if (entry === '.git') continue;
      fs.rmSync(path.join(stage, entry), { recursive: true, force: true });
    }
    fs.cpSync(path.join(root, 'public'), stage, { recursive: true });
    fs.writeFileSync(path.join(stage, '.nojekyll'), '');
    if (retainedCname && !fs.existsSync(cname)) fs.writeFileSync(cname, retainedCname);
    run('git', ['add', '-A'], stage);
    if (!git(['status', '--porcelain'], stage)) { console.log('No deployment changes.'); return; }
    run('git', ['commit', '-m', `Deploy ${require('../site-version.json').version}`], stage);
    // Never force: a concurrent publish must fail safely instead of overwriting it.
    run('git', ['push', 'origin', `HEAD:${branch}`], stage);
    const sha = git(['rev-parse', 'HEAD'], stage);
    const repo = repository.replace('https://github.com/', '').replace(/\.git$/, '');
    console.log(`Pushed ${sha}. Checking GitHub Pages workflow…`);
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?head_sha=${sha}`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`Push succeeded, but workflow verification failed (${response.status}). Check https://github.com/${repo}/actions`);
      const runs = (await response.json()).workflow_runs || [];
      const pages = runs.find(run => /pages|deploy/i.test(run.name));
      if (pages?.status === 'completed') {
        if (pages.conclusion !== 'success') throw new Error(`Pages ${pages.conclusion}: ${pages.html_url}`);
        console.log(`Pages deployed successfully: ${pages.html_url}`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    throw new Error(`Push succeeded; Pages is still pending. Check https://github.com/${repo}/actions`);
  } finally {
    // Only the mkdtemp directory created by this invocation can be removed.
    if (path.dirname(stage) === root && path.basename(stage).startsWith('.deploy-safe-')) fs.rmSync(stage, { recursive: true, force: true });
  }
}

(async () => {
  const command = process.argv[2] || 'build';
  if (command === 'build') build();
  else if (command === 'deploy') await deploy();
  else throw new Error(`Unknown command: ${command}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
