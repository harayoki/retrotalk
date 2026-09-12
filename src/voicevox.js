// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// VOICEVOX プロジェクトファイル（.vvproj）を解析して、RetroTalk で使えるデータを抜き出します。
// /audio_query が返す JSON にも対応していますが未検証です。

import { parseTalk } from './kana.js';

/**
 * 読み上げ指示パート（`query`）をソースデータから取り出します。
 *
 * `.vvproj` は文がいくつも入っているので、同じ並び順のまま返します。
 * `/audio_query` の返り値は 1 つだけなので、そのまま 1 つ返します。
 *
 * @param {object} data 読み込んだ JSON
 * @returns {Array<object>} query の並び
 * @private
 */
function queries(data) {
  const talk = data && data.talk;
  if (talk && talk.audioItems) {
    const keys = talk.audioKeys || Object.keys(talk.audioItems);
    return keys.map((k) => talk.audioItems[k])
      .filter((it) => it && it.query)
      .map((it) => it.query);
  }
  if (data && (data.accentPhrases || data.accent_phrases)) return [data];
  return [];
}

/**
 * 拍 1 つの長さ(秒)。`consonantLength` と `vowelLength` を足す
 * @private
 */
const moraSec = (mo) => (+mo.consonantLength || +mo.consonant_length || 0)
  + (+mo.vowelLength || +mo.vowel_length || 0);

/**
 * 項目名の書き方が 2 通りある
 * （`vowelLength` と `vowel_length`）
 * @private
 */
const pick = (o, a, b, def) => {
  const v = o[a] ?? o[b];
  return v === undefined || v === null ? def : v;
};

// JSON から読む項目。
//
//   moras[].text          読み(カタカナ)
//   moras[].vowel         大文字(A I U E O)なら無声化。N は撥音
//   moras[].pitch         その拍の高さ。自然対数の Hz。0 は無声
//   moras[].vowelLength   その拍の長さ(秒)。consonantLength と足して使う
//   accent                アクセント核の位置
//   pauseMora             句のあとの間
//
// パラメータは query に文ごとで入っている。
//
//   pitchScale        オクターブで数える(f0 × 2^pitchScale)ので、
//                     対数で持っている pitch には pitchScale × ln2 を足す
//   intonationScale   文まるごとの平均からの差を広げる / 狭める。
//                     アクセント句ごとではない
//   speedScale        速さ。長さを割る
//   pauseLengthScale  間の長さを掛ける
//
// これ以外は 拍の並び 1つになる。

/**
 * 文ごとの設定を適用したうえで、拍を平らに並べます。
 *
 * @param {Array<object>} list `query` の並び
 * @param {boolean} meta パラメータを掛けるか。外すと素の読みだけになる
 * @returns {Array<object>} 拍と間の並び（`{ kana, pitch, sec }` か `{ gap }`）
 * @private
 */
function flatten(list, meta) {
  const out = [];
  for (const q of list) {
    const speedScale = meta ? (+pick(q, 'speedScale', 'speed_scale', 1) || 1) : 1;
    const pitchScale = meta ? (+pick(q, 'pitchScale', 'pitch_scale', 0) || 0) : 0;
    const intoScale = meta ? +pick(q, 'intonationScale', 'intonation_scale', 1) : 1;
    const pauseScale = meta ? (+pick(q, 'pauseLengthScale', 'pause_length_scale', 1) || 1) : 1;
    const pre = meta ? (+pick(q, 'prePhonemeLength', 'pre_phoneme_length', 0) || 0) : 0;
    const post = meta ? (+pick(q, 'postPhonemeLength', 'post_phoneme_length', 0) || 0) : 0;
    const phrases = q.accentPhrases || q.accent_phrases || [];
    // 抑揚は、文まるごとの平均からの差を伸ばす。声の高さそのものは動かさない。
    // 無声化した拍(高さを持たない)は、平均に入れない
    const said = [];
    for (const ph of phrases) {
      for (const mo of ph.moras || []) if (+mo.pitch > 0) said.push(+mo.pitch);
    }
    const mid = said.length ? said.reduce((a, b) => a + b, 0) / said.length : 0;
    const into = intoScale >= 0 ? intoScale : 1;
    if (pre > 0) out.push({ gap: pre / speedScale });
    for (const ph of phrases) {
      const moras = ph.moras || [];
      for (const mo of moras) {
        const p = +mo.pitch || 0;
        out.push({
          kana: String(mo.text || ''),
          // `pitchScale` はオクターブなので、対数へ直してから足す
          pitch: p > 0 ? mid + (p - mid) * into + pitchScale * Math.LN2 : 0,
          sec: moraSec(mo) / speedScale,
        });
      }
      const pau = ph.pauseMora || ph.pause_mora;
      if (pau) out.push({ gap: moraSec(pau) * pauseScale / speedScale });
    }
    if (post > 0) out.push({ gap: post / speedScale });
    out.push({ end: true });                  // セリフの切れ目
  }
  return out;
}

