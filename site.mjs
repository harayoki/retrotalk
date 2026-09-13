#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// GitHub Pages が出すページを docs/ に組み立てます。
//
//   docs/index.html         デモとマニュアル
//   docs/listen/index.html  声の聴き比べ
//   docs/s/index.html       送られたリンクを開くところ
//   docs/ogp.png            貼られたときに出る絵
//
// docs/api/ は docs.mjs が書きます。ここでは触りません。

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync }
  from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { renderTalkPage } from './site/build-talk.mjs';
import { renderListenPage } from './site/build-listen.mjs';
import { renderSharePage } from './site/build-share.mjs';

const OUT = 'docs';

// 型紙には書いていない頭です。置くだけの場所には枠が無いので、これが無いと
// 文字コードを当てにいかれて日本語が化けます。
const HEAD = '<!doctype html>\n<meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">\n';

// 貼られたときに出る絵と行き先は、外から読みにくるので相対では届きません。
const SITE = 'https://harayoki.github.io/retrotalk/';
const CARD = 'ogp.png';
const TITLE = 'RetroTalk';
const LEAD = '80 年代のパソコンのような声で、書いた言葉をしゃべります。';

/**
 * 貼られたときに出るカード。付けるのは送られたリンクのほう(`s/`)だけです。
 * 絵の寸法は 1200x630 で、どちらもこの比で切ります。
 *
 * @param {string} at ページの場所(`SITE` からの続き)
 * @returns {string}
 */
const card = (at) => [
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${SITE}${at}">`,
  `<meta property="og:title" content="${TITLE}">`,
  `<meta property="og:description" content="${LEAD}">`,
  `<meta property="og:image" content="${SITE}${CARD}">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:title" content="${TITLE}">`,
  `<meta name="twitter:description" content="${LEAD}">`,
  `<meta name="twitter:image" content="${SITE}${CARD}">`,
].join('\n');

/**
 * 型紙のコメントを落とします。日本語で書いてあるのは組む人のためのもので、
 * 配る先で読ませるものではありません。
 *
 * 自分で切ると文字列の中の `//` まで切ってしまうので、縮めさせます。書き直させる
 * だけでは、書いたものにくっついたコメントが残ります。縮めると全部落ちます。
 *
 * @param {string} html
 * @returns {Promise<string>}
 */
async function strip(html) {
  const out = [];
  let at = 0;
  for (const m of html.matchAll(/<(script|style)([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const [all, tag, attrs, body] = m;
    // 外から読むものは中身がありません(`<script src=...>`)
    const done = body.trim()
      ? (await esbuild.transform(body, {
        loader: tag === 'style' ? 'css' : 'js', charset: 'utf8', minify: true,
      })).code.trim()
      : body;
    out.push(html.slice(at, m.index), `<${tag}${attrs}>\n`, done, `\n</${tag}>`);
    at = m.index + all.length;
  }
  out.push(html.slice(at));
  return out.join('').replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
}

// 毎回まっさらにします。前に出したものが残っていると、消したはずのファイルが
// 上がり続けます。.nojekyll と api/ はここが作ったものではないので残します。
for (const name of existsSync(OUT) ? readdirSync(OUT) : []) {
  if (name === '.nojekyll' || name === 'api') continue;
  rmSync(join(OUT, name), { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

writeFileSync(join(OUT, 'index.html'), HEAD + await strip((await renderTalkPage()).html));

mkdirSync(join(OUT, 'listen'), { recursive: true });
writeFileSync(join(OUT, 'listen', 'index.html'),
  HEAD + await strip((await renderListenPage()).html));

// カードは先に差し込みます。あとにすると、コメントを落とすところが差し込み口ごと
// 消してしまいます。
mkdirSync(join(OUT, 's'), { recursive: true });
const share = await renderSharePage();
writeFileSync(join(OUT, 's', 'index.html'),
  HEAD + await strip(share.html.replace('<!--__CARD__-->', () => card('s/'))));

copyFileSync(join('site', CARD), join(OUT, CARD));

for (const name of ['index.html', CARD, join('listen', 'index.html'), join('s', 'index.html')]) {
  console.log(join(OUT, name), (statSync(join(OUT, name)).size / 1024).toFixed(0) + 'KB');
}
