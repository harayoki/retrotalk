// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 型紙にエンジンを流し込んで、声を聴き比べるページにします。
//
// 録音は持ちません。押されたときに波形を作るので、埋まっているエンジンが
// そのまま鳴ります。文と「何を聴くか」は型紙の中に手で書いてあります。

import { readFileSync } from 'node:fs';
import { bundleEngine, safe } from './engine.mjs';
import { TOKENS_CSS } from './style.mjs';

/**
 * ページを 1 枚に組みます。
 *
 * @returns {Promise<{html: string, engineSize: number}>}
 */
export async function renderListenPage() {
  const tpl = readFileSync('site/listen.tpl.html', 'utf8');
  const engine = await bundleEngine();
  const html = tpl
    .replace('/*__TOKENS_CSS__*/', () => TOKENS_CSS)
    .replace('/*__ENGINE__*/', () => safe(engine));
  return { html, engineSize: engine.length };
}
