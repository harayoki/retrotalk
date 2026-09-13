// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 組み上がったデモとマニュアルのページを、載っている文を全部しゃべらせて
// 確かめます。
//
// 鳴っているかどうかは、出口を測らないと分かりません。読めない字は黙って
// 消えるので、文が全部消えても画面は何も言いません。
//
//   node check-talk.mjs [<パス>]
//
// パスを省くと docs/index.html を見ます。check-site.mjs は字を見るだけなので、
// 鳴るかどうかはこちらで見ます。

import { launchBrowser, startServer, watchPage } from './check-page.mjs';

const browser = await launchBrowser(['--autoplay-policy=no-user-gesture-required']);
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
const errs = watchPage(page);

// 写すところを試すための見本(会話が 2 つと、話者が 2 人入っています)
const SAMPLE_VVPROJ = 'test/sample.vvproj';

const server = await startServer(process.cwd(), 0);
const AT = process.argv[2] || '/docs/';
await page.goto(server.url + AT);

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
    window.__p = p;
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

// 全部しゃべらせる。波形はその場で作るので、長い文ほど作るのに時間がかかる
const n = await page.locator('.item .demo .play').count();
// 1 つめは空回ししておく。波形はその場で作るので、最初の再生は
// 作り終わるまで音が出ない。測るのはそのあと
await page.locator('.item .demo .play').first().click();
await page.waitForTimeout(1200);
await page.locator('.item .demo .play').first().click();
await page.waitForTimeout(200);
const quiet = [];
for (let i = 0; i < n; i++) {
  await page.locator('.item .demo .play').nth(i).click();
  // 何度か測って、いちばん大きいところを採る。
  // 文には間があるので、1 回だけ測ると句点のところで 0 に見える
  let lv = 0;
  for (let k = 0; k < 5; k++) {
    await page.waitForTimeout(260);
    lv = Math.max(lv, await level());
  }
  if (lv <= 0) quiet.push(i);
  await page.locator('.item .demo .play').nth(i).click();
  await page.waitForTimeout(150);
}
console.log('しゃべらせた文:', n, '/ 声が出なかったもの:', quiet.length ? quiet.join(',') : 'なし');
if (quiet.length) errs.push('声が出ない文: ' + quiet.join(','));

// 読めない字の例が、本当に消えること。
// ここが落ちなくなったら、ページの説明のほうが嘘になる
{
  const gone = await page.evaluate(async () => {
    const p = window.__p;
    const len = (text) => {
      p.defineTalk('__m__', text, { engine: 2 });
      p.playTalk('__m__');
      const got = p.talkDefs.get('__m__');
      p.stopTalk();
      return got && got.buffer ? got.buffer.length : 0;
    };
    // 数字と英字は読むほう。ここが消えたら、読ませた甲斐が無い
    return { kana: len('サンプン'), kanji: len('本日'), abc: len('CPU'), digit: len('35') };
  });
  console.log('読めない字:', JSON.stringify(gone));
  // 0 にはならない。読めない字だけの文でも、無音が少しだけ返る
  // (199 サンプル = 25 ミリ秒ほど)。カナと比べて桁が違うことを見る
  if (!(gone.kana > 1000)) errs.push('カナが読めていない: ' + gone.kana);
  if (gone.kanji * 5 > gone.kana) errs.push('漢字が落ちていない(ページの説明と食い違う)');
  if (gone.digit < gone.kanji * 5) errs.push('数字が読めていない: ' + gone.digit);
  if (gone.abc < gone.kanji * 5) errs.push('英字が読めていない: ' + gone.abc);
}

// 自分の文でしゃべらせる欄。上に置いたものなので、
// ここが黙っていると「壊れているページ」に見える
{
  await page.locator('#trytext').fill('テスト。');
  await page.locator('#trysay').click();
  let lv = 0;
  for (let k = 0; k < 5; k++) { await page.waitForTimeout(220); lv = Math.max(lv, await level()); }
  console.log('自分の文:', lv > 0 ? '鳴った' : '鳴らない', lv.toFixed(4));
  if (!(lv > 0)) errs.push('自分の文で鳴らない');
  // 声の選び分けも触っておきます。無ければ数が 0 になるので、ここで出ます。
  const voices = page.locator('#tryvoice option');
  const m = await voices.count();
  for (let i = 0; i < m; i++) {
    await page.locator('#tryvoice').selectOption({ index: i });
    await page.waitForTimeout(80);
  }
  console.log('声の選び分け:', m, '個');
  if (!m) errs.push('声の選び分けが無い');
  await page.waitForTimeout(400);
}

