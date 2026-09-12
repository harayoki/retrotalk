# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0]

Open source release under the MIT License.

### Added

- MIT License. The engine may now be redistributed and modified.
- `src/` — the unbundled sources.
- `build.mjs` — builds `dist/retrotalk.js` and `dist/retrotalk.min.js` from `src/`.
- `test/` — tests that run without a browser (`npm test`).
- `example/index.html` — a minimal working page.
- The published page links to the API reference at its foot.

### Changed

- The speech engine no longer carries the music engine with it. The bundle is
  about a fifth of the size it was.
- `MmsxxRetroTalk` is the only global the script defines.
- The `AudioContext` is now passed in by the caller:
  `new MmsxxRetroTalk(new AudioContext())`. It used to be created internally,
  which meant two of them on a page that already had audio.
- Functions that do not play anything are now on the class:
  `MmsxxRetroTalk.renderTalk()` and so on.

### Removed

- The obfuscated build. There is nothing to hide in an open source release.
- The zip the site used to offer. The download points at the releases page.
- The breadcrumb on the published page. It named a manual the page is not
  part of, and neither the entry nor the neighbouring pages are published.
- The music engine's name from the version strip. That engine is not on this
  page; the strip names RetroTalk only.

## [2.0.0]

Provisional release. No license was attached, so the terms were unclear;
2.1.0 is the first release anyone may rely on.

### Added

- Formant speech synthesis for Japanese kana, in the style of a 1980s
  Japanese personal computer.
- `talk()`, `defineTalk()`, `playTalk()`, `prepareTalk()`, `stopTalk()`,
  `forgetTalk()`, `checkTalk()`.
- `renderTalk()` — returns the waveform without playing it.
- `@p`, `@s` and `@v` for pitch, speed and volume inside the text.
- `！` `？` `！？` `（ ）` `＞` `＜` `…` `〜` for intonation.
- Singing through the `sing` option.
- Reading VOICEVOX project files (`.vvproj`).
