#!/usr/bin/env node

import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const noFetch = args.has('--no-fetch');
const jsonOut = args.has('--json');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function safeRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return '';
  }
}

function getDeletedFilesCount(branch) {
  const diff = safeRun(`git diff --name-status origin/main..origin/${branch}`);
  if (!diff) return 0;
  return diff
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('D\t')).length;
}

function classifyRisk({ behind, ahead, deletedFiles }) {
  if (ahead === 0) return 'none';
  if (behind >= 50) return 'high';
  if (deletedFiles >= 3) return 'high';
  if (behind > 0 && ahead > 0) return 'medium';
  return 'low';
}

function parseAheadBehind(raw) {
  const [behindStr, aheadStr] = raw.split(/\s+/);
  return {
    behind: Number(behindStr || 0),
    ahead: Number(aheadStr || 0)
  };
}

function main() {
  run('git rev-parse --is-inside-work-tree >/dev/null');

  const fetchRules = safeRun('git config --get-all remote.origin.fetch')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

  if (!noFetch) {
    run("git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune");
  }

  const allRemoteBranches = run("git for-each-ref --format='%(refname:short)' refs/remotes/origin")
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.replace(/^origin\//, ''))
    .filter((v) => v !== 'HEAD' && v !== 'origin');

  const rows = allRemoteBranches.map((branch) => {
    const { behind, ahead } = parseAheadBehind(
      run(`git rev-list --left-right --count origin/main...origin/${branch}`)
    );
    const merged = safeRun(`git merge-base --is-ancestor origin/${branch} origin/main; echo $?`) === '0';
    const last = run(`git log -1 --format='%ci|%h|%an|%s' origin/${branch}`);
    const deletedFiles = getDeletedFilesCount(branch);
    const risk = classifyRisk({ behind, ahead, deletedFiles });
    return {
      branch,
      behind,
      ahead,
      merged,
      deletedFiles,
      risk,
      last
    };
  });

  const open = rows
    .filter((r) => !r.merged)
    .sort((a, b) => {
      if (a.behind !== b.behind) return a.behind - b.behind;
      if (a.ahead !== b.ahead) return b.ahead - a.ahead;
      return a.branch.localeCompare(b.branch);
    });

  const mergedRows = rows
    .filter((r) => r.merged)
    .sort((a, b) => a.branch.localeCompare(b.branch));

  const output = {
    generatedAt: new Date().toISOString(),
    fetchRules,
    openBranches: open,
    mergedBranches: mergedRows
  };

  if (jsonOut) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`# Open Branch Audit (${output.generatedAt})`);
  if (fetchRules.length > 0) {
    console.log('');
    console.log(`Remote fetch rules: ${fetchRules.join(', ')}`);
  }

  console.log('');
  console.log('## Open Remote Branches (not merged into origin/main)');
  console.log('');
  console.log('| Branch | Behind | Ahead | Deleted Files vs main | Risk | Last Commit |');
  console.log('|---|---:|---:|---:|---|---|');

  for (const r of open) {
    console.log(`| origin/${r.branch} | ${r.behind} | ${r.ahead} | ${r.deletedFiles} | ${r.risk} | ${r.last} |`);
  }

  console.log('');
  console.log('## Merged Remote Branches (already contained in origin/main)');
  console.log('');
  for (const r of mergedRows) {
    console.log(`- origin/${r.branch}`);
  }
}

main();
