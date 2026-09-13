// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 組み上がった聴き比べのページを、載っている文を全部鳴らして確かめます。
//
// 鳴っているかどうかは、出口を測らないと分かりません。読めない字は黙って
// 消えるので、文が全部消えても画面は何も言いません。
//
//   node check-listen.mjs [<パス>]
//
// パスを省くと docs/listen/index.html を見ます。このページはエンジンを埋めて、
// 押されたときに波形を作る作りなので、埋め込みが壊れれば全部黙ります。
// そこが黙って壊れるのがいちばん困ります。

import { launchBrowser, startServer, watchPage } from './check-page.mjs';

const browser = await launchBrowser(['--autoplay-policy=no-user-gesture-required']);
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = watchPage(page);

const server = await startServer(process.cwd(), 0);
await page.goto(server.url + (process.argv[2] || '/docs/listen/'));

console.log('見出しの数:', await page.locator('h2').count());
console.log('項目の数:', await page.locator('.item').count());
console.log('検査の帯:', (await page.locator('.probe').innerText()).split('\n').join(' | '));

// 出口へ解析器を挿す仕掛けを置く(最初の再生でページが呼んでくれる)
await page.evaluate(() => {
  const was = window.__probe;
  window.__probe = (p) => {
    if (was) was(p);
    const an = p.ctx.createAnalyser();
    an.fftSize = 2048;
    p._master.connect(an);
    window.__an = an;
    window.__buf = new Float32Array(an.fftSize);
  };
});
const level = () => page.evaluate(() => {
  if (!window.__an) return -1;
  window.__an.getFloatTimeDomainData(window.__buf);
  let m = 0;
  for (const v of window.__buf) m = Math.max(m, Math.abs(v));
  return +m.toFixed(4);
});

// 全部鳴らす。波形はその場で作るので、長い文ほど作るのに時間がかかる
const n = await page.locator('.play').count();
// 1 つめは空回ししておく。最初の再生は作り終わるまで音が出ない。測るのはそのあと
await page.locator('.play').first().click();
await page.waitForTimeout(1200);
await page.locator('.play').first().click();
await page.waitForTimeout(200);
const quiet = [];
for (let i = 0; i < n; i++) {
  await page.locator('.play').nth(i).click();
  // 何度か測って、いちばん大きいところを採る。文には間があるので、
  // 1 回だけ測ると句点のところで 0 に見える
  let lv = 0;
  for (let k = 0; k < 5; k++) {
    await page.waitForTimeout(260);
    lv = Math.max(lv, await level());
  }
  if (lv <= 0) quiet.push(i + 1);
  await page.locator('.play').nth(i).click();
  await page.waitForTimeout(120);
}
console.log('鳴らした文:', n, '/ 声が出なかったもの:', quiet.length ? quiet.join(',') : 'なし');
if (quiet.length) errs.push('声が出ない文: ' + quiet.join(','));

// 絵が出ていること。鳴らした文の下に、大きさ・音源・口の形を描く。描けていなければ
// canvas は地の色だけになる(墨のドットが 1 つも無い)。
// 出ているのは 1 枚だけ。別の文を鳴らすと前の絵は閉じるので、
// ここで見るのは「最後に鳴らした文の絵が描けているか」と「閉じる」が効くか
{
  const look = () => page.evaluate(() => {
    const pics = [...document.querySelectorAll('.pic.on canvas')];
    const inked = pics.filter((c) => {
      const g = c.getContext('2d');
      const px = g.getImageData(0, 0, c.width, c.height).data;
      let dots = 0;
      for (let i = 0; i < px.length; i += 4 * 97) if (px[i + 3] > 0) dots++;
      return dots > 20 && c.width > 30;
    });
    return { pics: pics.length, inked: inked.length };
  });
  await page.locator('.play').first().click();
  await page.waitForTimeout(700);
  await page.locator('.play').first().click();
  const drawn = await look();
  console.log('出ている絵:', drawn.pics, '枚 / 描けているもの:', drawn.inked);
  if (drawn.pics !== 1) errs.push(`出ている絵は 1 枚のはず(${drawn.pics} 枚)`);
  if (drawn.inked !== drawn.pics) errs.push('絵が描けていない');
  // 閉じられること。一度出ると消せなかったので付けた
  await page.locator('.pic.on .close').click();
  await page.waitForTimeout(120);
  const shut = await look();
  console.log('閉じたあと:', shut.pics, '枚');
  if (shut.pics) errs.push('「閉じる」で絵が消えない');
}

// 組み替え方のパラメータが効くこと。1 つ動かして鳴らし、既定と違う波形が出る
{
  const sel = await page.locator('#asm select').count();
  console.log('組み替え方のパラメータ:', sel, '個');
  if (!sel) errs.push('組み替え方のパラメータが無い');
  const line = n;                                   // 最後の行(カ。ガ。)
  const before = await page.evaluate(() => {
    const c = document.querySelectorAll('.item')[document.querySelectorAll('.item').length - 1]._pic;
    return c ? c.data.length : 0;
  });
  await page.locator('#asm select[data-key="voicedGap"]').selectOption('1');
  await page.locator('.play').nth(line - 1).click();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const items = document.querySelectorAll('.item');
    const li = items[items.length - 1];
    return { len: li._pic ? li._pic.data.length : 0, cap: li.querySelector('.cap').textContent };
  });
  await page.locator('.play').nth(line - 1).click();
  console.log('パラメータを動かして鳴らした:', before, '→', after.len, 'サンプル /', after.cap);
  if (!after.cap.includes('動かした')) errs.push('パラメータを動かしても絵に反映されない');
  await page.locator('#asm button').click();       // Reset
  // innerText は CSS の大文字化を拾うので、書いた字のほう(textContent)で見る
  const head = await page.locator('#asm .head b').textContent();
  console.log('Reset のあと:', head);
  if (!head.includes('既定')) errs.push('Reset で既定に戻らない');
}

// エンジンが本当に埋まっていること。埋め込みが壊れると、
// ここで名前ごと消える(押しても何も起きないページになる)
{
  const got = await page.evaluate(() => ({
    ver: window.MmsxxRetroTalk && window.MmsxxRetroTalk.VERSION,
    render: !!(window.MmsxxRetroTalk && window.MmsxxRetroTalk.renderTalk),
  }));
  console.log('埋めたエンジン:', got.ver || '(バージョンが読めない)',
    got.render ? '/ renderTalk あり' : '');
  if (!got.render) errs.push('エンジンが埋まっていない');
}

for (let i = 0; i < await page.locator('#theme button').count(); i++) {
  await page.locator('#theme button').nth(i).click();
  await page.waitForTimeout(60);
}
console.log('画面のエラー欄:', await page.locator('#oops').isVisible() ? '出ている' : '出ていない');
if (errs.outside.length) console.log('外から取れなかった:', errs.outside.length, '件(字の形など。失敗として数えない)');
console.log('エラー:', errs.length ? errs : 'なし');

await browser.close();
await server.close?.();
process.exit(errs.length ? 1 : 0);
