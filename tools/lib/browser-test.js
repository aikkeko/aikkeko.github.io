'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function launchBrowser() {
  const executable = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(fs.existsSync);
  if (!executable) throw new Error('Set CHROME_PATH to an installed Chrome/Edge executable');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aike-browser-test-'));
  const child = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let socket;
  let spawnError;
  child.once('error', error => { spawnError = error; });
  async function close() {
    socket?.close();
    child.kill();
    await delay(500);
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('aike-browser-test-')) {
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }); } catch (_) { /* Chrome may still be releasing files. */ }
    }
  }
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(portFile); i++) {
      if (spawnError) throw spawnError;
      if (i > 100) throw new Error('Browser startup timed out');
      await delay(100);
    }
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.exceptionThrown') {
        const details = data.params.exceptionDetails;
        errors.push(`${details.url || ''}:${(details.lineNumber || 0) + 1} ${details.text}: ${details.exception?.description || ''}`);
      }
      if (!data.id || !pending.has(data.id)) return;
      const { resolve, reject, timer } = pending.get(data.id);
      clearTimeout(timer); pending.delete(data.id);
      data.error ? reject(new Error(data.error.message)) : resolve(data.result);
    });
    function call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }
    await call('Page.enable'); await call('Runtime.enable');
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    return { call, evaluate, errors, close,
      async viewport(width, height) {
        await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 769 });
        await call('Emulation.setTouchEmulationEnabled', { enabled: width < 769 });
      },
      async navigate(url) {
        errors.length = 0;
        await call('Page.navigate', { url });
        for (let i = 0; i < 150; i++) {
          if (await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState !== 'loading'`)) break;
          await delay(100);
        }
        await delay(700);
        await evaluate('document.fonts.ready');
      },
      async screenshot(file) {
        const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
      }
    };
  } catch (error) { await close(); throw error; }
}
module.exports = { launchBrowser, delay };
