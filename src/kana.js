// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// しゃべらせる文字を読み取ります。音は作りません。
//
// カタカナ（ひらがなも読めます）を 1 拍ずつに分けて、子音と母音の組にします。
// 数字と英字は決まった読みに直し、記号は間や抑揚の指示として拾います。
//
// ここで読み取ったものを talk.js が波形にします。
// aquestalk.js と voicevox.js も、別の書き方をこの形に揃えてから渡してきます。

/**
 * 母音のフォルマント [F1, F2, F3]（Hz）。日本語の 5 母音
 * @private
 */
const VOWELS = {
  a: [800, 1200, 2800],
  i: [300, 2300, 3000],
  u: [350, 1200, 2200],
  e: [500, 1900, 2600],
  o: [500, 900, 2600],
  n: [280, 1200, 2500],   // 撥音「ン」。鼻に抜ける音として弱く長く鳴らす
};

/**
 * 子音の作り方。
 *   burst = 短い破裂（カ行・タ行・パ行）
 *   noise = こすれる音（サ行・ハ行）
 *   voiced = 有声のまま狭める（ナ行・マ行・ラ行・ヤ行・ワ行）
 *   なし   = 母音だけ（ア行）
 * @private
 */
const CONSONANTS = {
  k: { kind: 'burst', dur: 0.018, gap: 0.030, tone: 2200 },
  g: { kind: 'burst', dur: 0.016, gap: 0.012, tone: 1400, voiced: true },
  s: { kind: 'noise', dur: 0.075, tone: 5200 },
  z: { kind: 'noise', dur: 0.045, tone: 4200, voiced: true },
  t: { kind: 'burst', dur: 0.014, gap: 0.026, tone: 3000 },
  d: { kind: 'burst', dur: 0.014, gap: 0.010, tone: 1600, voiced: true },
  n: { kind: 'voiced', dur: 0.045, nasal: true },
  h: { kind: 'noise', dur: 0.060, tone: 1800 },
  b: { kind: 'burst', dur: 0.014, gap: 0.010, tone: 900, voiced: true },
  p: { kind: 'burst', dur: 0.014, gap: 0.024, tone: 1200 },
  m: { kind: 'voiced', dur: 0.045, nasal: true },
  y: { kind: 'voiced', dur: 0.035 },
  r: { kind: 'voiced', dur: 0.028 },
  w: { kind: 'voiced', dur: 0.035 },
  f: { kind: 'noise', dur: 0.060, tone: 2600 },
  ts: { kind: 'burst', dur: 0.014, gap: 0.020, tone: 4600 },
  ch: { kind: 'noise', dur: 0.055, tone: 3400 },
  sh: { kind: 'noise', dur: 0.070, tone: 3000 },
  j: { kind: 'noise', dur: 0.045, tone: 2800, voiced: true },
};

/**
 * カタカナ 1 文字 -> [子音, 母音]。'' は子音なし
 * @private
 */
