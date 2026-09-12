// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// AquesTalk 風の記号列を読み取ります。
//
// カタカナの読みに、アクセントの位置と無声化する拍を記号で書き添えた形式です。
// この 2 つは辞書が無いと決められないので、書く人から記号で受け取ります。
// VOICEVOX の /audio_query が返す kana も同じ形式なので、そのまま渡せます。
//
// 記号の一覧
//
// | 記号 | 意味 |
// | --- | --- |
// | カタカナ | 読み。ひらがなでも動きます（内部で揃えます） |
// | `'` | アクセント核。その拍の直後で音が下がります。1 アクセント句に 1 つまで |
// | `/` | アクセント句の区切り。間は空きません |
// | `、` `,` | アクセント句の区切り。短い間が空きます |
// | `;` | アクセント句の区切り。長めの間が空きます |
// | `+` | 前の句に続けます。切らずに 1 つの句として読みます |
// | `_` | 無声化。次の 1 拍を息だけにします |
// | `。` `？` `！` | 文の終わり。間を置いて、音の高さを取り直します |
// | `@p` `@s` `@v` | RetroTalk の指示。高さ、速さ、音量はそのまま効きます |
//
// 高さを変える記号（`〜` `>` `<`）は読み飛ばします。`！` `？` による語尾の変化も
// 付けません。記号列はアクセントの情報を持っているので、両方を効かせると
// どちらの読み方になるのか決まらなくなります。
//
// 高さは東京式のアクセントに合わせて付けます。アクセント句の 1 拍目は低く、
// 2 拍目で上がり、核の位置まで高いまま、核の直後で下がります。
// 核が 1 拍目にあるときは上がらずに下がります。核が無いとき（平板）は上がったままです。
// 段は「低い」「高い」「下がったあと」の 3 つだけで、拍ごとに滑らかには動かしません。

import { parseTalk, checkTalk } from './kana.js';

/**
 * アクセントで上がる幅（半音）。長三度あたり
 * @private
 */
const STEP = 4;
/**
 * 核のあとで下がる先（半音）。始まりより少し低いところまで下げる
 * @private
 */
const AFTER = -1;

/**
 * アクセント句の区切りのうち、間が空くもの（`/` は空かず、`+` は切らない）
 * @private
 */
const BREAKS = '、,;';
/**
 * 長めの間（秒）。`、` は 0.12 なので、その倍を目安にする
 * @private
 */
const LONG_PAUSE = 0.25;
/**
 * 文の終わり。読み方が変わるので、そのまま渡す
 * @private
 */
const ENDS = '。？?！!';

/**
 * 書きやすい形に均します。日本語入力で `'` を打つと `’` になることが多いので、
 * どちらも同じ記号として受けます。改行は句の切れ目として読みます
 * @private
 */
const tidy = (s) => String(s).replace(/[\u2018\u2019\uff07]/g, "'").replace(/\r\n?/g, '\n');

/**
 * 記号を取り除いて、読みだけにします。
 * 高さを変える `〜` `>` `<` も取り除きます（記号列のアクセントとぶつかるため）
 * @private
 */
const kanaOnly = (s, strict = true) => s.replace(
  strict ? /['\/_\u301c\uff5e><\uff1e\uff1c]/g : /['\/]/g, '');

/**
 * 拍の数を数えます。記号は数に入りません。
 * `parseTalk` に読ませて、間や上げ下げの指示を除いた数を返します
 * @private
 */
function moraCount(kana) {
  return parseTalk(kanaOnly(kana)).filter((m) => !m.pause && !m.set && !m.tune).length;
}

/**
 * アクセント句 1 つに、高さの上げ下げを付けます。
 *
 * 東京式のアクセントに合わせるために使います。1 拍目は低く、2 拍目で上がり、
 * 核まで高いまま、核の直後で下がります。核が 1 拍目なら上がらずに下がり、
 * 核が無ければ上がったままになります。
 *
 * ```js
 * const got = accentPhrase(parseTalk('コンニチワ'), 3, 0);
 * ```
 *
 * VOICEVOX の読みからも使います。拍の並びと核の位置という同じ形で来るためです。
 *
 * @param {Array} moras 拍の並び（指示が混ざっていてかまいません）
 * @param {number} acc 核の位置（1 から。0 なら平板）
 * @param {number} tune いま何半音ぶん上がっているか
 * @returns {{moras:Array, tune:number}} 付け足した並びと、句を出たあとの上げ下げ
 * @private
 */
export function accentPhrase(moras, acc, tune) {
  const out = [];
  let n = 0;                          // いま何拍目か（指示は数えない）
  /** そこまでに要る上げ下げを、差分で置く */
  const to = (want) => {
    while (tune < want) { out.push({ pause: 0.0001, tune: 1 }); tune++; }
    while (tune > want) { out.push({ pause: 0.0001, tune: -1 }); tune--; }
  };
  for (const m of moras) {
    if (m.pause || m.set || m.tune) { out.push(m); continue; }
    // 1 拍目は低い。2 拍目から核までは高い。核の次から下がる
    if (n === 0) to(acc === 1 ? STEP : 0);
    else if (n === 1) to(acc === 1 ? AFTER : STEP);
    else if (acc > 1 && n === acc) to(AFTER);
    out.push(m);
    n++;
  }
  return { moras: out, tune };
}

