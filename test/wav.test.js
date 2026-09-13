// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// WAV 書き出しを確かめます。
//
// encodeWAV は計算だけなので、Web Audio もブラウザも要りません。
// AudioBuffer のふりをする入れ物を渡せば、Node でそのまま試せます。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWAV } from '../src/wav.js';

/** AudioBuffer のふりをする(encodeWAV が見るのはこの 4 つだけ) */
const fakeBuffer = (channels, sampleRate = 44100) => ({
  sampleRate,
  numberOfChannels: channels.length,
  length: channels[0].length,
  getChannelData: (i) => channels[i],
});

const f32 = (...v) => Float32Array.from(v);
const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const ascii = (bytes, at, len) =>
  String.fromCharCode(...bytes.slice(at, at + len));

test('RIFF の見出しがそろっている', () => {
  const w = encodeWAV(fakeBuffer([f32(0, 0, 0, 0)], 44100));
  assert.equal(ascii(w, 0, 4), 'RIFF', 'RIFF');
  assert.equal(ascii(w, 8, 4), 'WAVE', 'WAVE');
  assert.equal(ascii(w, 12, 4), 'fmt ', 'fmt(うしろの空白まで含めて 4 文字)');
  assert.equal(ascii(w, 36, 4), 'data', 'data');
});

test('大きさの欄が中身と合っている', () => {
  const frames = 100, ch = 2;
  const w = encodeWAV(fakeBuffer([new Float32Array(frames), new Float32Array(frames)]));
  const v = view(w);
  const dataSize = frames * ch * 2;
  assert.equal(w.length, 44 + dataSize, 'ファイル全体');
  assert.equal(v.getUint32(4, true), 36 + dataSize, 'RIFF の大きさ');
  assert.equal(v.getUint32(40, true), dataSize, 'data の大きさ');
});

test('fmt の中身(16 ビット PCM)', () => {
  const w = encodeWAV(fakeBuffer([f32(0), f32(0)], 22050));
  const v = view(w);
  assert.equal(v.getUint32(16, true), 16, 'fmt の長さ');
  assert.equal(v.getUint16(20, true), 1, '無圧縮 PCM');
  assert.equal(v.getUint16(22, true), 2, 'チャンネル数');
  assert.equal(v.getUint32(24, true), 22050, 'サンプリング周波数');
  assert.equal(v.getUint32(28, true), 22050 * 2 * 2, '毎秒のバイト数');
  assert.equal(v.getUint16(32, true), 4, '1 サンプルぶんのバイト数');
  assert.equal(v.getUint16(34, true), 16, 'ビット数');
});

test('振り切ったところが正しく当たる', () => {
  const w = encodeWAV(fakeBuffer([f32(0, 1, -1)]));
  const v = view(w);
  assert.equal(v.getInt16(44, true), 0, '0 は 0');
  assert.equal(v.getInt16(46, true), 32767, '+1 は上いっぱい');
  assert.equal(v.getInt16(48, true), -32768, '-1 はちょうど下いっぱい');
});

test('範囲の外は切り詰める(回り込ませない)', () => {
  const w = encodeWAV(fakeBuffer([f32(2, -2, 99)]));
  const v = view(w);
  assert.equal(v.getInt16(44, true), 32767, '上へはみ出し');
  assert.equal(v.getInt16(46, true), -32768, '下へはみ出し');
  assert.equal(v.getInt16(48, true), 32767, '大きくはみ出しても同じ');
});

test('左右は 1 サンプルずつ交互に並ぶ', () => {
  const w = encodeWAV(fakeBuffer([f32(1, 1), f32(-1, -1)]));
  const v = view(w);
  assert.equal(v.getInt16(44, true), 32767, '1 個め左');
  assert.equal(v.getInt16(46, true), -32768, '1 個め右');
  assert.equal(v.getInt16(48, true), 32767, '2 個め左');
  assert.equal(v.getInt16(50, true), -32768, '2 個め右');
});

test('中くらいの値が往復して戻る', () => {
  const src = f32(0.5, -0.5, 0.25);
  const w = encodeWAV(fakeBuffer([src]));
  const v = view(w);
  for (let i = 0; i < src.length; i++) {
    const back = v.getInt16(44 + i * 2, true) / (src[i] < 0 ? 0x8000 : 0x7fff);
    assert.ok(Math.abs(back - src[i]) < 1e-4, `${src[i]} → ${back}`);
  }
});

test('無音でも中身のあるファイルになる', () => {
  const w = encodeWAV(fakeBuffer([new Float32Array(0)]));
  assert.equal(w.length, 44, '見出しだけ');
  assert.equal(view(w).getUint32(40, true), 0, 'data は 0 バイト');
});
