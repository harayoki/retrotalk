// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 音声の登録と再生を扱います。SimpleAudio を継承しています。
//
// 波形そのものは talk.js の renderTalk() が作ります。このファイルが行うのは、
// テキストに名前を付けて覚えること、作った波形を保持すること、
// 空きを確保して再生することの 3 つです。

import { SimpleAudio } from './simple_audio.js';
import { renderTalk } from './talk.js';
import { checkTalk } from './kana.js';
import { checkAqua } from './aquestalk.js';

/**
 * `talk()` が内部で作る名前の印。人が書く名前とは重ならない
 * @private
 */
const AUTO_TALK = '\u0000talk:';

/**
 * RetroTalk の入口です。読み込むと `MmsxxRetroTalk` という名前で使えます。
 *
 * 音声の登録と再生を扱います。`SimpleAudio` を継承しているので、
 * 音量と消音の操作もここから行えます。
 *
 * @extends SimpleAudio
 * @example
 * const voice = new MmsxxRetroTalk(new AudioContext());
 * voice.talk('コンニチワ');
 */
export class TalkAudio extends SimpleAudio {
  /**
   * @param {AudioContext} ctx 呼び出し側で作った AudioContext
   * @param {object} [opts]
   * @param {number} [opts.maxVoices=8] 同時に再生できる音の数
   * @param {number} [opts.maxTalk=1] 同時に再生できるセリフの数
   */
  constructor(ctx, opts = {}) {
    super(ctx, opts);
    /** 登録したテキスト。音声ファイルは持たず、再生時に波形を作ります */
    this.talkDefs = new Map();
    /**
     * 同時に再生できるセリフの数。
     *
     * 重なると聞き取れないため、初期値は 1 です。
     * 複数の人物が同時に話す場面では増やします。
     *
     * @type {number}
     */
    this.maxTalk = opts.maxTalk ?? 1;
    // `talk()` が使い捨ての名前を作るための番号
    this._talkSeq = 0;
  }

  /**
   * テキストに名前を付けて登録します。再生はしません。
   *
   * 同じテキストを何度も再生するときに使います。作った波形は名前ごとに
   * 保持するので、2 回目以降は作り直しません。
   *
   * `@` で始まる指示をテキストに混ぜられます。指示はそこから後ろに効きます。
   *
   *   `@p<Hz>`  声の高さ。例 `@p200`
   *   `@s<%>`   話す速さ。例 `@s150`（1.5 倍）
   *   `@v<0-15>` 音量。例 `@v8`
   *
   * ```js
   * voice.defineTalk('two', 'ワタシデス。@p180 イエ、ワタシデス。');
   * ```
   *
   * 抑揚は句読点（`、` `。`）で元に戻ります。文全体で少しずつ下がるため、
   * 切れ目が無いと長い文の終わりで音が沈みます。空白では戻りません。
   *
   * @param {string} name 登録名
   * @param {string} text カタカナ。空白と句読点は間になります
   * @param {object} [opts]
   *   音声のパラメータ。一覧は `renderTalk()` の説明にあります。
   *   `unknown` は読めない文字が混ざったときの扱いで、
   *   `warn`（初期値）/ `error` / `ignore` から選びます
   * @returns {void}
   */
  defineTalk(name, text, opts = {}) {
    // 読めない文字は登録した時点で知らせる。再生してから
    // 「そこだけ抜けた」と気づくのでは遅い
    const how = opts.unknown ?? 'warn';
    if (how !== 'ignore') {
      // アクセント記号列で渡すときは、記号を除いてから調べる。
      // VOICEVOX の読みは JSON なので、文字として調べても意味が無い
      const got = opts.format === 'voicevox' ? { ok: true, unknown: [] }
        : opts.format === 'aquestalk' ? checkAqua(text) : checkTalk(text);
      if (!got.ok) {
        const what = got.unknown.slice(0, 8).map((u) => u.ch).join(' ');
        const more = got.unknown.length > 8 ? ` ほか ${got.unknown.length - 8} 字` : '';
        // 内部で作った名前は読めないので、テキストのほうを出す
        const label = name.startsWith(AUTO_TALK) ? text : name;
        const say = `[RetroTalk] talk "${label}": 読めない字があります — ${what}${more}`
          + '(漢字と数字は読みにしてから渡します)';
        if (how === 'error') throw new Error(say);
        console.warn(say);
      }
    }
    this.talkDefs.set(name, { text, opts, buffer: null });
  }

  /**
   * テキストをその場で再生します。
   *
   * `defineTalk()` と `playTalk()` をまとめて行う短い書き方です。
   *
   * ```js
   * voice.talk('コンニチワ');
   * ```
   *
   * 登録は残らないので、作った波形も保持しません。同じテキストを
   * 繰り返し再生するなら `defineTalk()` で名前を付けてください。
   *
   * @param {string} text カタカナ。`defineTalk()` と同じ
   * @param {object} [opts] 音声のパラメータ。`defineTalk()` と同じ
   * @param {number} [priority=0] `playTalk()` と同じ
   * @returns {number|undefined} 再生 ID。再生できなかったときは undefined
   */
  talk(text, opts = {}, priority = 0) {
    const name = AUTO_TALK + (++this._talkSeq);
    this.defineTalk(name, text, opts);
    const id = this.playTalk(name, priority, opts);
    // 再生を始めたら登録を消す。波形は再生側が参照しているので最後まで鳴る。
    // 消さないと、名前の分からないものが溜まり続けて捨てられなくなる
    this.talkDefs.delete(name);
    return id;
  }

