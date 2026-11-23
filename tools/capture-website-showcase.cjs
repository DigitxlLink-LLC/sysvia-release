// Capture the actual homepage cards. Requires an existing Playwright installation,
// Chromium, ffmpeg/ffprobe, and the website's local preview server.
// node tools/capture-website-showcase.cjs /absolute/path/to/SysviaWebNew
// SYSVIA_PLAYWRIGHT_MODULE and SYSVIA_PREVIEW_URL override local defaults.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const website = path.resolve(process.argv[2] || '');
const output = path.resolve(__dirname, '../media/showcase');
const preview = process.env.SYSVIA_PREVIEW_URL || 'http://127.0.0.1:8767';
const { chromium } = require(process.env.SYSVIA_PLAYWRIGHT_MODULE || path.resolve(website, '../sysviaappprod/node_modules/playwright'));
const fps = 30;
const specs = [
  { slug: 'keyboard-mouse', selector: '[data-feature-art="kvm"]', timeline: 'kvm-work-demo', seconds: 16.4, title: 'One keyboard and mouse across your desk' },
  { slug: 'remote-screen', selector: '[data-feature-art="remote"]', timeline: 'remote-work-demo', seconds: 14, title: 'Reach another computer’s screen' },
  { slug: 'extended-monitors', selector: '.monitor-preview', seconds: 24, title: 'Give your desktop more room' },
];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio:'inherit'});
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sysvia-showcase-'));
  const original = fs.readFileSync(path.join(website, 'sitev2/index.html'), 'utf8');
  const browser = await chromium.launch({headless:true});
  const manifest = { source: 'https://getsysvia.com/', websiteCommit: execFileSync('git', ['rev-parse','HEAD'], {cwd:website,encoding:'utf8'}).trim(), capturedAt: new Date().toISOString(), fps, gifFps:8, gifWidth:640, note: 'Scripted website product illustrations; no live multi-computer sessions.', clips: [] };
  try {
    const scratch = await browser.newPage();
    const fragments = await scratch.evaluate(({html,specs}) => {
      const document = new DOMParser().parseFromString(html,'text/html');
      return specs.map(spec => {
        const node = document.querySelector(spec.selector);
        if (!node) throw new Error('Missing homepage card: '+spec.selector);
        return node.outerHTML;
      });
    }, {html:original,specs});
    await scratch.close();
    for (const [index, spec] of specs.entries()) {
      const existingVideo = path.join(output, spec.slug+'.mp4');
      const existingGif = path.join(output, spec.slug+'.gif');
      if(process.argv.includes('--reuse') && fs.existsSync(existingVideo) && fs.existsSync(existingGif)) {
        const info = JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height,nb_frames','-of','json',existingVideo],{encoding:'utf8'})).streams[0];
        manifest.clips.push({...spec,width:info.width,height:info.height,frames:Number(info.nb_frames),videoBytes:fs.statSync(existingVideo).size,videoSha256:hash(existingVideo),gifBytes:fs.statSync(existingGif).size,gifSha256:hash(existingGif)});
        console.log('Reusing completed '+spec.slug);
        continue;
      }
      const context = await browser.newContext({viewport:{width:960,height:900},deviceScaleFactor:1,reducedMotion:'no-preference',recordVideo:{dir:temp,size:{width:960,height:900}}});
      const recordingStarted = Date.now();
      const page = await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      const html = `<!doctype html><html><head><meta charset="utf-8">
        <link rel="stylesheet" href="/sitev2/assets/fonts.googleapis.com/77df166c17-google-fonts.css">
        <link rel="stylesheet" href="/sitev2/assets/cdn.prod.website-files.com/6c000282e7-ostack.webflow.shared.ad8c221c2.css">
        <link rel="stylesheet" href="/sitev2/assets/sysvia-feature-art.css">
        <link rel="stylesheet" href="/assets/extended-monitors-card.css">
        <style>html,body{margin:0;padding:0;background:#f6f8f2;color:#35594a;font-family:Interdisplay,Arial,sans-serif}*{box-sizing:border-box}.capture{width:960px;padding:0 16px}.capture-header{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 4px;font-size:18px;gap:20px}.capture-brand{display:flex;align-items:center;font-size:23px;font-weight:600}.capture-brand img{width:32px;height:32px}.capture-footer{padding:14px 4px 16px;color:#687764;font-size:13px;line-height:1.5}.feature-art,.monitor-preview{width:100%;border-radius:12px;overflow:hidden}.feature-art{margin:0}.monitor-ui{margin:0}</style>
        <script src="/sitev2/assets/cdn.prod.website-files.com/636c504402-gsap.min.js" defer></script>
        <script src="/sitev2/assets/sysvia-feature-art.js" defer></script>
        <script src="/assets/extended-monitors-card.js" defer></script>
        </head><body><div class="capture"><header class="capture-header"><span class="capture-brand"><img src="/assets/new%20assets/SysviaLogoPSDGreen.png" alt="">Sysvia</span><span>${spec.title}</span></header><main id="features">${fragments[index]}</main><footer class="capture-footer">From getsysvia.com · Scripted product illustration with sample content.</footer></div></body></html>`;
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(preview).origin) return route.abort();
        if (url.pathname === '/__showcase/'+spec.slug) return route.fulfill({contentType:'text/html',body:html});
        return route.continue();
      });
      await page.goto(preview+'/__showcase/'+spec.slug,{waitUntil:'load'});
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))});
      await page.waitForTimeout(300);
      const height = await page.locator('.capture').evaluate(element=>Math.ceil(element.getBoundingClientRect().height/2)*2);
      if (height > 900) throw new Error('Capture exceeds recorder height: '+height);
      if (spec.timeline) await page.evaluate(id=>{const timeline=gsap.getById(id);if(!timeline)throw new Error('Missing timeline '+id);timeline.restart()},spec.timeline);
      else await page.locator('.computer[data-item="0"]').click({force:true});
      await page.waitForTimeout(200);
      const start = Math.max(0, (Date.now() - recordingStarted)/1000);
      console.log('Recording '+spec.slug+' at 960×'+height+' for '+spec.seconds+' seconds');
      await page.screenshot({path:path.join(temp,spec.slug+'-poster.jpg'),type:'jpeg',quality:90,timeout:15000});
      await page.waitForTimeout((spec.seconds + 1)*1000);
      if(errors.length) throw new Error(errors.join('\n'));
      const recording = page.video();
      await context.close();
      const rawVideo = await recording.path();
      const video=path.join(output,spec.slug+'.mp4');
      run(['-i',rawVideo,'-ss',start.toFixed(3),'-t',String(spec.seconds),'-vf',`crop=960:${height}:0:0,fps=30`,'-an','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',video]);
      const gif=path.join(output,spec.slug+'.gif');
      run(['-i',video,'-filter_complex','fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',gif]);
      manifest.clips.push({...spec,width:960,height,frames:Math.round(spec.seconds*fps),videoBytes:fs.statSync(video).size,videoSha256:hash(video),gifBytes:fs.statSync(gif).size,gifSha256:hash(gif)});
      console.log('Created '+spec.slug+' GIF and MP4.');
    }
    for(const [from,to] of [['walkthrough-mobile.mp4','walkthrough.mp4'],['poster.webp','walkthrough-poster.webp']]) fs.copyFileSync(path.join(website,'sitev2/assets/hero-walkthrough',from),path.join(output,to));
    manifest.walkthrough={source:'sitev2/assets/hero-walkthrough/walkthrough-mobile.mp4',seconds:60.7,width:960,height:540,sha256:hash(path.join(output,'walkthrough.mp4'))};
    fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    console.log('Showcase complete: '+output);
  }finally{await browser.close();fs.rmSync(temp,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
