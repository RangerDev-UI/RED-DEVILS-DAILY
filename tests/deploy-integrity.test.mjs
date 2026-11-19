import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = path.join(projectRoot, 'netlify', 'functions');

test('all Netlify Functions resolve their imports and expose an entrypoint', async () => {
  const entries = (await readdir(functionsDir)).filter(name => name.endsWith('.mjs'));
  assert.ok(entries.length >= 6, 'Expected all production serverless functions');
  for (const entry of entries) {
    const module = await import(pathToFileURL(path.join(functionsDir, entry)).href);
    assert.equal(typeof (entry === 'monitor.mjs' ? module.default : module.handler), 'function', 'Missing entrypoint: ' + entry);
  }
});

test('every /api redirect targets an existing Netlify Function', async () => {
  const config = await readFile(path.join(projectRoot, 'netlify.toml'), 'utf8');
  const redirects = [...config.matchAll(/to = "\/\.netlify\/functions\/([a-z-]+)"/g)].map(match => match[1]);
  assert.ok(redirects.length >= 6, 'Required API redirects missing');
  const existing = new Set(await readdir(functionsDir));
  for (const endpoint of redirects) {
    assert.ok(existing.has(endpoint + '.mjs'), 'Missing Function for API: ' + endpoint);
  }
});
