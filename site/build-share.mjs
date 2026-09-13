// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 送られたリンクを開いた人が、最初に触るページです。
//
// 中身は URL に書いてあります。ここは受け取って鳴らすだけで、作るほうは
// デモとマニュアルのページにあります。色と書体は同じものを使います。

import { readFileSync } from 'node:fs';
import { bundleEngine, safe } from './engine.mjs';
import { TOKENS_CSS } from './style.mjs';
import { VOICES_JSON } from './voices.mjs';

/**
 * ページを 1 枚に組みます。
 *
 * @returns {Promise<{html: string, engineSize: number}>}
 */
export async function renderSharePage() {
  const tpl = readFileSync('site/share.tpl.html', 'utf8');
  const engine = await bundleEngine();
  const html = tpl
    .replace('/*__TOKENS_CSS__*/', () => TOKENS_CSS)
    .replace('/*__VOICES__*/', () => VOICES_JSON)
    .replace('/*__ENGINE__*/', () => safe(engine));
  return { html, engineSize: engine.length };
}
