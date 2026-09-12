# RetroTalk

80年代の日本のNEC製パソコン（PC6001系）には独特な響きの日本語を話す機能がありました。
そのパソコンのボイス機能と同じ基本的な仕組みを使って日本語をしゃべらせるJavaScript製ライブラリがRetroTalkです。

* 実行時は外部ライブラリに依存しません。
* 当時のパソコンと声の雰囲気はかなり似ていますが、全く同じ声を出す事を目的としていません。
* 発声の詳細はカスタマイズされています。
* 独自の制御文でコントロールします。

## QUICK START

```html
<script src="dist/retrotalk.js"></script>
<script>
  const voice = new MmsxxRetroTalk(new AudioContext());
  voice.talk('コンニチワ');
</script>
```

※ ブラウザの制限により、声が出るのは、ユーザーが一度ページ操作（クリックなど）をした後となります。

## ドキュメント

* [デモとマニュアル](https://harayoki.github.io/retrotalk/)
* [API リファレンス](https://harayoki.github.io/retrotalk/api/)
* [声の比較](https://harayoki.github.io/retrotalk/listen/)

`example/index.html` をブラウザで開くと、そのまま試せます。

## ビルド方法

```
npm install
npm run build
```

`dist/retrotalk.js`（未圧縮版）と `dist/retrotalk.min.js`（圧縮版）が生成されます。

## ライセンス

MIT License です。全文は [LICENSE](LICENSE) にあります。
出力された音声ファイルの利用に制限はありません。

※ エンジンや出力ファイルが原因で生じたトラブル・損害について、作者は一切の責任を負わない事とします。
