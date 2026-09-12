// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// しゃべりを**耳の代わりに測る**道具。
//
// 「キャ」が「カ」に聞こえる、と言われても、こちらには耳が無い。
// 代わりに、音になる手前のフレーム列(`talkFrames`)を 2 つの言いかたで
// 取り出し、同じモーラのフォルマント(`param`、番地)がどれだけ離れているかを
// 数える。**区別が付いていないものは距離がほぼ 0 になる。**
// 直したあとに同じ数字が開けば、効いた証拠になる。
//
// 単位は番地で、1 番地 ≒ 95 セント(ほぼ半音)。
// 実機の 1 フレームの上限が 16 番地なので、2〜3 番地の差は
// 「十分に耳で分かる」くらいの目安になる。
//
// **これは補助。**最後に決めるのは、聴いた人の感想
// (`node tool/retrotalk/build-listen.mjs` が出すページで聴く)。

import { talkFrames } from '../src/talk.js';

/** 数字を 1 行にまとめる(表に出すとき用) */
export function fmtPair(label, r) {
  const n = (v) => (Number.isNaN(v) ? '  -  ' : v.toFixed(1).padStart(5));
  return `${label.padEnd(14)} head ${n(r.head)}  tail ${n(r.tail)}  whole ${n(r.whole)}`
    + `  peak ${n(r.peak)}  frames ${r.frames.join('/')}  voiced ${r.voiced.join('/')}`;
}

/** モーラ k の、鳴っているフレームだけ(無音・閉鎖・間は除く) */
export function moraFrames(text, k, opts) {
  return talkFrames(text, opts).filter((f) => f.mora === k && f.amp > 0);
}

/** 2 つのフレーム列の、同じ位置どうしの param の距離(番地)。短いほうの長さまで */
function distances(a, b) {
  const n = Math.min(a.length, b.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let s = 0; s < 5; s++) d += Math.abs(a[i].param[s] - b[i].param[s]);
    out.push(d);
  }
  return out;
}

/** 上の平均。**ならすと、1 フレームだけの違いは薄まる**(そこは `paramPeak` で見る) */
export function paramDistance(a, b) {
  const d = distances(a, b);
  return d.length ? d.reduce((s, v) => s + v, 0) / d.length : NaN;
}

/**
 * いちばん離れているフレームの距離。
 *
 * **破裂音はこちらで見る。**破裂の本体は 1 フレームしかないので、
 * 11 フレームの母音と一緒にならすと、違いが 5 分の 1 以下に薄まる。
 * 「どこかの瞬間に、これだけ違う」が知りたいときはこちら。
 */
export function paramPeak(a, b) {
  const d = distances(a, b);
  return d.length ? Math.max(...d) : NaN;
}

/**
 * 最小対を測る。同じ位置のモーラ k を突き合わせる。
 *
 *   head   出だし 5 フレームの距離。子音と、母音への遷移がここに居る
 *   tail   終わり 5 フレームの距離。母音の定常部
 *   whole  鳴っている全フレームの距離(ならしたもの)
 *   peak   いちばん離れているフレームの距離。**破裂音はここを見る**
 *   frames 鳴っているフレーム数 [A, B]
 *   voiced 有声のフレーム数 [A, B]
 *
 * @param {string} a 言いかた A
 * @param {string} b 言いかた B
 * @param {number} k 突き合わせるモーラ(parseTalk の添字。既定 0)
 * @param {object} [opts] renderTalk と同じ
 */
export function measurePair(a, b, k = 0, opts = {}) {
  const fa = moraFrames(a, k, opts), fb = moraFrames(b, k, opts);
  const head = (f) => f.slice(0, 5);
  const tail = (f) => f.slice(-5);
  return {
    head: paramDistance(head(fa), head(fb)),
    tail: paramDistance(tail(fa), tail(fb)),
    whole: paramDistance(fa, fb),
    peak: paramPeak(fa, fb),
    frames: [fa.length, fb.length],
    voiced: [fa.filter((f) => f.voiced).length, fb.filter((f) => f.voiced).length],
  };
}

/** 1 つの言いかたの、モーラ k の有声フレーム数。無声化を見るのに使う */
export function voicedFrames(text, k, opts = {}) {
  return moraFrames(text, k, opts).filter((f) => f.voiced).length;
}