const KANA = {
  ア: ['', 'a'], イ: ['', 'i'], ウ: ['', 'u'], エ: ['', 'e'], オ: ['', 'o'],
  カ: ['k', 'a'], キ: ['k', 'i'], ク: ['k', 'u'], ケ: ['k', 'e'], コ: ['k', 'o'],
  ガ: ['g', 'a'], ギ: ['g', 'i'], グ: ['g', 'u'], ゲ: ['g', 'e'], ゴ: ['g', 'o'],
  サ: ['s', 'a'], シ: ['sh', 'i'], ス: ['s', 'u'], セ: ['s', 'e'], ソ: ['s', 'o'],
  ザ: ['z', 'a'], ジ: ['j', 'i'], ズ: ['z', 'u'], ゼ: ['z', 'e'], ゾ: ['z', 'o'],
  タ: ['t', 'a'], チ: ['ch', 'i'], ツ: ['ts', 'u'], テ: ['t', 'e'], ト: ['t', 'o'],
  ダ: ['d', 'a'], ヂ: ['j', 'i'], ヅ: ['z', 'u'], デ: ['d', 'e'], ド: ['d', 'o'],
  ナ: ['n', 'a'], ニ: ['n', 'i'], ヌ: ['n', 'u'], ネ: ['n', 'e'], ノ: ['n', 'o'],
  ハ: ['h', 'a'], ヒ: ['h', 'i'], フ: ['f', 'u'], ヘ: ['h', 'e'], ホ: ['h', 'o'],
  バ: ['b', 'a'], ビ: ['b', 'i'], ブ: ['b', 'u'], ベ: ['b', 'e'], ボ: ['b', 'o'],
  パ: ['p', 'a'], ピ: ['p', 'i'], プ: ['p', 'u'], ペ: ['p', 'e'], ポ: ['p', 'o'],
  マ: ['m', 'a'], ミ: ['m', 'i'], ム: ['m', 'u'], メ: ['m', 'e'], モ: ['m', 'o'],
  ヤ: ['y', 'a'], ユ: ['y', 'u'], ヨ: ['y', 'o'],
  ラ: ['r', 'a'], リ: ['r', 'i'], ル: ['r', 'u'], レ: ['r', 'e'], ロ: ['r', 'o'],
  ワ: ['w', 'a'], ヲ: ['', 'o'], ン: ['', 'n'],
  // 小書きの「ヮ」。「クヮ」は本来 1 拍ですが、唇を丸めた k は用意していません。
  // ワ と同じ 1 拍として扱い、`( )` でくくれば 1 拍として歌えます
  ヮ: ['w', 'a'],
  // 古い仮名。いまは イ エ と同じに読みます。飛ばしても得は無く、
  // 読めるようにしておけば古い綴りの詞をそのまま渡せます
  ヰ: ['', 'i'], ヱ: ['', 'e'],
  ヴ: ['b', 'u'],
};
/**
 * 小さい仮名。直前の拍の母音を差し替える
 * @private
 */
