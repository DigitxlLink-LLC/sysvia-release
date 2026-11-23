// Capture current app screenshots with the website fixture. No native services or sign-in.
// node tools/capture-app-screens.mjs /absolute/path/to/SysviaWebNew /absolute/path/to/sysviaappprod
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
const website = path.resolve(process.argv[2] || '');
const { fixtureInit, appBootstrap } = await import(pathToFileURL(path.join(website, 'deliverables/walkthrough-assembly/recorder/fixture.mjs')).href);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.resolve(process.argv[3] || path.join(website, '../sysviaappprod'));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SYSVIA_PLAYWRIGHT_MODULE || path.join(app, 'node_modules/playwright'));
const output = path.join(root, 'media/screenshots');
const captured = [];
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const strings = JSON.parse(fs.readFileSync(path.join(app, 'src/i18n/en.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).version;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (!pathname.startsWith('/app/')) { res.writeHead(404); return res.end(); }
  const file = path.resolve(app, 'src', '.' + pathname.slice(4));
  if (!file.startsWith(path.join(app, 'src') + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, body) => {
    if (error) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  });
});
server.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  fs.mkdirSync(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const fixtureData = { strings, machine: 'mac', theme: 'sage', appVersion: version, files: 248, bytes: 1260000000 };
  await page.addInitScript({ content: `
    (${fixtureInit.toString()})(${JSON.stringify(fixtureData)});
    window.__me.docs = '/Users/demo/Documents';
    window.sysviaDesktop.getMonitorDriver = async () => ({ supported: false, installed: false });
  ` });
  await page.goto(`${origin}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof showAppView === 'function' && typeof renderFolderList === 'function');
  await page.evaluate(appBootstrap);
  const cdp = await page.context().newCDPSession(page);
  const shot = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'webp', quality: 92,
      clip: { x: 0, y: 0, width: 1280, height: 860, scale: 1.5 }
    });
    const body = Buffer.from(data, 'base64');
    fs.writeFileSync(path.join(output, name + '.webp'), body);
    const dimensions = await page.evaluate(async data => {
      const img = new Image();
      img.src = 'data:image/webp;base64,' + data;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }, data);
    captured.push({ file: name + '.webp', ...dimensions, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex') });
    console.log('Captured', name);
  };
  await shot('overview');
  await page.evaluate(async () => { showAppView('view-folders'); await loadFolders(); });
  await shot('folders');
  await page.evaluate(async () => { showAppView('view-devices'); await loadDevices(); });
  await shot('computers');
  await page.evaluate(async () => { showAppView('view-input-sharing'); await window.loadInputSharing(true); });
  await page.locator('#input-host-btn').scrollIntoViewIfNeeded();
  await shot('input-sharing');
  await page.locator('#input-layout-open-btn').click();
  await shot('desk-layout');
  await page.locator('#input-layout-close-btn').click();
  await page.locator('#input-settings-form').scrollIntoViewIfNeeded();
  await shot('clipboard-settings');
  await page.evaluate(() => showAppView('view-screens'));
  await shot('remote-screen');
  await page.locator('#screens-tab-advanced').click();
  await page.locator('#screens-monitors').scrollIntoViewIfNeeded();
  await shot('extended-monitors');
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({
    appVersion: version, appCommit: git(app, ['rev-parse','HEAD']),
    appWorkingTreeModified: Boolean(git(app, ['status','--porcelain'])),
    websiteCommit: git(website, ['rev-parse','HEAD']), capturedAt: new Date().toISOString(),
    theme: 'sage', platform: 'macOS', viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5,
    note: 'Real app renderer with sample computers, files and engine replies. No sign-in, native services or live multi-computer sessions.',
    images: captured
  }, null, 2) + '\n');
  if (errors.length) console.log('Renderer messages:', [...new Set(errors)].join('; '));
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
