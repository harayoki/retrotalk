// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// 音を出すための基底クラスです。AudioContext と出力先、再生中の音の管理だけを持ちます。
//
// 音声合成そのものは扱いません。TalkAudio がこれを継承して、
// 音声の登録と再生を足します。

/**
 * 音を出すための基底クラスです。
 *
 * `AudioContext` と出力先、再生中の音の管理だけを持ちます。音声合成は扱いません。
 * 使うのは `MmsxxRetroTalk` のほうで、このクラスはそれが継承しているものです。
 */
export class SimpleAudio {
  /**
   * @param {AudioContext} ctx 呼び出し側で作った AudioContext。
   *   これが無いと再生できません（`unlock()` を参照）
   * @param {object} [opts]
   * @param {number} [opts.maxVoices=8] 同時に再生できる音の数
   */
  constructor(ctx, opts = {}) {
    /** @type {AudioContext|null} */
    this.ctx = ctx || null;
    /** 再生中の音。空きがあれば重ねて鳴ります */
    this.seVoices = [];
    this.maxVoices = opts.maxVoices ?? 8;
    /** 継承先が使う枠。このクラスでは 0 のままです */
    this.bgmVoices = 0;
    /** 再生ごとの管理番号。指定して停止するために使います */
    this._seSeq = 0;
    /** 継承先が使う枠。このクラスでは false のままです */
    this._sePausedAll = false;
    /** 継承先が使う枠。このクラスでは 0 のままです */
    this._keepSec = 0;
  }

  /**
   * 再生できる状態にします。
   *
   * ユーザーがページを一度操作したあとに呼びます。ブラウザの制限によるものです。
   * `talk()` と `playTalk()` は内部で呼ぶので、通常は呼び出す必要がありません。
   *
   * AudioContext はここでは作りません。呼び出し側で作って渡してください。
   *
   * ```js
   * const voice = new TalkAudio(new AudioContext());
   * ```
   *
   * ブラウザが同時に作れる AudioContext の数には上限があり、
   * ライブラリがそれぞれ勝手に作ると足りなくなります。
   *
   * @throws {Error} AudioContext が渡されていないとき
   */
  unlock() {
    if (!this.ctx) {
      throw new Error('SimpleAudio: AudioContext を渡してください'
        + ' — new TalkAudio(new AudioContext())');
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /**
   * 出力の記録を開始します。継承先が実装します。
   * `_out()` から呼ばれるため、ここでは空のまま用意してあります
   */
  _startTap() { /* 継承先が実装する */ }

  /** 再生が終わった音を片づける */
  _cleanupSE(now) {
    this.seVoices = this.seVoices.filter((v) => {
      if (now < v.endTime) return true;
      // くり返しの途中なら、まだ片づけない
      if (v.left !== 0 && v.timer) return true;
      // 一時停止中のものは、解除したときに鳴り直すので残す。
      // システム側の音は一時停止中でも鳴り切るので、そのまま片づける
      if (!v.system && (v.paused || this._sePausedAll)) return true;
      if (v.timer) { clearTimeout(v.timer); v.timer = 0; }
      try { v.gain.disconnect(); } catch (e) { /* already gone */ }
      return false;
    });
  }

  /** 再生中の音の数 */
  _usedVoices() {
    return this.bgmVoices + this.seVoices.reduce((n, v) => n + v.voices, 0);
  }

  /** 音を 1 つ止める */
  _stopVoice(v) {
    if (v.timer) { clearTimeout(v.timer); v.timer = 0; }
    v.left = 0;   // 繰り返しの予約が残っていても、もう積まない
    for (const n of v.nodes) { try { n.stop(0); } catch (e) { /* stopped */ } }
    try { v.gain.disconnect(); } catch (e) { /* already gone */ }
    this.seVoices = this.seVoices.filter(x => x !== v);
  }

  /**
   * 音の出力先を返します。すべての音がここを通るため、
   * ここ 1 か所で全体の消音と音量を扱えます
   */
  _out() {
    if (!this.ctx) return null;
    if (!this._bus) {
      // 出力は 2 段。手前(bus)で記録して、後ろ(master)で消音する。
      // こうしておくと、消音していても記録には鳴っていた音が入る
      this._master = this.ctx.createGain();
      this._master.gain.value = this._muted ? 0 : this.volume;
      this._master.connect(this.ctx.destination);
      this._bus = this.ctx.createGain();
      this._bus.gain.value = 1;
      this._bus.connect(this._master);
      // 記録の指示が先に来ていたら、ここで始める
      if (this._keepSec > 0) this._startTap(this._keepSec);
    }
    return this._bus;
  }

  /**
   * 消音します。再生は止めずに出力だけを閉じるので、
   * 戻したときは続きから聞こえます。
   *
   * @param {boolean} [on] 省略すると切り替えます
   * @returns {boolean} いま消音しているか
   */
  mute(on) {
    this._muted = (on === undefined) ? !this._muted : !!on;
    this._out();                 // 出口を用意させる
    const out = this._master;    // 絞るのは後ろの段。記録するほうは絞らない
    if (out) {
      const t = this.ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      // ぷつっと切れないよう、ごく短く滑らせる
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(this._muted ? 0 : this.volume, t + 0.05);
    }
    return this._muted;
  }

  /**
   * 音量です。0 〜 8 で、初期値は 1 です。
   *
   * 1 を超えると増幅します。上げすぎると歪むので、聞きながら決めてください。
   * 消音は `mute()` の役目で、このプロパティは音量だけを扱います。
   */
  get volume() { return this._vol == null ? 1 : this._vol; }

  set volume(v) {
    // 1 を超えてよい。出力には増幅の余裕を取ってある。
    // 初期値は 1 なので、指定しなければ素の音量になる。
    this._vol = Math.max(0, Math.min(8, Number(v) || 0));
    if (this._master && !this._muted) {
      const t = this.ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setValueAtTime(this._master.gain.value, t);
      this._master.gain.linearRampToValueAtTime(this._vol, t + 0.05);
    }
  }

  /** いま消音しているか */
  get muted() { return !!this._muted; }

}
