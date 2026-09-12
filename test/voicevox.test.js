// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// VOICEVOX のプロジェクトファイルを読めることを確かめます。
//
// 読み込むファイルの中身は VOICEVOX 側の都合で変わります。
// 項目が増えたり名前が変わったりしても、こちらは何も言わずに
// 空の文を返すだけなので、気づけません。ここで押さえておきます。
//
// test/sample.vvproj は VOICEVOX 0.25.0 が書き出したものをそのまま置いています。
// 手を入れると、実際に渡されるものとの違いがここで見えなくなります。
// 次のものが入っています。
//
//   撥音(ン)、無声化した拍(vowel が大文字の U)、句のあとの間(pauseMora)
//   話速・抑揚・間の倍率が既定でない文、母音だけの拍、拗音(キョ)
//
// 壊れたものと、/audio_query の形は、この下で手で組んでいます。
// 書き出せないものなので、ファイルから持ってこられません。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { voicevoxText, voicevoxInfo, parseVoicevox } from '../src/voicevox.js';
import { checkTalk, parseTalk } from '../src/kana.js';

const RAW = readFileSync(fileURLToPath(new URL('./sample.vvproj', import.meta.url)), 'utf8');
const DATA = JSON.parse(RAW);

/** 指示(@p @s)と区切りを外して、読みだけにします */
const kanaOnly = (s) => s.replace(/@[psv]-?\d+/g, '').replace(/[、。 ]/g, '');

test('.vvproj を読むと、文の数と拍の数が分かる', () => {
  const info = voicevoxInfo(RAW);
  assert.equal(info.ok, true);
  assert.equal(info.version, '0.25.0');
  assert.equal(info.lines, 3);
  assert.equal(info.moras, 46);
});

test('文字列でもオブジェクトでも同じ結果になる', () => {
  assert.deepEqual(voicevoxInfo(DATA), voicevoxInfo(RAW));
  assert.equal(voicevoxText(DATA), voicevoxText(RAW));
});

test('読みが順番どおりに並ぶ', () => {
  const bare = voicevoxText(RAW, { useMeta: false, usePitch: false, useLength: false });
  assert.equal(bare,
    'ボクワ、トオキョオイチノプログラマア。ニ、アコガレルタダノゲエマア、'
    + 'ズンダモンナノダ。カスカベツムギデス。');
});

test('無声化した拍も落ちない', () => {
  // カスカベ の ス と デス の ス は、vowel が大文字(無声化)で pitch が 0 です。
  // 高さを持たないので、平均を出すところで数に入れると読みごと消えます
  const kana = kanaOnly(voicevoxText(RAW));
  assert.equal((kana.match(/ス/g) || []).length, 2);
  // 拍は 46 ですが、キョ が 2 文字なので 1 文字多くなります
  assert.equal(kana.length, 47);
});

test('句のあとの間が、区切りとして出る', () => {
  const bare = voicevoxText(RAW, { useMeta: false, usePitch: false, useLength: false });
  // pauseMora は 3 つ。文の終わりの 。 とは別に数えます
  assert.equal((bare.match(/、/g) || []).length, 3);
  assert.equal((bare.match(/。/g) || []).length, 3);
});

test('切れ目が重ならない', () => {
  // セリフの終わりの 。 の直後に、次のセリフの頭の間が続きます。
  // 置いたままにすると 。、 と並び、長い間のあとにもう一度短い間が入ります
  assert.equal(/[、。 ]{2,}/.test(voicevoxText(RAW)), false);
});

test('usePitch と useLength を外すと、指示が出ない', () => {
  const noPitch = voicevoxText(RAW, { usePitch: false });
  assert.equal(/@p/.test(noPitch), false);
  assert.equal(/@s/.test(noPitch), true);

  const noLength = voicevoxText(RAW, { useLength: false });
  assert.equal(/@s/.test(noLength), false);
  assert.equal(/@p/.test(noLength), true);
});

test('useMeta を外すと、VOICEVOX 側の倍率が掛からない', () => {
  // 1 つめの文だけ、話速 1.22、抑揚 1.42、間 0.67 です。
  // 掛けるかどうかで、長さと高さの指示が変わります
  const on = voicevoxText(RAW);
  const off = voicevoxText(RAW, { useMeta: false });
  assert.notEqual(on, off);
  // 読みそのものは動きません
  assert.equal(kanaOnly(on), kanaOnly(off));
});

test('出来た文は、そのまま RetroTalk で読める', () => {
  const said = voicevoxText(RAW);
  const check = checkTalk(said);
  assert.equal(check.ok, true);
  assert.deepEqual(check.unknown, []);
  assert.equal(check.kana, 47);
});

test('parseVoicevox は、文に直してから読み直したものと同じ', () => {
  assert.deepEqual(parseVoicevox(RAW), parseTalk(voicevoxText(RAW)));
});

test('/audio_query の形(項目名が snake_case)も読める', () => {
  const one = {
    accent_phrases: [{
      moras: [
        { text: 'ア', vowel: 'a', vowel_length: 0.1, pitch: 5.7 },
        { text: 'イ', vowel: 'i', vowel_length: 0.1, pitch: 5.9 },
      ],
      accent: 1,
      pause_mora: { text: '、', vowel: 'pau', vowel_length: 0.3, pitch: 0 },
    }],
    speed_scale: 1,
    pitch_scale: 0,
    intonation_scale: 1,
    pause_length_scale: 1,
  };
  const info = voicevoxInfo(one);
  assert.equal(info.ok, true);
  assert.equal(info.lines, 1);
  assert.equal(info.moras, 2);
  assert.equal(kanaOnly(voicevoxText(one)), 'アイ');
});

test('読めないものを渡すと、空の文が返る', () => {
  for (const bad of ['', '{', '{}', 'null', {}, null, undefined, { talk: {} }]) {
    assert.equal(voicevoxInfo(bad).ok, false);
    assert.equal(voicevoxText(bad), '');
  }
});
