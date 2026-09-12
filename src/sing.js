// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 歌わせるときに使う、小さな MML です。
//
// 声の高さと長さを決める命令だけを解釈します。音色や定位のように
// 声に効かないものは、書かれていたら警告として返します。

/**
 * 音名 → 半音
 * @private
 */
const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/**
 * 歌わせるための MML を、音符の並びに変換します。
 *
 * `renderTalk()` の `sing` オプションに渡す文字列を解釈するために使います。
 * 直接呼ぶことはありません。
 *
 * 解釈するのは次の命令だけです。
 *
 * | 命令 | 意味 |
 * | --- | --- |
 * | `cdefgab` | 音符。うしろの `+` `#` で半音上げ、`-` で下げ |
 * | `r` | 休み |
 * | `4` `8.` | 長さ。全音符の何分の 1 か。`.` で 1.5 倍 |
 * | `l` | 長さの初期値 |
 * | `o` `>` `<` | オクターブ |
 * | `t` | 速さ。四分音符が 1 分間に何個か |
 * | `&` | 前の音を伸ばす |
 * | `v` | 音量。0〜15 |
 * | `q` | 音の切り方。0〜8。8 で長さいっぱい、4 なら半分で切る |
 *
 * これ以外の命令は、`warn` に名前を入れて読み飛ばします。
 *
 * @param {string} mml 歌の MML
 * @returns {{notes:Array<{hz:number, sec:number, rest:boolean, vol:number, q:number}>,
 *   warn:string[]}}
 *   `hz` は休みのとき 0、`sec` は秒、`vol` と `q` は 0〜1 に直したもの。
 *   `warn` は解釈しなかった命令の一覧
 * @private
 */
export function parseSing(mml) {
  const src = String(mml).toLowerCase();
  const notes = [];
  const warn = [];
  let octave = 4, defLen = 4, tempo = 120, pos = 0, vol = 1, q = 1;
  /** 同じ命令は 1 回だけ並べる */
  const add = (list, what) => { if (!list.includes(what)) list.push(what); };

  const readNumber = () => {
    let n = '';
    while (pos < src.length && src[pos] >= '0' && src[pos] <= '9') n += src[pos++];
    return n === '' ? null : parseInt(n, 10);
  };
  const readDuration = () => {
    const len = readNumber() ?? defLen;
    let d = 240 / tempo / Math.max(1, len);
    let dot = d;
    while (src[pos] === '.') { pos++; dot /= 2; d += dot; }
    return d;
  };

  while (pos < src.length) {
    const ch = src[pos++];
    if (' \n\t\r|'.includes(ch)) continue;
    if (SEMI[ch] !== undefined) {
      let semi = SEMI[ch];
      while (src[pos] === '+' || src[pos] === '#') { semi++; pos++; }
      while (src[pos] === '-') { semi--; pos++; }
      const sec = readDuration();
      const midi = (octave + 1) * 12 + semi;
      notes.push({ hz: 440 * Math.pow(2, (midi - 69) / 12), sec, rest: false, vol, q });
      continue;
    }
    if (ch === 'r') { notes.push({ hz: 0, sec: readDuration(), rest: true, vol, q: 1 }); continue; }
    if (ch === '&') {
      // 前の音を伸ばす。うしろに書いた高さは見ない(長さだけ足す)
      while (pos < src.length && ' \n\t\r'.includes(src[pos])) pos++;
      if (SEMI[src[pos]] !== undefined && notes.length) {
        pos++;
        while ('+#-'.includes(src[pos])) pos++;
        notes[notes.length - 1].sec += readDuration();
      }
      continue;
    }
    if (ch === 'o') { octave = Math.max(1, Math.min(8, readNumber() ?? octave)); continue; }
    if (ch === '>') { octave = Math.min(8, octave + 1); continue; }
    if (ch === '<') { octave = Math.max(1, octave - 1); continue; }
    if (ch === 'l') { defLen = readNumber() ?? defLen; continue; }
    if (ch === 't') { tempo = Math.max(20, readNumber() ?? tempo); continue; }
    // 中身ごと読み飛ばして、命令 1 つにつき 1 回だけ warn に入れる。
    // `@{pulse50}` を 1 字ずつ並べても、どこが悪いのか分からない
    if (ch === '@') {
      let kind = '';
      if (src[pos] && src[pos] !== '{') kind = src[pos++];
      if (src[pos] === '{') { while (pos < src.length && src[pos] !== '}') pos++; pos++; }
      else readNumber();
      add(warn, '@' + kind);
      continue;
    }
    // 和音は囲みごと読み飛ばす。声は 1 つしか出せない
    if (ch === "'") {
      while (pos < src.length && src[pos] !== "'") pos++;
      pos++;
      readDuration();
      add(warn, "'…'");
      continue;
    }
    // 0〜15 を 0〜1 に直して持つ。書いた場所から後ろに効く
    if (ch === 'v') {
      vol = Math.max(0, Math.min(15, readNumber() ?? 15)) / 15;
      continue;
    }
    // 0〜8 を 0〜1 に直して持つ。切ったぶんは次の音符までの間になる
    if (ch === 'q') {
      q = Math.max(0, Math.min(8, readNumber() ?? 8)) / 8;
      continue;
    }
    if ('$p'.includes(ch)) { readNumber(); add(warn, ch); continue; }
    if ('[]'.includes(ch)) { readNumber(); add(warn, ch); continue; }
    add(warn, ch);
  }
  return { notes, warn };
}
