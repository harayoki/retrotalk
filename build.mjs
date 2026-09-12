#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

import { mkdirSync, writeFileSync } from 'node:fs';
import * as esbuild from 'esbuild';

const { RETROTALK_VERSION } = await import('./src/version.js');

// Starts with /*! so minification keeps it.
const banner = `/*! RetroTalk v${RETROTALK_VERSION} | MIT License | https://github.com/harayoki/retrotalk */`;

mkdirSync('dist', { recursive: true });

for (const [out, minify] of [['dist/retrotalk.js', false], ['dist/retrotalk.min.js', true]]) {
  const built = await esbuild.build({
    // global.js assigns the single global. esbuild's globalName would leave
    // the wrapper name on the page as well.
    entryPoints: ['src/global.js'],
    bundle: true,
    format: 'iife',
    banner: { js: banner },
    legalComments: 'inline',
    charset: 'utf8',
    minify,
    write: false,
  });
  const js = built.outputFiles[0].text;
  writeFileSync(out, js, 'utf8');
  console.log(out.padEnd(22), (js.length / 1024).toFixed(1) + 'KB');
}
