// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// `<script>` で読み込んだときに `MmsxxRetroTalk` を定義します。
//
// `index.js` は `import` して使う人のためのもので、名前を定義しません。

import RetroTalk from './index.js';

globalThis.MmsxxRetroTalk = RetroTalk;
