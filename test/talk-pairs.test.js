// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 日本語の最小対が**区別できているか**を、フレームの距離で見る。
//
// 耳の代わり。狙いは docs/ENGINE_TODO.md の「日本語が変なところを直す」の 3 つ —
//   1. 拗音が潰れる(キャ が カ)
//   2. 母音の無声化が無い(デス が デスゥ)
//   3. 撥音が 1 種類(ンマ も ンカ も同じ ン)
//
// **まだ直していないものは `todo` で置いてある。**直したら todo を外す。
// 距離が 0 のまま todo を外すと落ちるので、そこが回帰になる。
// いま通っている側(母音どうし・子音どうしの区別)は、直したときに
// **巻き添えで潰れていないか**を見張る。
//
// 3 つとも入った(2026-09-03)。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  measurePair, moraFrames, paramDistance, voicedFrames, fmtPair,
} from './talk-measure.js';

/** 「これだけ離れていれば別の音」の目安(番地。1 番地 ≒ 95 セント) */
const APART = 2;

/** いま区別できているもの。直したときに潰れないこと */
test('母音どうし・摩擦音どうしは区別できている', (t) => {
  const rows = [
    ['ア/イ', measurePair('ア', 'イ')],
    ['キ/カ', measurePair('キ', 'カ')],       // 母音が違うので当然離れる
    ['シュ/ス', measurePair('シュ', 'ス')],   // sh と s はノイズの色が違う
    ['チョ/ト', measurePair('チョ', 'ト')],   // ch(摩擦 5 フレーム)と t(破裂 1 フレーム)
    ['シ/ヒ', measurePair('シ', 'ヒ')],
  ];
  for (const [label, r] of rows) t.diagnostic(fmtPair(label, r));
  assert.ok(rows[0][1].tail > APART, 'ア と イ の母音は離れている');
  assert.ok(rows[1][1].head > APART, 'キ と カ の出だしは離れている');
  assert.ok(rows[2][1].head > APART, 'シュ と ス の出だしは離れている');
  assert.ok(rows[3][1].head > APART, 'チョ と ト の出だしは離れている');
  assert.ok(rows[4][1].head > APART, 'シ と ヒ の出だしは離れている');
});

/**
 * 破裂音の場所(カ = 奥 / タ = 先 / パ = 唇)が分かれているか。
 *
 * **`peak` で見る。**破裂の本体は 1 フレームしかなく、そのあとの息も 2〜3
 * フレームなので、11 フレームの母音と一緒にならすと違いが薄まる
 * (直したあとでも `whole` は 0.7 にしかならない。`peak` は 8.6)。
 *
 * 2026-09-03 に「カ。タ。パ。がほぼ全部同じ」と聴いて分かったところ。
 * そのときは peak も 0 だった — 閉鎖のあいだ口が止まっていて、
 * **息のかわりに無音が入っていた**ので、口が動く音がどこにも出ていなかった。
 */
test('破裂音は場所ごとに分かれている', (t) => {
  const rows = [
    ['カ/タ', measurePair('カ', 'タ')],
    ['カ/パ', measurePair('カ', 'パ')],
    ['タ/パ', measurePair('タ', 'パ')],
    // 母音のあと。**語頭より難しい**(直前の母音から動くので、行き先が近くなる)
    ['アカ/アタ', measurePair('アカ', 'アタ', 1)],
    ['アカ/アパ', measurePair('アカ', 'アパ', 1)],
    ['アタ/アパ', measurePair('アタ', 'アパ', 1)],
    // 有声のほう。息が漏れないので、口の動きは母音の出だしで聞こえる
    ['ガ/ダ', measurePair('ガ', 'ダ')],
    ['ガ/バ', measurePair('ガ', 'バ')],
    ['ダ/バ', measurePair('ダ', 'バ')],
  ];
  for (const [label, r] of rows) t.diagnostic(fmtPair(label, r));
  for (const [label, r] of rows) assert.ok(r.peak > APART * 2, `${label} は離れている`);
  // **息が入っていること。**無音に戻すと peak が 0 に落ちる
  const ka = moraFrames('カ', 0);
  assert.ok(ka.some((f) => f.noise && !f.voiced && f.amp > 0 && f.amp < 12),
    'カ には破裂のあとの息がある');
});

/**
 * **手前の母音でも場所が分かるか。**
 *
 * 上の試験は子音そのものを見ているが、それだけでは足りなかった —
 * 「カ。タ。パ。」は聞き分けられたのに、
 * **「アカ。アタ。アパ。」が 3 つとも同じに聞こえた**(2026-09-03)。
 * 破裂と息は母音より 15dB 小さいので、大きな母音のあとでは埋もれる。
 *
 * 人が使っているのは**母音の終わりが曲がる音**のほう。声のまま、
 * 母音の大きさで鳴るので、いちばんよく聞こえる。
 * ここが平らなままだと、口の動きは全部**閉鎖の無音の中**で起きる。
 */