const SMALL = { ャ: 'a', ュ: 'u', ョ: 'o', ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o' };

/**
 * 拗音になる小書き。`ャ` `ュ` `ョ` がイ段のあとに来たときだけです。
 *
 * 「キャ」は「カ」の母音を差し替えたものではなく、子音そのものが変わります。
 * 舌が硬口蓋（上あごの高いところ）へ寄ったまま `k` を作ります。
 * 母音だけ差し替えていたころ、「キャ」は「カ」と同じ音になっていました。
 *
 * `ァ` `ィ` `ゥ` `ェ` `ォ` は別です。「フェ」「ジェ」「ティ」のように
 * 外来語を書くためのもので、子音は変わりません（母音の差し替えだけです）。
 * @private
 */
const PALATAL_SMALL = 'ャュョ';

/**
 * 小書きの仮名を、直前の拍へ効かせる。
 * @param {Array} out 拍の並び
 * @param {string} ch 小書きの仮名
 * @private
 */
function applySmall(out, ch) {
  if (!out.length) return;
  const last = out[out.length - 1];
  // イ段 + ャュョ は拗音。子音が口蓋化する（talk.js が渡りを入れる）
  if (PALATAL_SMALL.includes(ch) && last.v === 'i') last.pal = true;
  last.v = SMALL[ch];
}

/**
 * 数字の読み。1 文字ずつ、決まった読みで読みます。
 *
 * `100` は「ヒャク」ではなく「イチ ゼロ ゼロ」です。桁で読もうとすると
 * 「どこからどこまでが 1 つの数か」を決めることになり、そこから先は
 * 辞書の仕事になります（「1000」は「セン」か「イッセン」か、
 * 「4」は「ヨン」か「シ」か、前後で変わります）。
 * そう読ませたいときは、かなで書いてください。
 * @private
 */
const DIGITS = {
  0: 'ゼロ', 1: 'イチ', 2: 'ニ', 3: 'サン', 4: 'ヨン',
  5: 'ゴ', 6: 'ロク', 7: 'ナナ', 8: 'ハチ', 9: 'キュウ',
};

/**
 * 英字の読み。1 字ずつ、字の名前で読みます。
 *
 * `CPU` は「シーピーユー」です。単語としては読みません。英語の綴りと読みの
 * 対応は規則になっていないので、読むには辞書が要ります（`make` と `machine`、
 * `read` と `read`）。字の名前なら 26 個で足ります。
 * @private
 */
const LATIN = {
  A: 'エー', B: 'ビー', C: 'シー', D: 'ディー', E: 'イー', F: 'エフ',
  G: 'ジー', H: 'エイチ', I: 'アイ', J: 'ジェー', K: 'ケー', L: 'エル',
  M: 'エム', N: 'エヌ', O: 'オー', P: 'ピー', Q: 'キュー', R: 'アール',
  S: 'エス', T: 'ティー', U: 'ユー', V: 'ブイ', W: 'ダブリュー',
  X: 'エックス', Y: 'ワイ', Z: 'ゼット',
};

/**
 * 全角を半角へ寄せる。数字も英字も、全角で書かれることがある
 * @private
 */
function toHalf(ch) {
  return (ch >= '０' && ch <= '９') || (ch >= 'Ａ' && ch <= 'Ｚ') || (ch >= 'ａ' && ch <= 'ｚ')
    ? String.fromCharCode(ch.charCodeAt(0) - 0xfee0) : ch;
}

/**
 * その字に決まった読みがあれば返す（数字と英字）。無ければ `null`
 * @private
 */
function readingOf(ch) {
  const half = toHalf(ch);
  return DIGITS[half] || LATIN[half.toUpperCase()] || null;
}

/**
 * ひらがなをカタカナへ寄せる
 * @private
 */
function toKatakana(text) {
  return text.replace(/[ぁ-ゖ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/**
 * 読める文字かどうかだけを調べます。読み上げはしません。
 *
 * 辞書を持っていないので漢字は読めません（数字と英字は 1 字ずつ読みます）。
 * `parseTalk()` は読めない文字を黙って飛ばすため、そのままでは
 * 「なぜかそこだけ抜ける」ことになります。鳴らす前に確かめられるようにしてあります。
 *
 * ```js
 * const got = checkTalk('今日は 3ガツ デス');
 * // { ok: false, kana: 6, unknown: [{ ch: '今', at: 0, kind: 'kanji' }, ...] }
 * ```
 *
 * @param {string} text しゃべらせる文
 * @returns {{ok:boolean, kana:number, unknown:Array<{ch:string, at:number, kind:string}>}}
 *   `kind` は `kanji` / `other`
 * @alias TalkAudio.checkTalk
 * @static
 */
export function checkTalk(text) {
  const s = toKatakana(String(text));
  const unknown = [];
  let kana = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    // 読める字と、意味のある記号は飛ばす
    if (KANA[ch] || SMALL[ch] || ch === 'ー' || ch === 'ッ') { kana++; continue; }
    // 数字と英字は読める。読みの拍のぶんだけ数える
    // （小さい仮名と長音は数に入らない）
    const said = readingOf(ch);
    if (said) { kana += [...said].filter((c) => !SMALL[c] && c !== 'ー').length; continue; }
    if (' 　、，。！!？?…〜~'.includes(ch)) continue;
    // くくり。歌えば音符 1 つ、しゃべれば持ち上げ。長さは持たない
    if ('()（）'.includes(ch)) continue;
    // 三点リーダを半角で書く人もいる。`.` 単体は読めない字のまま
    if (ch === '.' && s.slice(i, i + 3) === '...') { i += 2; continue; }
    // 抑揚を上げ下げする記号。長さを持たないので、かなとしては数えない
    if ('><＞＜'.includes(ch)) continue;
    // アクセントの記号（`'` 核 / `/` 句切り / `+` 続ける / `;` 長めの間）と、
    // 母音を残す `^`、読み飛ばす `_`。どれも長さを持たない
    if ("'\u2018\u2019\uff07/+;^＾_＿".includes(ch)) continue;
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    // `@p200` のような指示は読み飛ばす（長さを持たない記号）。
    // 受け付ける記号は parseTalk と揃える。`v`（音量）を落としていたので、
    // 読めているのに「読めない字」と出ていた
    if (ch === '@') {
      const k = s[i + 1];
      let j = i + 2;
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
      if (j > i + 2 && 'psvPSV'.includes(k)) { i = j - 1; continue; }
    }
    const kind = /[\u4e00-\u9fff\u3005]/.test(ch) ? 'kanji' : 'other';
    unknown.push({ ch, at: i, kind });
  }
  return { ok: unknown.length === 0, kana, unknown };
}

/**
 * 文字列を拍の並びに変換します。
 *
 * 波形を作る前の段です。`renderTalk()` が内部で呼ぶので、ふつうは直接
 * 使いません。書いたものがどう読まれるかを確かめたいときに使えます。
 *
 * ```js
 * const moras = parseTalk('コンニチワ、@p200 イイ テンキ デス。');
 * ```
 *
 * 返す拍は次の値を持ちます。
 *   c     子音（無ければ ''）
 *   v     母音（`n` は撥音）
 *   hold  母音を伸ばす倍率（「ー」で増える）
 *   stop  直前で詰まる（「ッ」）
 *   pause 休み（空白、読点）
 *   set   途中で変える指示（`@p` `@s` `@v`）
 *   tune  抑揚の高さを上げ下げする（`＞` `＜`。半音単位。長さは持たない）
 *   brk   文の切れ目（読点、句点）。空白には付かない
 *   mark  どの記号で切れたか（`.` `,` `!` `?` `!?` `…`）
 *   wave  伸ばしながら揺らす（`〜`）
 *   pal   拗音（「キャ」のように子音が口蓋化する）
 *   tie   直前の拍と同じ音符で歌う（`( )` でくくったところ）
 *   lift  しゃべるときに持ち上げる（`( )` でくくったところ）
 *
 * @param {string} text かな。ひらがなでもカタカナでもかまいません（内部で揃えます）
 * @returns {Array<object>} 拍の並び
 * @alias TalkAudio.parseTalk
 * @static
 */
export function parseTalk(text) {
  const s = toKatakana(String(text));
  const out = [];
  let pendingStop = false;
  // 次の 1 拍は母音を無声化しない（`^`）。記号は長さを持たない
  let pendingVoiced = false;
  // くくったところは、音符 1 つで歌う。
  // 2 つめから `tie` を立てて、talk.js が 1 つの音符を分けて当てる。
  // 「チュー」のように字は 2 つでも 1 拍のところを、歌詞のまま書けるようにする
  let group = 0;
  // くくったところは持ち上げる。`！` は最後の 1 字しか上げないので、
  // 文まるごと張りたいときはここでくくる（talk.js が上げる）
  let lift = false;
  // 番号で回す。`@p200` のような指示は後ろの数字まで読むので、
  // 1 文字ずつ取り出すだけでは足りない
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === 'ー') {                       // 長音: 直前を伸ばす
      if (out.length) out[out.length - 1].hold += 1;
      continue;
    }
    // 伸ばしながら揺らす。`ー` は真っ直ぐ伸びるが、こちらは終わりが揺れる。
    // 「ソウデスネ〜」の、あの言い方（talk.js が揺らす）
    if (ch === '〜' || ch === '~') {
      if (out.length) {
        out[out.length - 1].hold += 1;
        out[out.length - 1].wave = true;
      }
      continue;
    }
    if (ch === 'ッ') { pendingStop = true; continue; }
    // 無声化する母音を、その 1 拍だけ残す。
    //
    // 「デス」の「ス」のように、規則で母音を無声化しているところがある。
    // 残してほしい場面は書いた人にしか分からないので、記号で指定する
    // （`デ^ス` なら「ス」が残る）。
    // 記号列の `_`（無声化）は読み飛ばす。無声化するほうは規則に任せる
    if (ch === '^' || ch === '＾') { pendingVoiced = true; continue; }
    // くくりは 1 種類。効き方は、歌っているかどうかで決まる。
    //
    // 歌うときは、くくった中を音符 1 つで歌う（`tie`）。
    // しゃべるときは、くくった中を持ち上げる（`lift`）。
    // 歌には音符が高さを持っていて持ち上げようがなく、しゃべりには音符が無い。
    // 同じ文字列に 2 つの読み方が生じることはなく、渡し方でどちらか決まる。
    // 半角でも全角でもよい
    if (ch === '(' || ch === '（') { group = 1; lift = true; continue; }
    if (ch === ')' || ch === '）') { group = 0; lift = false; continue; }
    // 文の途中で変える指示。`@p200` で高さ、`@s150` で速さ、`@v8` で音量。
    // 書いたところから後ろに効く。
    //
    // 長さを持たない記号なので、置いても文の長さは変わらない
    // （歌のときは休みとして読み飛ばすだけ）
    if (ch === '@') {
      const k = s[i + 1];
      let j = i + 2, n = '';
      while (j < s.length && s[j] >= '0' && s[j] <= '9') n += s[j++];
      i = j - 1;
      const kind = { p: 'pitch', s: 'speed', v: 'vol' }[String(k).toLowerCase()];
      if (n && kind) {
        // 音量だけ 0〜15 で書く。0〜1 に直して持つ
        const val = kind === 'speed' ? +n / 100
          : kind === 'vol' ? Math.max(0, Math.min(15, +n)) / 15
          : +n;
        out.push({ pause: 0.0001, set: { [kind]: val } });
      }
      continue;
    }
    // 抑揚の高さを、その場から上げ下げする。1 つで半音。
    // しゃべりで 1 オクターブ動かすと別人になってしまうので、半音にしてある。
    // 句読点で 0 に戻る（talk.js が戻す）。文をまたいで持ち越すと、
    // 長い文の途中から声が上がりっぱなしになる
    if (ch === '>' || ch === '＞') { out.push({ pause: 0.0001, tune: 1 }); continue; }
    if (ch === '<' || ch === '＜') { out.push({ pause: 0.0001, tune: -1 }); continue; }
    if (SMALL[ch]) { applySmall(out, ch); continue; }
    // 区切りには印を付ける。空白は間でしかないが、読点と句点は文の切れ目なので、
    // 抑揚を取り直す目印になる（talk.js が見る）。
    // アンダースコアも間。空白と同じだが、目で見て分かるので、
    // 区切りを数えたいところで使える（記号列の `_` とは別のもの）
    if (ch === ' ' || ch === '　' || ch === '_' || ch === '＿') {
      out.push({ pause: 0.12 }); continue;
    }
    if (ch === '、' || ch === '，') { out.push({ pause: 0.12, brk: true, mark: ',' }); continue; }
    // どの記号で切れたかも持つ。「。」と「！」と「？」では言い方が変わるので、
    // 切れ目としてまとめてしまうと、そこを鳴らし分けられない（talk.js が見る）
    if ('。！!？?…'.includes(ch) || (ch === '.' && s.slice(i, i + 3) === '...')) {
      const norm = (c) => (c === '！' ? '!' : c === '？' ? '?' : c);
      const a = norm(ch), b = norm(s[i + 1] || '');
      let mark;
      // `！？` は 2 つではなく 1 つの記号として扱う。驚いて問い返すのは
      // 「言い切る」と「尋ねる」を足したものなので、別に扱う
      if ((a === '!' && b === '?') || (a === '?' && b === '!')) { mark = '!?'; i++; }
      else if (a === '…') mark = '…';
      else if (a === '.') { mark = '…'; i += 2; }
      else mark = a === '!' ? '!' : a === '?' ? '?' : '.';
      // `……` は 1 つにまとめる。続けて書いても切れ目は 1 回
      if (mark === '…') while (s[i + 1] === '…') i++;
      // 言いさしは間も長い。黙るところまでが言いさし
      out.push({ pause: mark === '…' ? 0.42 : 0.24, brk: true, mark });
      continue;
    }
    // 数字と英字は読みへ展開する。決まった読みをそのまま並べるだけで、
    // 前後は見ない（理由は DIGITS と LATIN の説明にある）
    const said = readingOf(ch);
    if (said) {
      for (const c of said) {
        if (c === 'ー') {                     // 「エー」の「ー」
          if (out.length) out[out.length - 1].hold += 1;
          continue;
        }
        if (c === 'ッ') { pendingStop = true; continue; }  // 「エックス」の「ッ」
        if (SMALL[c]) { applySmall(out, c); continue; }   // 「キュー」の「ュ」
        const kk = KANA[c];
        out.push({ c: kk[0], v: kk[1], hold: 0, stop: pendingStop,
          ...(pendingVoiced ? { devoice: false } : null) });
        pendingStop = false;
        pendingVoiced = false;
      }
      continue;
    }
    const k = KANA[ch];
    if (!k) continue;                         // 読めない字は飛ばす
    out.push({ c: k[0], v: k[1], hold: 0, stop: pendingStop, tie: group > 1, lift,
      ...(pendingVoiced ? { devoice: false } : null) });
    if (group) group++;
    pendingStop = false;
    pendingVoiced = false;
  }
  return out;
}
