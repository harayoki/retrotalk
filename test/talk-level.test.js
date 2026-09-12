// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// **どの文でも、同じ大きさで聞こえること。**
//
// 声が小さくなる文があった(2026-09-04)。音量をそろえるところが
// 「鳴っている」の線を 0.02 と決め打ちにしていたので、**そろえる前の波形が
// 小さい文ほど線を越えるサンプルが減り**、大きいところだけの平均になっていた。
// そのぶん掛ける倍率が小さく出て、文と設定で 3.8dB も差が出ていた。
//
// **耳では気づけても、原因は数でしか分からない。**ここで押さえておく。

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTalk, TALK_DEFAULTS } from '../src/talk.js';

/** 鳴っているところの平均。**線は全体の平均から引く**(本体と同じ測り方) */
function level(data) {
  let peak = 0, all = 0;
  for (const v of data) { peak = Math.max(peak, Math.abs(v)); all += v * v; }
  const gate = Math.sqrt(all / data.length) * 0.5;
  let sum = 0, cnt = 0;
  for (const v of data) {
    if (Math.abs(v) > gate) { sum += v * v; cnt++; }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, cnt)) };
}

/** 文と設定の組み合わせ。**声の出かたが違うものを並べる** */
const CASES = [
  ['アアアア。', {}],
  ['ハッシャ！', {}],                     // 破裂音で山が立つ
  ['ギュウニュウ。', {}],                 // 有声の破裂と拗音
  ['シ。', {}],                           // 1 モーラだけ
  ['ドウシヨウ…。', {}],                  // 言いさし(弱く消える)
  ['コンニチワ。ソレデワ マタ アイマショウ。', {}],
  ['アアアア。', { ring: 55 }],           // 掛け合わせで波形が小さくなる
  ['アアアア。', { jitter: 0.5 }],
  ['アアアア。', { breath: 0.8 }],
  ['サクラサクラ', { sing: 't120 l4 o3 g g a2 g g a2' }],
  ['ワタシワ ロボット デス。', { style: 'natural' }],
  // **破裂音で山が立つ文。**山を避けて文まるごとを下げていたころ、
  // ここが 4dB 沈んでいた(2026-09-04)
  ['ワタシハ ガッコウヘ イキマス。ワタシワ ガッコウエ イキマス。', {}],
  ['オナジ タカサデモ ベツジンニ ナリマス', { pitch: 250, formantShift: 5 }],
];

/**
 * その設定で狙う大きさ。**本体と同じ組み立て**にしてある —
 * 書かなかったときの音量(`volume`)を掛け、**細い声のぶんだけ持ち上げる**
 */
function aimOf(opts) {
  const D = TALK_DEFAULTS;
  const up = Math.max(0, (opts.formantShift ?? D.formantShift) - D.formantShift);
  return (opts.level ?? D.level) * (1 + Math.min(0.6, up * 0.1)) * ((opts.volume ?? D.volume) / 15);
}

test('どの文でも、鳴っているところの平均が狙いに乗る', () => {
  for (const [text, opts] of CASES) {
    const { rms } = level(renderTalk(text, opts).data);
    const dB = 20 * Math.log10(rms / aimOf(opts));
    assert.ok(Math.abs(dB) < 1,
      `${text} ${JSON.stringify(opts)} が ${dB.toFixed(1)}dB ずれている`);
  }
});

test('文と設定で聞こえる大きさが変わらない', () => {
  const got = CASES.map(([text, opts]) =>
    level(renderTalk(text, opts).data).rms / aimOf(opts));
  const dB = 20 * Math.log10(Math.max(...got) / Math.min(...got));
  assert.ok(dB < 1.5, `文によって ${dB.toFixed(1)}dB 違う`);
});

/**
 * **粗く量子化したものは、別扱い。**
 *
 * 段に丸めるのは**そろえたあと**なので、小さいサンプルが段へ跳ね上がって
 * 平均が持ち上がる(4 ビットで 0.18 あたり)。**それがこの声の粗さ**なので、
 * ここで押し戻すことはしない。割れていないことだけ見る
 */
const CRUSHED = [
  ['アアアア。', { bits: 4 }],
  ['コンニチワ。', { bits: 5, frame: 0.02 }],
];

test('そろえたあとも割れない', () => {
  for (const [text, opts] of [...CASES, ...CRUSHED]) {
    const { peak } = level(renderTalk(text, opts).data);
    assert.ok(peak <= 1, `${text} の山が ${peak.toFixed(2)} で割れている`);
  }
});
