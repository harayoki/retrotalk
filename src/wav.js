// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

/**
 * 音声データを WAV（RIFF / 16 ビット PCM）のバイト列に変換します。
 *
 * 外部に保存したいときに使います。
 *
 * `renderTalk()` が返すのは `{ rate, data }` なので、包み直してから渡します。
 *
 * ```js
 * const got = MmsxxRetroTalk.renderTalk('コンニチワ');
 * const wav = MmsxxRetroTalk.encodeWAV({
 *   sampleRate: got.rate, numberOfChannels: 1, length: got.data.length,
 *   getChannelData: () => got.data,
 * });
 * const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
 * ```
 *
 * Web Audio を必要としないため、ブラウザの外でも実行できます。
 *
 * @param {{sampleRate: number, numberOfChannels: number, length: number,
 *          getChannelData: function(number): Float32Array}} buffer
 *   AudioBuffer、または同じ形のオブジェクト
 * @returns {Uint8Array} 44 バイトのヘッダーと、それに続く音声データ
 * @alias TalkAudio.encodeWAV
 * @static
 */
export function encodeWAV(buffer) {
  const ch = buffer.numberOfChannels;
  const frames = buffer.length;
  const rate = buffer.sampleRate;
  const bytes = 2;                        // 16 ビット
  const dataSize = frames * ch * bytes;
  const out = new Uint8Array(44 + dataSize);
  const view = new DataView(out.buffer);
  let p = 0;
  const str = (t) => { for (const c of t) out[p++] = c.charCodeAt(0); };
  const u32 = (v) => { view.setUint32(p, v, true); p += 4; };
  const u16 = (v) => { view.setUint16(p, v, true); p += 2; };

  str('RIFF'); u32(36 + dataSize); str('WAVE');
  str('fmt '); u32(16); u16(1); u16(ch);
  u32(rate); u32(rate * ch * bytes); u16(ch * bytes); u16(8 * bytes);
  str('data'); u32(dataSize);

  const src = [];
  for (let c = 0; c < ch; c++) src.push(buffer.getChannelData(c));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, src[c][i]));
      // 負の側だけ 32768 倍するのは、-1 をちょうど -32768 に合わせるため。
      // 両側を 32767 倍すると、いちばん低いところがわずかに浅くなる
      view.setInt16(p, Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), true);
      p += 2;
    }
  }
  return out;
}