test('母音の終わりが、次の子音へ向かって曲がる', (t) => {
  const rows = [
    ['アカ/アタ', measurePair('アカ', 'アタ', 0)],
    ['アカ/アパ', measurePair('アカ', 'アパ', 0)],
    ['アタ/アパ', measurePair('アタ', 'アパ', 0)],
    ['アマ/アナ', measurePair('アマ', 'アナ', 0)],   // 鼻音どうし
  ];
  for (const [label, r] of rows) t.diagnostic(fmtPair(label, r));
  for (const [label, r] of rows) assert.ok(r.tail > APART, `${label} の手前のアが違う`);
  // **曲がるのは終わりだけ。**母音の芯まで動くと、別の母音に聞こえる
  for (const [label, r] of rows) assert.equal(r.head, 0, `${label} の出だしは同じ`);
  // **曲がっているあいだも声。**無音や息に落とすと、そこが聞こえなくなる
  const bend = moraFrames('アカ', 0).slice(-2);
  assert.ok(bend.every((f) => f.voiced && f.amp >= 12), 'アカ の ア は声のまま曲がる');
});

/**
 * 1. 拗音。**子音と母音のあいだに渡りが入る**(`キャ` は `カ` の母音違いではない)。
 *
 * **`peak` で見る。**渡りは 2 フレームしかないので、11 フレームの母音と
 * ならすと薄まる(`ミャ`/`マ` は `head` だと 2.5 にしかならない)。
 */
test('拗音は直音と区別できる', (t) => {
  const pairs = [
    ['キャ', 'カ'], ['キュ', 'ク'], ['キョ', 'コ'], ['ギャ', 'ガ'],
    ['ニャ', 'ナ'], ['ヒャ', 'ハ'], ['ミャ', 'マ'], ['リャ', 'ラ'],
    ['ピャ', 'パ'], ['ビャ', 'バ'],
    ['キュー', 'クー'],   // 数字の 9 と英字の Q が通る口
  ];
  for (const [a, b] of pairs) {
    const r = measurePair(a, b);
    t.diagnostic(fmtPair(`${a}/${b}`, r));
    assert.ok(r.peak > APART * 2, `${a} と ${b} が離れている`);
  }
  // **もともと硬口蓋の子音には渡りを入れない。**`シャ` は `サ` と
  // 子音そのものが違うので、拗音が潰れる話の外だった
  const sha = moraFrames('シャ', 0), sa = moraFrames('サ', 0);
  assert.equal(sha.length, sa.length, 'シャ に渡りは入っていない');
  // **1 拍は 1 拍。**渡りのぶんだけ母音を詰めるので、長さは直音と変わらない
  assert.equal(moraFrames('キャ', 0).length, moraFrames('カ', 0).length,
    'キャ と カ の長さは同じ');
});

/**
 * 2. 無声化。**無声子音に挟まれた `i` `u` と、無声子音のあとで句が終わる `i` `u`**
 * は、口の形だけ作って声を出さない。
 *
 * 落ちるほうと**落ちないほう**を両方見る。落とし過ぎると言葉が消える。
 */
test('無声子音に挟まれた i / u は無声化する', (t) => {
  const off = [
    ['デス の ス', voicedFrames('デス', 1)],          // 句末
    ['シタ の シ', voicedFrames('シタ', 0)],          // sh と t に挟まれる
    ['マス の ス', voicedFrames('マス', 1)],
    ['スキ の ス', voicedFrames('スキ', 0)],
    ['ワカリマシタ の シ', voicedFrames('ワカリマシタ', 4)],
  ];
  const on = [
    ['スミ の ス', voicedFrames('スミ', 0)],          // 次が m。声を出す子音の前
    ['デスー の スー', voicedFrames('デスー', 1)],    // 伸ばしている
    ['シツレイ の ツ', voicedFrames('シツレイ', 1)],  // 直前の シ が落ちている
    ['ミズ の ミ', voicedFrames('ミズ', 0)],          // 子音が m。無声子音ではない
  ];
  for (const [label, n] of [...off, ...on]) t.diagnostic(`${label.padEnd(18)} voiced ${n}`);
  for (const [label, n] of off) assert.ok(n <= 3, `${label} はほぼ鳴らない`);
  for (const [label, n] of on) assert.ok(n > 5, `${label} は鳴る`);
});

/**
 * 3. 撥音。**次の子音と同じ場所で作る**(`ンマ` は唇、`ンカ` は舌の奥、`ンタ` は舌の先)。
 *
 * こちらは `tail` で見る。ン は 11 フレームまるごと違うので、薄まらない。
 */
test('撥音は次の子音で変わる', (t) => {
  const rows = [
    ['サンマ/サンカ', measurePair('サンマ', 'サンカ', 1)],
    ['サンマ/サンタ', measurePair('サンマ', 'サンタ', 1)],
    ['サンカ/サンタ', measurePair('サンカ', 'サンタ', 1)],
    ['シンブン/シンダン', measurePair('シンブン', 'シンダン', 1)],
  ];
  for (const [label, r] of rows) t.diagnostic(fmtPair(label, r));
  for (const [label, r] of rows) assert.ok(r.tail > APART, `${label} の ン は離れている`);
  // **語末の ン は変わらない。**向かう先が無いので、奥で鼻へ抜けるだけ
  const end = measurePair('サンマ', 'サンカ', 1, {});
  assert.ok(end.tail > APART, '語中の ン は変わる');
  assert.equal(paramDistance(moraFrames('ホン', 1), moraFrames('ホン。', 1)), 0,
    '語末の ン は句点があっても同じ');
});
