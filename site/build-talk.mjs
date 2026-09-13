// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 型紙にエンジンを流し込んで、デモとマニュアルのページにします。
//
// 読める文字の表は src/kana.js から取り出せますが、「そう書くとどう聞こえるか」は
// 取り出せません。そこは型紙の中に手で書いてあります。

import { readFileSync } from 'node:fs';
import { bundleEngine, safe } from './engine.mjs';
import { TOKENS_CSS } from './style.mjs';
import { VOICES_JSON } from './voices.mjs';

const { RETROTALK_VERSION } = await import('../src/version.js');

/**
 * ページを 1 枚に組みます。
 *
 * @returns {Promise<{html: string, engineSize: number}>}
 */
export async function renderTalkPage() {
  const tpl = readFileSync('site/talk.tpl.html', 'utf8');
  const engine = await bundleEngine();
  const html = tpl
    .replace('<!--__NAV__-->', '')
    .replace('/*__NAV_CSS__*/', '')
    .replace('/*__TOKENS_CSS__*/', () => TOKENS_CSS)
    .replace('/*__VOICES__*/', () => VOICES_JSON)
    .replace('/*__ENGINE__*/', () => safe(engine))
    .replace('__KIT_VERSION__', () => RETROTALK_VERSION);
  return { html, engineSize: engine.length };
}