/**
 * アクセント句 1 つを、拍の並びにします。
 *
 * @param {string} src 記号を含んだアクセント句
 * @param {number} tune いま何半音ぶん上がっているか
 * @returns {{moras:Array, tune:number}} 付け足した並びと、句を出たあとの上げ下げ
 * @private
 */
function phrase(src, tune, strict = true) {
  const moras = parseTalk(kanaOnly(src, strict));
  // 核の位置は、`'` の手前に何拍あるかで決まる
  const at = src.indexOf("'");
  // 核を書いていない句は、自動の抑揚に任せる（ふつうの文に混ぜたときだけ）。
  // 核を書いた句だけを手で作りたいのに、`'` が 1 つでもあると
  // 文じゅうが平らな型にはまっていた。
  // 前の句で上げ下げが残っていたら、ここで 0 に戻してから渡す
  if (!strict && at < 0) {
    const out = [];
    while (tune > 0) { out.push({ pause: 0.0001, tune: -1 }); tune--; }
    while (tune < 0) { out.push({ pause: 0.0001, tune: 1 }); tune++; }
    out.push(...moras);
    return { moras: out, tune: 0 };
  }
  const acc = at < 0 ? 0 : moraCount(src.slice(0, at));
  // 息だけにする拍。`_` の直後の 1 拍
  const off = new Set();
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '_') off.add(moraCount(src.slice(0, i)));
  }

  // 無声化はここで決めきり、自動の規則には渡さない。
  // ふつうの文に混ぜて書くとき（strict: false）は規則のままにして、
  // 残したいところだけ `^` で指定してもらう
  let n = 0;
  const marked = strict
    ? moras.map((m) => (m.pause || m.set || m.tune ? m : { ...m, devoice: off.has(n++) }))
    : moras;
  return accentPhrase(marked, acc, tune);
}

/**
 * 記号列を、拍の並びにします。
 *
 * アクセントと無声化を指定して読ませたいときに使います。返す形は `parseTalk()` と
 * 同じなので、そのあとの扱いは変わりません。
 *
 * ```js
 * const moras = parseAqua("コ'ンニチワ/イ_イ テンキ デス。");
 * ```
 *
 * @param {string} text 記号列
 * @param {object} [opts] `strict` を false にすると、ふつうの文に
 *   記号を混ぜて書けます。高さを変える記号や語尾の変化もそのまま効きます
 * @returns {Array} 拍の並び
 * @private
 */
export function parseAqua(text, opts = {}) {
  // 記号列として渡されたときだけ、ほかの指示を無効にする。
  // ふつうの文に `'` を混ぜて書けるようにしたので、
  // そちらでは `〜` `＞` `＜` も `！` `？` も今までどおり効かせる
  const strict = opts.strict !== false;
  const src = tidy(text);
  const out = [];
  let tune = 0;
  let buf = '';
  /** 溜めた 1 句を並びにして、区切りを置く */
  const flush = (sep) => {
    if (buf.trim()) {
      const got = phrase(buf, tune, strict);
      out.push(...got.moras);
      tune = got.tune;
    }
    buf = '';
    if (sep) {
      // 文の終わりで高さを戻す。戻さないと次の文が上がりっぱなしになる
      if (ENDS.includes(sep)) tune = 0;
      // `;` は長めの間。`、` と同じ切れ目にして、長さだけ伸ばす
      if (sep === ';') out.push({ pause: LONG_PAUSE, brk: true, mark: ',' });
      // 記号列では、文の終わりはどれも `。` として置く。語尾は核が決める。
      // ふつうの文では書いたとおりに読む
      else out.push(...parseTalk(strict && ENDS.includes(sep) ? '。' : sep));
    }
  };
  for (const ch of src) {
    if (ch === '/') { flush(''); continue; }
    // `+` では切らない。前の句に続けて、1 つのアクセント句として読む
    if (ch === '+') continue;
    if (ch === ';') { flush(';'); continue; }
    if (BREAKS.includes(ch)) { flush(ch); continue; }
    if (ENDS.includes(ch)) { flush(ch === '?' ? '？' : ch === '!' ? '！' : ch); continue; }
    if (ch === ' ' || ch === '　' || ch === '\n') { flush(' '); continue; }
    buf += ch;
  }
  flush('');
  return out;
}

/**
 * 記号列に読めない文字が無いかを調べます。読み上げはしません。
 *
 * 渡す前に確かめるときに使います。`checkTalk()` の記号列版で、返す形も同じです。
 *
 * ```js
 * const got = checkAqua("コ'ンニチワ");
 * // { ok: true, kana: 5, unknown: [] }
 * ```
 *
 * @param {string} text 記号列
 * @returns {{ok:boolean, kana:number, unknown:Array}}
 *   `ok` は読めない文字が無ければ true、`kana` は読めた文字数
 * @alias TalkAudio.checkAqua
 * @static
 */
export function checkAqua(text) {
  // 記号そのものは読める文字ではないので、取り除いてから調べる
  let plain = '';
  for (const ch of tidy(text)) {
    if (ch === '\n') { plain += ' '; continue; }
    if (ch === '/' || ch === '_' || ch === "'" || ch === '+') continue;
    plain += BREAKS.includes(ch) ? '、' : ch;
  }
  return checkTalk(plain);
}