// .wav にして持って帰れること。
// アーティファクトの側では保存そのものが止められているので、
// 押して落ちないことと、中身が RIFF になっていることまで見る
{
  const got = await page.evaluate(() => {
    const { rate, data } = MmsxxRetroTalk.renderTalk('テスト。', { pitch: 250 });
    const b = MmsxxRetroTalk.encodeWAV({ sampleRate: rate, numberOfChannels: 1,
      length: data.length, getChannelData: () => data });
    const head = String.fromCharCode(...b.slice(0, 4)) + String.fromCharCode(...b.slice(8, 12));
    return { head, bytes: b.length, rate: new DataView(b.buffer).getUint32(24, true) };
  });
  console.log('WAV:', got.head, got.rate + 'Hz', (got.bytes / 1024).toFixed(1) + 'KB');
  if (got.head !== 'RIFFWAVE') errs.push('WAV の見出しが違う: ' + got.head);
  if (!(got.bytes > 1000)) errs.push('WAV が短すぎる: ' + got.bytes);
  // 1 回鳴らすまでは押せない。上で自分の文を鳴らしているので、ここでは押せる
  if (await page.locator('#trywav').isDisabled()) errs.push('鳴らしたのに WAV が押せない');
  await page.locator('#trywav').click();
  await page.waitForTimeout(300);
}

// 値をその場で変えられること。変えたら、上の JS も書き換わる。
//
// 1 つだけ見ても足りない。セクションにタグを付け忘れたり、コードを手で書いたりすると、
// その項目だけ黙って効かなくなる(2026-09-05 に `tuneStep` でそうなった)。
// パラメータのある項目を全部動かして、全部で JS が変わることまで見る
{
  // フリーフォームはパラメータの作りが別なので、そちらの検査に任せる
  const boxes = page.locator('.item:not(.free)').filter({ has: page.locator('.tune') });
  const n = await boxes.count();
  const dead = [];
  const stuck = [];
  let seen = 0;
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i);
    const name = (await box.locator('.syn').first().textContent()).trim();
    // JS を見せない項目もある(VOICEVOX の読み込み欄)。そこは見るものが無い
    const codes = await box.locator('.tagbox .code').count();
    if (!codes) continue;
    seen++;
    // 1 つの項目に組が何本もある。いちばん下の組を動かす
    const at = codes - 1;
    const before = await box.locator('.tagbox .code').nth(at).textContent();
    await box.locator('.tune').nth(at).locator('input, select').first()
      .evaluate((e) => {
        const fire = (k) => e.dispatchEvent(new Event(k, { bubbles: true }));
        if (e.tagName === 'SELECT') {
          e.selectedIndex = (e.selectedIndex + 1) % e.options.length;
          fire('change');
        } else if (e.type === 'checkbox') {
          e.checked = !e.checked;
          fire('change');
        } else {
          e.value = String(+e.value + (+e.step || 1) * 3);
          fire('input');
        }
      });
    await page.waitForTimeout(60);
    const after = await box.locator('.tagbox .code').nth(at).textContent();
    if (before === after) dead.push(name);
    await box.locator('.tune').nth(at).locator('.reset').first().click();
    await page.waitForTimeout(60);
    const back = await box.locator('.tagbox .code').nth(at).textContent();
    if (back !== before) stuck.push(name);
  }
  console.log('値を触る欄:', seen, '個 /',
    dead.length ? '効かない ' + dead.join(' / ') : '全部変わった', '/',
    stuck.length ? '戻らない ' + stuck.join(' / ') : 'Reset で戻る');
  if (!seen) errs.push('値を触る欄が無い');
  for (const x of dead) errs.push(`${x} は値を変えても JS が変わらない`);
  for (const x of stuck) errs.push(`${x} は Reset で元に戻らない`);
}

// パラメータが本当に音を変えること。
//
// JS の字が書き換わっても、音が変わっていないことがある。
// 歌わせているあいだの `pitch` がそれで、音符が高さを持っているので何もしない。
// 触れるのに何も起きないパラメータは、読む人には「壊れている」に見える。
// 端から端まで動かして、波形が 1 サンプルも変わらないものを落とす
{
  const dead = await page.evaluate(() => {
    const out = [];
    const ends = (k, now) => {
      const r = KNOB_RANGE[k];
      if (Array.isArray(r)) return [r[0], r[1]];
      if (r && r.list) return [r.list[0], r.list[r.list.length - 1]];
      if (KNOB_WORDS[k]) return [KNOB_WORDS[k][0], KNOB_WORDS[k][KNOB_WORDS[k].length - 1]];
      if (typeof now === 'boolean') return [false, true];
      return null;                          // 幅の分からないものは見ない
    };
    for (const d of DOC.filter((x) => x.say && x.opts)) {
      const name = typeof d.syn === 'string' ? d.syn : d.syn.ja;
      const lines = [[d.say, d.opts], ...(d.says || []).map((x) => (typeof x === 'string'
        ? [x, d.opts] : [x.say, x.opts || d.opts]))];
      for (const [text, opts] of lines) {
        for (const k of Object.keys(opts)) {
          const at = ends(k, opts[k]);
          if (!at) continue;
          const a = MmsxxRetroTalk.renderTalk(text, { ...opts, [k]: at[0] }).data;
          const b = MmsxxRetroTalk.renderTalk(text, { ...opts, [k]: at[1] }).data;
          let same = a.length === b.length;
          if (same) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
          if (same) out.push(name + ' の ' + k);
        }
      }
    }
    return out;
  });
  console.log('パラメータが音を変えるか:', dead.length ? '効かない ' + dead.join(' / ') : '全部効く');
  for (const x of dead) errs.push(`${x} は端まで動かしても音が変わらない`);
}

