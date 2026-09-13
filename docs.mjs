#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// Builds the API reference into docs/api/.
//
// The heading of docs-home.md carries the version, so the first page of the
// reference says which release it describes. It is rewritten here rather than
// edited by hand, so it cannot fall behind src/version.js.
//
// The theme also writes a companion .md beside every page, for language models
// to read. The site does not link them, so they are removed afterwards.

import { execFileSync } from 'node:child_process';
import { globSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const { RETROTALK_VERSION } = await import('./src/version.js');

const HOME = 'docs-home.md';
const home = readFileSync(HOME, 'utf8')
  .replace(/^# RetroTalk.*$/m, `# RetroTalk v${RETROTALK_VERSION}`);
writeFileSync(HOME, home, 'utf8');

// node_modules/jsdoc/jsdoc.js rather than the npx shim: the shim is a .cmd on
// Windows, which execFileSync cannot run directly.
execFileSync(process.execPath, ['node_modules/jsdoc/jsdoc.js', '-c', 'jsdoc.json'],
  { stdio: 'inherit' });

for (const f of globSync('docs/api/**/*.md')) rmSync(f);
console.log('docs/api', 'v' + RETROTALK_VERSION);
