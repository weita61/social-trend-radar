import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../src/api/static.ts';

const WEB_ROOT = fileURLToPath(new URL('../apps/web/', import.meta.url));

test('web assets exist and have expected structure', () => {
  const indexHtml = resolve(WEB_ROOT, 'index.html');
  const styleCss = resolve(WEB_ROOT, 'style.css');
  const appJs = resolve(WEB_ROOT, 'app.js');

  assert.ok(existsSync(indexHtml), 'index.html must exist');
  assert.ok(existsSync(styleCss), 'style.css must exist');
  assert.ok(existsSync(appJs), 'app.js must exist');

  const htmlContent = readFileSync(indexHtml, 'utf8');
  assert.ok(htmlContent.includes('Social Trend Radar'), 'Should have brand title');
  assert.ok(htmlContent.includes('id="radar-page"'), 'Should have radar section');
  assert.ok(htmlContent.includes('id="coverage-page"'), 'Should have coverage section');
  assert.ok(htmlContent.includes('id="automation-page"'), 'Should have automation section');
  assert.ok(htmlContent.includes('id="evidencePanel"'), 'Should have evidence panel');

  const jsContent = readFileSync(appJs, 'utf8');
  assert.ok(jsContent.includes('/api/trends'), 'Should call trends API');
  assert.ok(jsContent.includes('/api/overview'), 'Should call overview API');
  assert.ok(jsContent.includes('/api/coverage'), 'Should call coverage API');
  assert.ok(jsContent.includes('/api/automation'), 'Should call automation API');
});

test('serveStatic serves index.html, style.css, and app.js correctly', async () => {
  const rootRes = serveStatic('/');
  assert.notEqual(rootRes, null);
  assert.equal(rootRes?.status, 200);
  assert.equal(rootRes?.headers.get('content-type'), 'text/html; charset=utf-8');
  const htmlBody = await rootRes?.text();
  assert.ok(htmlBody?.includes('Social Trend Radar'));

  const cssRes = serveStatic('/style.css');
  assert.notEqual(cssRes, null);
  assert.equal(cssRes?.status, 200);
  assert.equal(cssRes?.headers.get('content-type'), 'text/css; charset=utf-8');

  const jsRes = serveStatic('/app.js');
  assert.notEqual(jsRes, null);
  assert.equal(jsRes?.status, 200);
  assert.equal(jsRes?.headers.get('content-type'), 'application/javascript; charset=utf-8');

  // Negative tests: missing file & path traversal attempt
  assert.equal(serveStatic('/missing-file.txt'), null);
  assert.equal(serveStatic('/../../CLAUDE.md'), null);
});