// 書き方を試す欄。書き換えると JS も変わって、そのとおりに鳴る
{
  const n = await page.locator('.trybox').count();
  const on = await page.locator('.trybox .play:not([disabled])').count();
  const first = page.locator('.trybox').first();
  await first.locator('textarea').fill("テストデ'ス。");
  await page.waitForTimeout(80);
  await first.locator('.play').click();
  // 短い文なので、すぐ測りはじめる。待ってから測ると、鳴り終わったあとを見てしまう
  let lv = 0;
  for (let k = 0; k < 8; k++) { await page.waitForTimeout(200); lv = Math.max(lv, await level()); }
  await first.locator('.play').click();
  console.log('書き方を試す欄:', n, '個 / 押せる', on,
    '/ 記号列', lv > 0 ? '鳴った ' + lv : '鳴らない');
  if (!on) errs.push('書き方を試す欄が押せない');
  if (!(lv > 0)) errs.push('記号列が鳴らない');
}

// VOICEVOX から写すところ。読めたかどうかを言うところまで見る。
// 黙って空になるのがいちばん困る(何が起きたのか分からない)
{
  const vv = page.locator('.loadbox');
  const boxes = await vv.locator('input[type=checkbox]').count();
  await vv.locator('input[type=file]').setInputFiles(SAMPLE_VVPROJ);
  await page.waitForTimeout(400);
  const msg = await vv.locator('.pickmsg').textContent();
  // 写した文はフリーフォームに入る。こちらには欄を置いていない
  const full = await page.locator('.item.free textarea').inputValue();
  for (let i = 0; i < boxes; i++) await vv.locator('input[type=checkbox]').nth(i).uncheck();
  await page.waitForTimeout(200);
  const bare = await page.locator('.item.free textarea').inputValue();
  console.log('VOICEVOX から写す:', boxes, '個選べる /', msg,
    '/ タグつき', full.includes('@p') ? 'あり' : 'なし',
    '/ 全部外すと', bare.includes('@') ? 'まだタグがある' : '読みだけ');
  if (!msg.includes('0.25.0')) errs.push('読んだ版が出ない: ' + msg);
  if (!full.includes('@p')) errs.push('高さが写らない');
  if (!bare || bare.includes('@')) errs.push('全部外してもタグが残る');
}

// 全部いじれる欄。ここが黙って壊れると、読み終えた人の行き場が無くなる
{
  const free = page.locator('.item.free');
  const knobs = await free.locator('.tune label').count();
  const wasOff = await free.locator('.wavlink').isDisabled();
  await free.locator('.play').click();
  let lv = 0;
  for (let k = 0; k < 8; k++) { await page.waitForTimeout(200); lv = Math.max(lv, await level()); }
  await free.locator('.play').click();
  const nowOn = !(await free.locator('.wavlink').isDisabled());
  // でたらめに散らして、戻せること
  const was = await free.locator('.code').textContent();
  await free.locator('.tune button').nth(1).click();      // ランダム(Reset の隣)
  await page.waitForTimeout(80);
  const rolled = await free.locator('.code').textContent();
  await free.locator('.tune button', { hasText: 'Reset' }).click();
  await page.waitForTimeout(80);
  const backTo = await free.locator('.code').textContent();
  console.log('フリーフォーム: パラメータ', knobs, '個 /', lv > 0 ? '鳴った ' + lv : '鳴らない',
    '/ WAV', wasOff && nowOn ? '鳴らしてから押せる' : 'おかしい',
    '/ Random', was !== rolled ? '散らばる' : '効かない',
    '/ Reset', backTo === was ? '戻る' : '戻らない');
  if (was === rolled) errs.push('Random で値が散らばらない');
  if (backTo !== was) errs.push('Random のあと Reset で戻らない');
  if (!(knobs >= 10)) errs.push('フリーフォームのパラメータが足りない: ' + knobs);
  if (!(lv > 0)) errs.push('フリーフォームが鳴らない');
  if (!(wasOff && nowOn)) errs.push('フリーフォームの WAV の出方がおかしい');
}

for (const sel of ['#lang button', '#theme button']) {
  const m = await page.locator(sel).count();
  for (let i = 0; i < m; i++) { await page.locator(sel).nth(i).click(); await page.waitForTimeout(60); }
  console.log(sel, m, '個押した');
}
console.log('画面のエラー欄:', await page.locator('#oops').isVisible() ? '出ている' : '出ていない');
if (errs.outside.length) console.log('外から取れなかった:', errs.outside.length, '件(字の形など。失敗として数えない)');
console.log('エラー:', errs.length ? errs : 'なし');

await browser.close();
await server.close?.();
process.exit(errs.length ? 1 : 0);
