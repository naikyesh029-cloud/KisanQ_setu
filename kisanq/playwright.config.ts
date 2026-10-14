import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const bundledChromiumDir = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
const hasBundledBrowser = fs.existsSync(bundledChromiumDir) && fs.readdirSync(bundledChromiumDir).some(name => name.startsWith('chromium'));
const systemChannel = !hasBundledBrowser
  ? fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'chrome'
    : fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
      ? 'msedge'
      : undefined
  : undefined;

export default defineConfig({
  testDir: './tests/e2e', workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(systemChannel ? { channel: systemChannel } : {}) } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000/en/market-prices', reuseExistingServer: !process.env.CI, timeout: 120_000 }
});