/**
 * VOICEVOX の会話情報を、RetroTalk 向けのテキストに変換します。
 *
 * VOICEVOX から抑揚と速度と音声を読み込めます。話者の情報は落としています。
 * 拍ごとの高さと長さは `@p` と `@s` に、間は `、` と `。` に置き換えます。
 *
 * VOICEVOX の無声音の指定は無視します。（RetroTalk は自動で無声音の正誤とします）。
 *
 * @param {object|string} src `.vvproj` か `/audio_query` の返り
 * @param {object} [opts]
 *   `speed` は RetroTalk 側の速さ。長さはこれに合わせて置き直します（高さはそのまま）。
 *   `usePitch` を外すと `@p` を、`useLength` を外すと `@s` を書きません。
 *   `useMeta` を外すと VOICEVOX 側のパラメータ（話速・抑揚・間）を掛けません。
 *   すべて外すと、読みと切れ目だけになります
 * @returns {string} RetroTalk の文
 * @alias TalkAudio.voicevoxText
 * @static
 */
export function voicevoxText(src, opts = {}) {
  let data = src;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = null; }
  }
  const list = queries(data);
  if (!list.length) {
    console.warn('[RetroTalk] VOICEVOX の読みが見つかりません'
      + '(.vvproj の talk か、/audio_query の返しを渡してください)');
    return '';
  }
  const usePitch = opts.usePitch !== false;
  const useLength = opts.useLength !== false;
  const flat = flatten(list, opts.useMeta !== false);

  // 長さだけ、RetroTalk の速さに合わせて置き直す。
  // VOICEVOX の秒数をそのまま使うと、RetroTalk の拍の長さと噛み合わない
  const base0 = +opts.speed > 0 ? +opts.speed : 1;
  const secs = flat.filter((f) => f.sec > 0).map((f) => f.sec);
  const midSec = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0;
  /** 高さは、そのまま Hz にする(`pitch` は自然対数の Hz) */
  const toHz = (p) => Math.max(50, Math.min(800, Math.round(Math.exp(p))));
  /**
   * 長さの値を変換する(%)。
   *
   * VOICEVOX の拍は 2 倍以上に伸び縮みするが、
   * RetroTalk の拍はもともと子音のぶんだけで長さが違う。、
   * そのまま扱うと速くなるところが速くなりすぎる。平方根で調整して 上と下も抑制する。
   */
  const toSpeed = (sec) => Math.round(100 * Math.max(0.6, Math.min(1.8,
    base0 * Math.sqrt(midSec / sec))));

  let out = '';
  let speed = Math.round(base0 * 100);
  let hz = 0;
  for (const f of flat) {
    if (f.end) { out += '。'; continue; }
    if (f.gap !== undefined) {
      // 間は、書ける長さに丸める。`、` が 0.12 秒、`。` が 0.24 秒。
      // 秒より細かいところは移らない。
      // 長さを引き継がないときは、切れ目だけを `、` で置く
      if (!useLength) out += '、';
      else if (f.gap >= 0.2) out += '。';
      else if (f.gap >= 0.08) out += '、';
      else out += ' ';
      continue;
    }
    if (usePitch && f.pitch > 0 && toHz(f.pitch) !== hz) {
      hz = toHz(f.pitch);
      out += '@p' + hz;
    }
    if (useLength && midSec > 0 && f.sec > 0) {
      const want = toSpeed(f.sec);
      if (want !== speed) { speed = want; out += '@s' + speed; }
    }
    out += f.kana;
  }
  // 切れ目が重なったところは 1 つにする。長いほうを残す。
  // セリフの終わりの 。 の直後に、次のセリフの頭の間が続くことがある
  return out
    .replace(/[、。 ]*。[、。 ]*/g, '。')
    .replace(/[、 ]*、[、 ]*/g, '、')
    .replace(/ +/g, ' ')
    .replace(/^[、。 ]+/, '')
    .trim();
}

/**
 * データが正しく読めるかどうかを調べます。
 *
 * `voicevoxText()` は読み取れたものだけを返す。
 * 読めなかったときは空の文字列が返る。
 *
 * @param {object|string} src `.vvproj` か `/audio_query` の返り
 * @returns {{ok:boolean, version:string, lines:number, moras:number}}
 *   `version` は VOICEVOX のバージョン、`lines` は文の数、`moras` は拍の数
 * @alias TalkAudio.voicevoxInfo
 * @static
 */
export function voicevoxInfo(src) {
  let data = src;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = null; }
  }
  const list = queries(data);
  let moras = 0;
  for (const q of list) {
    for (const ph of q.accentPhrases || q.accent_phrases || []) {
      moras += (ph.moras || []).length;
    }
  }
  return {
    ok: list.length > 0 && moras > 0,
    version: String((data && (data.appVersion || data.app_version)) || ''),
    lines: list.length,
    moras,
  };
}

/**
 * VOICEVOX の読みを、拍の並びに変換します。`parseTalk()` と同じ形で返します。
 *
 * いったん RetroTalk の文に変換してから読み直します。、
 * 表示される文と実際になる音が必ず同じものになります。
 *
 * @param {object|string} src `.vvproj` か `/audio_query` の返り（文字列でもよい）
 * @param {object} [opts] `voicevoxText()` と同じ
 * @returns {Array} 拍の並び
 * @private
 */
export function parseVoicevox(src, opts = {}) {
  return parseTalk(voicevoxText(src, opts));
}
