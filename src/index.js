// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// RetroTalk の入口です。
//
// クラス本体は `talk_audio.js` にあります。ここでは、再生を伴わない関数を
// そのクラスに付けて 1 つにまとめています。使う側が覚える名前を
// `MmsxxRetroTalk` の 1 つだけにするためです。

import { TalkAudio } from './talk_audio.js';
import { renderTalk, talkFrames, TALK_DEFAULTS, TALK_STYLES } from './talk.js';
import { checkTalk, parseTalk } from './kana.js';
import { checkAqua } from './aquestalk.js';
import { voicevoxText, voicevoxInfo } from './voicevox.js';
import { encodeWAV } from './wav.js';
import { RETROTALK_VERSION } from './version.js';

// 再生を伴わない関数は、クラスに付けます。インスタンスは声そのもので、
// こちらは声を作らずに調べたり変換したりする道具です。
// クラスに付けておくと、`new` しなくても使えることが呼び方から分かります。
Object.assign(TalkAudio, {
  renderTalk,
  talkFrames,
  parseTalk,
  checkTalk,
  checkAqua,
  voicevoxText,
  voicevoxInfo,
  encodeWAV,
  TALK_DEFAULTS,
  TALK_STYLES,
  VERSION: RETROTALK_VERSION,
});

export { TalkAudio as MmsxxRetroTalk };
export default TalkAudio;
