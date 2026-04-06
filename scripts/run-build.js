#!/usr/bin/env node
const { execSync } = require('child_process');
const args = process.argv.slice(2);
const isSafe = args.includes('--safe');

// Set env var consumed by vite configs
process.env.SPOTLIGHT_NO_AUTO_INIT = '1';

const cmd = isSafe ? 'npx vite build -c vite.config.safe.js' : 'npx vite build';
try {
  execSync(cmd, { stdio: 'inherit', env: process.env });
} catch (err) {
  process.exit(err.status || 1);
}