  /**
   * 読み上げられない文字を調べます。再生はしません。
   *
   * 登録する前に確かめるときに使います。読めない文字がテキストのどこにあるかも返します。
   *
   * ```js
   * const got = voice.checkTalk('今日は 3ガツ デス');
   * // { ok: false, kana: 6, unknown: [{ ch: '今', at: 0, kind: 'kanji' }, ...] }
   * ```
   *
   * @param {string} text 調べるテキスト
   * @returns {{ok: boolean, kana: number,
   *            unknown: Array<{ch: string, at: number, kind: string}>}}
   *   `ok` は読めない文字が無ければ true、`kana` は読めた文字数、
   *   `at` はテキスト内の位置、`kind` は文字の種別
   */
  checkTalk(text) {
    return checkTalk(text);
  }

  /**
   * 波形の生成だけを行います。再生はしません。
   *
   * `playTalk()` は初回に波形を生成するため、その分だけ再生の開始が遅れます。
   * 複数を重ねて再生するとき、この遅れがずれになります。2 人分を続けて
   * `playTalk()` すると、2 人目は 1 人目の生成が終わってから始まります。
   * 先に両方を生成しておけば、ずれずに重なります。
   *
   * @param {string|string[]} name `defineTalk()` で登録した名前。配列で渡せます
   * @returns {void}
   */
  prepareTalk(name) {
    // 重ねる分をまとめて作る。1 つずつ呼ばせると、書き忘れた分だけずれる
    if (Array.isArray(name)) { for (const n of name) this.prepareTalk(n); return; }
    const def = this.talkDefs.get(name);
    if (!def || !this.ctx || def.buffer) return;
    // 粗さを保ったまま再生したいので、生成したサンプリング周波数のまま
    // AudioBuffer を作る。再生時にブラウザが補間する
    const { rate, data } = renderTalk(def.text, def.opts);
    const buf = this.ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    def.buffer = buf;
  }

  /**
   * 登録済みのテキストを再生します。
   *
   * 波形は初回に生成し、名前ごとに保持します。2 回目以降は作り直しません。
   * 同時再生数（`maxTalk`）を超えると、優先度の低いものが停止します。
   *
   * @param {string|string[]} name `defineTalk()` で登録した名前。
   *   配列を渡すと、すべての波形を生成してから続けて再生します
   * @param {number} [priority=0] 値が大きいほど優先されます
   * @param {object} [opts]
   *   `gain` は音量の倍率、`rate` は再生速度（1 より大きいと速く高くなります）
   * @returns {number|number[]|undefined} 再生 ID。配列を渡したときは配列。
   *   再生できなかったときは undefined
   */
  playTalk(name, priority = 0, opts = {}) {
    // 再生の前に必ず有効にする。呼び出し側に unlock() を書かせると、
    // 書き忘れが「音が鳴らない」という形で出てしまう
    this.unlock();
    // 重ねるときは配列で渡す。先にすべての波形を作ってから再生するので、
    // 2 人目が 1 人目の生成を待たずに済む。
    // 2 番目の引数は優先度なので、名前を並べる形にはできない
    if (Array.isArray(name)) {
      this.prepareTalk(name);
      return name.map((n) => this.playTalk(n, priority, opts));
    }
    const def = this.talkDefs.get(name);
    if (!def || !this.ctx) return;
    // 同時に再生できるセリフの数を超えた分は、古いほうから止める
    const room = Math.max(1, this.maxTalk | 0) || 1;
    const talking = this.seVoices.filter((v) => v.talk);
    for (let i = 0; i <= talking.length - room; i++) this._stopVoice(talking[i]);
    const now = this.ctx.currentTime;
    this._cleanupSE(now);
    if (this.seVoices.some(v => v.exclusive && v.priority > priority)) return;
    // 空きが無ければ、優先度の低いものを止めて作る
    while (this._usedVoices() + 1 > this.maxVoices) {
      let low = null;
      for (const v of this.seVoices) {
        if (v.priority >= priority) continue;
        if (!low || v.priority < low.priority) low = v;
      }
      if (!low) return 0;
      this._stopVoice(low);
    }
    this.prepareTalk(name);
    const gain = this.ctx.createGain();
    gain.gain.value = (def.opts.gain ?? 1) * 0.9;
    gain.connect(this._out());
    const src = this.ctx.createBufferSource();
    src.buffer = def.buffer;
    src.connect(gain);
    const when = now + 0.02;
    src.start(when);
    const v = {
      gain, nodes: [src], priority, voices: 1, noise: 0,
      endTime: when + def.buffer.duration, exclusive: !!opts.exclusive,
      talk: name, id: ++this._seSeq,
    };
    this.seVoices.push(v);
    return v.id;
  }

  /**
   * 保持している波形を破棄します。
   *
   * `defineTalk()` は名前ごとに波形を持ち続けます。作り直さずに済ませるためですが、
   * その分メモリを使います。使わなくなったものは破棄できます。
   *
   * ```js
   * voice.forgetTalk('hello');              // 名前を指定して破棄
   * voice.forgetTalk(['demo1', 'demo2']);   // まとめて破棄
   * voice.forgetTalk();                     // すべて破棄
   * ```
   *
   * 再生中のものは最後まで再生されます。波形は再生側が参照しています。
   *
   * @param {string|string[]} [name] 登録名。省略するとすべて破棄します
   * @returns {void}
   */
  forgetTalk(name) {
    if (name == null) { this.talkDefs.clear(); return; }
    for (const n of (Array.isArray(name) ? name : [name])) this.talkDefs.delete(n);
  }

  /**
   * 再生中のものを停止します。
   *
   * @param {string|number} [what] 登録名、または `playTalk()` の戻り値。
   *   省略するとすべて停止します
   * @returns {void}
   */
  stopTalk(what) {
    for (const v of [...this.seVoices]) {
      if (!v.talk) continue;
      if (what !== undefined && v.talk !== what && v.id !== what) continue;
      this._stopVoice(v);
    }
  }
}
