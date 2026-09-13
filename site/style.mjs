// 読ませるページの色と書体。3 枚で同じものを使う。
//
// ---- なぜ 1 か所に出したか ----
//
// ページが 3 枚になった。同じ色の決めごとが 3 か所にあると、
// 1 枚だけ直して残りが取り残される。行き来できるようにしたぶん、
// 揃っていないことがそのまま目に見える。
//
// 明るいほう(素の `:root`)・暗いほう(`prefers-color-scheme`)・
// はっきり選んだとき(`[data-theme]`)の 3 つを、トークンの層で持つ。
// 色は必ずこの 3 つとも書く — 片方だけに書くと、選び方によって
// 色が抜けたページが出る。

export const TOKENS_CSS = `
:root{
  --ground:#efedE8; --panel:#f7f6f3; --sunk:#e5e2db;
  --line:#d4d0c7; --line-hi:#b5b0a4;
  --ink:#23252b; --dim:#7b7970;
  --amber:#96620f; --teal:#1d6f68;
  /* 地色を敷いた上に載せる字の色。地色と逆に振る —
     明るいほうは白、暗いほうはほぼ黒。琥珀の帯に載っても読める */
  --bg:#ffffff;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --jp:"IBM Plex Sans JP","Hiragino Sans","Noto Sans JP",system-ui,sans-serif;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#141519; --panel:#1b1d22; --sunk:#101115;
    --line:#2a2d34; --line-hi:#3e434c; --ink:#c7cad1; --dim:#71767f;
    --amber:#e0a13c; --teal:#63c6b6; --bg:#141519;
  }
}
:root[data-theme="dark"]{
  --ground:#141519; --panel:#1b1d22; --sunk:#101115;
  --line:#2a2d34; --line-hi:#3e434c; --ink:#c7cad1; --dim:#71767f;
  --amber:#e0a13c; --teal:#63c6b6; --bg:#141519;
}

/* ---- 切り替えの帯。6 枚で同じもの ----

   Auto / Light / Dark のような同じ仲間から 1 つ選ぶものは、
   くっつけて 1 つのコントロールに見せる。離して並べると別々の入 / 切に見え、
   3 つとも切れるように見えてしまう。

   押してあるほうは黒地。このページの色で「いま効いている」と言えるのは
   地の反転で、琥珀色は押せるものに使っている(送り・札・見出し)。 */
.seg{display:inline-flex; border:1px solid var(--line-hi); border-radius:2px; overflow:hidden}
.seg button{
  font:inherit; font-size:11.5px; cursor:pointer;
  background:transparent; border:0; padding:3px 10px; color:var(--dim);
}
.seg button + button{border-left:1px solid var(--line-hi)}
.seg button[aria-pressed="true"]{background:var(--ink); color:var(--ground)}
.seg button:hover[aria-pressed="false"]{color:var(--amber)}
:focus-visible{outline:2px solid var(--amber); outline-offset:1px}

/* 行き来の見た目はここへ差し込む。テンプレートの側には書かない —
   両方に書くと、先に差し込んだほうだけが埋まって、もう片方が字のまま残る */
/*__NAV_CSS__*/
`;
