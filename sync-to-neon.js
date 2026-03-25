#!/usr/bin/env node
// Wrapper — delegates to the ESM version
const { execSync } = require('child_process');
const path = require('path');
execSync(`node ${path.join(__dirname, 'sync-to-neon.mjs')}`, { stdio: 'inherit' });
