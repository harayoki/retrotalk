// **話す人の一覧。**解説ページの入力欄と、送られたリンクを開くページの
// 両方がこれを見る。別々に書くと、送ったリンクが向こうで違う声で鳴る。
//
// 並びは `[名前, 見出し, つまみ]`。名前はリンクにそのまま載るので、
// **一度出したら変えない** — 変えると、前に送られたリンクの声が変わる。

/** @type {Array<[string, {en: string, ja: string}, object]>} */
export const VOICES = [
  // **既定はページの声そのまま。**ほかの例と同じ声にしておくと、
  // 下まで読んだときに「さっき聞いたあれ」と繋がる
  ['woman', { en: 'Woman', ja: '女の人' }, {}],
  ['man', { en: 'Man', ja: '男の人' }, { pitch: 150, formantShift: -4 }],
  // **棒読みは速さを落とさない。**1 フレーム 20ms にすると半分の速さになるので、
  // 粗さは量子化(bits)だけで出す
  ['robot', { en: 'Robot', ja: '棒読み' }, { pitch: 220, fall: 0, rise: 0, bits: 5 }],
  // **無線は粗さが要る**ので 20ms のまま。そのぶん speed で戻す
  ['radio', { en: 'Radio', ja: '無線ごし' },
    { pitch: 200, frame: 0.02, speed: 1.8, bits: 4, breath: 0.2 }],
  // **ゾンビ。**掛け合わせで音程が壊れたところへ、遅さとかすれを足す
  ['zombie', { en: 'Zombie', ja: 'ゾンビ' },
    { pitch: 200, ring: 55, formantShift: -3, jitter: 0.15, speed: 0.8 }],
  // **機械は高くて、少し遅くて、抑揚が無い。**
  // 揺らぎや荒れではなく、**平らなことが人でなさ**になる
  ['computer', { en: 'Computer', ja: 'コンピューター' },
    { pitch: 300, formantShift: 3, fall: 0, rise: 0, speed: 0.85, ring: 30 }],
];

/** 既定の人。リンクにこの名前は載せない */
export const VOICE_DEFAULT = VOICES[0][0];

/** 型紙に流し込む形 */
export const VOICES_JSON = JSON.stringify(VOICES);
