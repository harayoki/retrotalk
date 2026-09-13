#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// docs/ に組み上がったものを、出す前に見ます。目で拾えない食い違いだけを
// 機械に見せます。
//
//   node check-site.mjs        docs/ を見ます
//   --out <dir> で見る先を変えられます
//   -v で通ったものも出します
//
// 足すのは一度やらかしたことだけにします。増えるほど通すのが作業になり、
// 赤が出ても読まなくなります。

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const { RETROTALK_VERSION } = await import('./src/version.js');

const args = process.argv.slice(2);
const at = args.indexOf('--out');
const DIR = at >= 0 ? args[at + 1] : 'docs';

const LOUD = args.includes('-v');
const bad = [];
let seen = 0;

/**
 * 1 件ぶんの結果を出します。既定では通らなかったものしか出しません。
 * 全部並べると、赤があっても流れていきます。
 *
 * @param {boolean} ok
 * @param {string} what
 * @param {string} [detail]
 */
const say = (ok, what, detail) => {
  seen++;
  if (!ok || LOUD) console.log(`${ok ? '  ok ' : '  NG '} ${what}${detail ? '  ' + detail : ''}`);
  if (!ok) bad.push(what);
};

/** 見出しです。通ったものを出すときだけ出します。 */
const head = (t) => { if (LOUD) console.log(t); };

// ---- 出したものが揃っているか -----------------------------------------
head('出したもの');
say(existsSync(DIR), `${DIR} がある`);
if (!existsSync(DIR)) done();

// 配るものはリリースページで渡します。置き場に zip が残っていると、
// 古いものがそのまま配られ続けます。
const stale = readdirSync(DIR).filter((f) => f.endsWith('.zip'));
say(stale.length === 0, '置き場に zip が残っていない', stale.join(' ') || 'なし');

for (const f of ['index.html', join('s', 'index.html'), 'ogp.png',
  join('api', 'index.html'), join('listen', 'index.html')]) {
  say(existsSync(join(DIR, f)), `${f} がある`);
}

// 受け取る先です。書き間違えても画面には出ないので、字で見ます。
if (existsSync(join(DIR, 'index.html'))) {
  const s = readFileSync(join(DIR, 'index.html'), 'utf8');
  say(s.includes('https://github.com/harayoki/retrotalk/releases'),
    'index.html がリリースページへ送っている');
  say(s.includes(`v${RETROTALK_VERSION}`), 'index.html にバージョンが出ている',
    `v${RETROTALK_VERSION}`);
}

// ---- 出してはいけないものが残っていないか -----------------------------
head('中身');
for (const f of ['index.html', join('s', 'index.html'), join('listen', 'index.html')]) {
  const p = join(DIR, f);
  if (!existsSync(p)) continue;
  const s = readFileSync(p, 'utf8');
  // 見るのは /* */ の数です。縮めればブロックのコメントは 1 つも残りません。
  // テンプレートには 50 個以上あるので、組まずに出したらここで出ます。
  //
  // // は数えません。ページには渡し方の見本が載っていて、その中に読ませる
  // ための日本語コメントが入っています。字面では見分けが付きません。
  const block = (s.match(/\/\*/g) || []).length;
  say(block === 0, `${f} を縮めてある`, `/* が ${block} 個`);
  say(!s.includes('localhost') && !s.includes('127.0.0.1'), `${f} に手元の URL が入っていない`);
}

// 貼られたときに出る絵です。出るのは貼られたときだけなので、壊れていても
// 気づけません。
const png = join(DIR, 'ogp.png');
if (existsSync(png)) {
  const b = readFileSync(png);
  say(b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630, '絵が 1200x630',
    `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
}

done();

function done() {
  if (bad.length) {
    console.error(`[check] ${seen} 件のうち ${bad.length} 件が通らない`);
    process.exit(1);
  }
  console.log(`[check] ${seen} 件、通った`);
  process.exit(0);
}
