// SPDX-FileCopyrightText: 2026 harayoki
// SPDX-License-Identifier: MIT

// ページに埋めるエンジンを、その場で固めます。
//
// 固め方を 1 か所に置いているのは、ページが 3 枚あるためです。別々に固めると、
// 片方だけ直したときに古いエンジンが埋まったページが出ます。

import * as esbuild from 'esbuild';

/**
 * 配るものと同じ 1 つに固めます。定義される名前は `MmsxxRetroTalk` だけです。
 *
 * @returns {Promise<string>}
 */
export async function bundleEngine() {
  const built = await esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'iife',
    globalName: '__retrotalk',
    footer: { js: 'var MmsxxRetroTalk = __retrotalk.default;' },
    charset: 'utf8',
    minify: true,
    write: false,
  });
  return built.outputFiles[0].text;
}

/**
 * `</script>` を割って逃がします。そのまま埋めると script がそこで閉じます。
 *
 * @param {string} s
 * @returns {string}
 */
export const safe = (s) => s.split('</script>').join('<\\/script>');
