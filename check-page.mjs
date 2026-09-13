// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// check-talk.mjs と check-listen.mjs が使う、ブラウザと静的サーバです。
//
// 立ち上げの引数は動かす場所によって要り方が変わります。手元の Windows では
// 何も要りませんが、コンテナでは付けないと立ち上がりません。2 か所に書くと
// 片方だけ直して片方が消えるので、ここに 1 つ置いています。

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 依存ゼロの静的サーバを立てます。file:// からは ES モジュールが読めないので、
 * ページを開くには http が要ります。
 *
 * @param {string} root 見せるところ
 * @param {number} [port] 0 なら空いているものを勝手に選びます
 * @returns {Promise<{url: string, port: number, close: () => Promise<void>}>}
 */
export function startServer(root, port = 0) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    // 末尾が / なら、その下の index.html を返します。置くだけの場所はそうして
    // くれるので、手元だけ 404 になると出す前に気づけません。
    if (path.endsWith('/')) path += 'index.html';
    // 見せるところから外へ出しません。resolve したうえで前方一致を見ます。
    const file = resolve(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      const { port: got } = server.address();
      done({
        url: `http://127.0.0.1:${got}`,
        port: got,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/**
 * 画面の無いブラウザを立てます。
 *
 * --no-sandbox は、コンテナが root で動くためです。Chromium は root では
 * サンドボックスを作れずに立ち上がりません。ここで開くのは自分で立てた localhost だけ
 * なので、外して差し支えありません。
 *
 * --disable-dev-shm-usage は、コンテナの /dev/shm が 64MB しか無いことが多く、
 * 足りなくなると途中で消えるためです。
 *
 * channel を指しているのは、既定の headless shell では音が鳴らないためです。
 * 波形を測るので、Web Audio の動くふつうの Chromium が要ります。
 *
 * @param {string[]} [extra] 足したい引数(音を鳴らす許可など)
 * @returns {Promise<import('playwright').Browser>}
 */
export async function launchBrowser(extra = []) {
  const { chromium } = await import('playwright');
  return chromium.launch({
    channel: 'chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...extra],
  });
}

/**
 * ページが上げた声を拾います。
 *
 * ページは字の形を Google Fonts から取っています。コンテナはそこへ出られない
 * ので毎回 1 本エラーが立ちますが、それでページが消えるわけではありません
 * (手元の字で出ます)。かわりに、自分で立てたところから取れなかったものは
 * 失敗として数えます。こちらは埋め込み漏れなので、見逃すと画面が半分死にます。
 *
 * @param {import('playwright').Page} page
 * @returns {string[]} 失敗が溜まります。空なら無事です
 */
export function watchPage(page) {
  const errs = [];
  const outside = [];
  page.on('pageerror', (e) => errs.push('例外: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // 取れなかった話は URL が出ないので、下の requestfailed のほうで見ます
    if (m.text().startsWith('Failed to load resource')) return;
    errs.push('console: ' + m.text());
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u)) errs.push('取れなかった: ' + u);
    else outside.push(u);
  });
  errs.outside = outside;
  return errs;
}
