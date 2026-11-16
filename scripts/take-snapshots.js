const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function findBrowser() {
  for (const envVar of ['BROWSER_PATH', 'CHROME_PATH', 'EDGE_PATH']) {
    if (process.env[envVar] && fs.existsSync(process.env[envVar])) {
      return process.env[envVar];
    }
  }

  const platform = process.platform;
  let candidates = [];

  if (platform === 'win32') {
    candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') : '',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : '',
    ];
  } else if (platform === 'darwin') {
    candidates = [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      process.env.HOME ? path.join(process.env.HOME, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome') : '',
      process.env.HOME ? path.join(process.env.HOME, 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge') : '',
    ];
  } else {
    candidates = [
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const BROWSER_PATH = findBrowser();
const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');
const PORT = 4055;
const CDP_PORT = 9223;

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Static server for CRA build directory
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(BUILD_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(BUILD_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading ' + urlPath);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

async function run() {
  if (!BROWSER_PATH) {
    console.error('No compatible Chromium-based browser (Edge, Chrome, Chromium) found.');
    console.error('Please install Google Chrome or Microsoft Edge, or set BROWSER_PATH / CHROME_PATH environment variable.');
    process.exit(1);
  }

  server.listen(PORT, async () => {
    console.log(`Static server running on http://localhost:${PORT}`);
    console.log(`Using browser binary: ${BROWSER_PATH}`);

    const browserProcess = execFile(BROWSER_PATH, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${CDP_PORT}`,
      'about:blank',
    ]);
    browserProcess.on('error', (err) => {
      console.error('Browser process error:', err.message);
    });

    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://localhost:${CDP_PORT}/json/version`);
        const data = await res.json();
        wsUrl = data.webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!wsUrl) {
      console.error('Failed to get WebSocket debugger URL');
      browserProcess.kill();
      server.close();
      process.exit(1);
    }

    const ws = new WebSocket(wsUrl);
    let msgCounter = 1;
    const send = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = msgCounter++;
        const handler = (evt) => {
          const res = JSON.parse(evt.data);
          if (res.id === id) {
            ws.removeEventListener('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        const payload = sessionId
          ? { id, sessionId, method, params }
          : { id, method, params };
        ws.send(JSON.stringify(payload));
      });

    await new Promise((r) => ws.addEventListener('open', r));

    const viewports = [
      { name: 'desktop', width: 1440, height: 900, mobile: false },
      { name: 'laptop', width: 1024, height: 768, mobile: false },
      { name: 'tablet', width: 768, height: 1024, mobile: true },
      { name: 'mobile', width: 414, height: 896, mobile: true },
    ];

    const states = [
      { name: 'default', query: '?demo=sample' },
      { name: 'operations-popup', query: '?demo=sample&state=operations' },
      { name: 'log-popup', query: '?demo=sample&state=log' },
    ];

    try {
      for (const vp of viewports) {
        for (const st of states) {
          const targetUrl = `http://localhost:${PORT}/${st.query}`;
          const filename = `${vp.name}-${st.name}.png`;
          const outputPath = path.join(SCREENSHOTS_DIR, filename);

          console.log(`Capturing ${filename} (${vp.width}x${vp.height})...`);

          const target = await send('Target.createTarget', { url: targetUrl });
          const session = await send('Target.attachToTarget', {
            targetId: target.targetId,
            flatten: true,
          });
          const sessionId = session.sessionId;

          await send('Page.enable', {}, sessionId);
          await send(
            'Emulation.setDeviceMetricsOverride',
            {
              width: vp.width,
              height: vp.height,
              deviceScaleFactor: 1,
              mobile: vp.mobile,
            },
            sessionId
          );

          // Allow layout, styles, and demo hooks to settle
          await new Promise((r) => setTimeout(r, 1600));

          const shot = await send(
            'Page.captureScreenshot',
            { format: 'png' },
            sessionId
          );
          const imgBuf = Buffer.from(shot.data, 'base64');
          fs.writeFileSync(outputPath, imgBuf);
          console.log(`Saved: ${outputPath}`);

          await send('Target.closeTarget', { targetId: target.targetId });
        }
      }
      console.log('All snapshots captured successfully!');
    } catch (err) {
      console.error('Error capturing snapshots:', err);
    } finally {
      ws.close();
      try {
        browserProcess.kill();
      } catch (e) {}
      server.close();
      process.exit(0);
    }
  });
}

run();
