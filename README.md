# バクテリア・レース 3D / Bacteria Race 3D

## ▶ [ここを押して遊ぶ / Play in your browser](https://naokiauemura-arch.github.io/bacteria-race-3d/)

インストール不要。パソコンでもスマートフォンでも、上のリンクを開くだけで遊べます。
No install needed. Open the link above on a computer or phone. English is available from the 日本語 / English switch at the top of the menu.

8種の細菌が1本のコースで混走する3Dアイテムバトルレースです。各菌の速さは、論文
[Cell-scale confinement reorders bacterial speed rankings](https://www.biorxiv.org/content/10.64898/2026.11.04.764272v1)（bioRxiv）で
粘性なし・粘性あり・狭小の3環境について実測された平均遊泳速度をもとにしています。

## 30秒でわかる遊び方

1. **細菌を1つ選ぶ**。バーは環境ごとの速さ、下の ◎○× は抗生物質の効きやすさです。迷ったら *V. fischeri*（万能型）がおすすめ。
2. **コースを選んで「スタート」**。最初は「マイクロ流体サーキット」が素直です。
3. **ゴールまで走る**。回転する箱でアイテムを取り、Space で使います。

| 操作 | キーボード | スマートフォン |
|---|---|---|
| 左右移動 | ← → または A D | ◀ ▶ |
| アイテムを使う | Space | 「使う」 |
| ラッピング切替（*V. fischeri*・*C. insecticola*・*C. jejuni*） | Shift | 「巻く」 |

### コツ

- 道が左右で「狭小」と「粘性」などに分かれる所は、自分の菌が速い側へ。
- 黄色い看板の**近道**は粘性ですが、道のりが短くなります。
- 穴に落ちる、柵のない縁から出ると場外で、少し手前からやり直しです。
- 抗生物質は菌ごとに効き方が違います。アイテム欄の ◎○× を見てから使いましょう。
- ラッピングは狭小区画に入る前に ON、出たら OFF が得です。

## 内容

- **5つのコース**: マイクロ流体サーキット、腸内クリプト・バレー、土壌ポア・ラビリンス、発光器ナイトラン、熱水噴出孔ラッシュ。粘性なし・粘性あり・狭小の区画が左右にも入り組み、粘性の近道、穴、柵のない縁（場外）があります。
- **アイテム**: グルコース（加速）、ファージ（前の1菌を追尾）、抗生物質5系統（相性あり）、バイオフィルム（防御）。*C. jejuni* はグルコキナーゼを欠きグルコースを代謝できないため、この菌だけグルコースで加速せず、アイテムとしても出ません。
- **ラッピングモード**: べん毛を菌体に巻きつけ、狭小区画で加速します。
- **キチン区画**: 白いキチンの区画では *F. johnsoniae* だけが加速します。可溶性キチナーゼを分泌せず細胞が不溶性キチンに直接接触して分解する性質に合わせ、触れている間だけ加速がじわじわ立ち上がります（最大2.1倍、約0.55秒で立ち上がり、離れると約1.4秒かけて落ちます）。ほかの7種には効果がありません。区画はコースあたり2〜7か所で、狭い流路や近道と重ならない場所に置かれます。
- **滑走（SprB）**: *F. johnsoniae* は、細胞表面の接着因子 SprB が左巻きのらせん状閉ループ上を流れ、体を回しながら進みます。軌道と約20°のピッチ角は [Nakane et al., PNAS 110, 11145 (2013)](https://www.pnas.org/doi/10.1073/pnas.1219753110) に基づきます。後方へ流れる SprB は地面に対してほぼ静止し、前方へ流れる SprB は約2倍の速さで見えます。
- **べん毛の描き方**: 配置は論文本文の記載に合わせています（*V. alginolyticus* は極べん毛1本、*C. insecticola*・*B. anthina* は極べん毛の束、*V. fischeri* は極の房、*C. jejuni* は両極、*S. enterica*・*B. subtilis* は周べん毛、*F. johnsoniae* はべん毛なし）。本数は本文に記載のある *B. subtilis*（20〜30本）と *V. alginolyticus*（1本）だけが論文由来で、ほかはゲーム上の設定です。

## データとゲーム上の設定について

- 速度は上記論文の動画（Movie S3 “Which bacterium swims fastest?”）に表示された各種・各環境の平均値です。
- *C. jejuni* がグルコースを使えないのは実際の生理（グルコキナーゼ欠損による非資化性）に基づきますが、ほかの7種を一律に「使える」としている点はゲーム上の単純化です。
- 抗生物質の相性は、グラム染色性・外膜の有無・属レベルで知られる自然耐性の傾向をゲーム用に3段階へ単純化したもので、論文のデータではありません。株によって異なり、医療上の判断には使えません。
- コースの形、近道の倍率、ラッピングによる加速、バトル補正（速度 = 32 + 0.2 × 実測）、追い上げ補正はゲーム上の設定です。

## 手元で動かす / Run locally

このリポジトリの `index.html` をダウンロードしてブラウザで開くだけで動きます。three.js とフォントを CDN から読み込むため、インターネット接続が必要です。
Download `index.html` and open it in a browser. It loads three.js and fonts from a CDN, so an internet connection is required.

## English quick start

1. **Pick a bacterium.** Bars show its speed in each environment; ◎○× show how well each antibiotic works on it. *V. fischeri* is a good all-rounder to start with.
2. **Pick a course and press Start.** “Microfluidic Circuit” is the gentlest.
3. **Race to the goal.** Grab spinning boxes for items and press Space to use them.

Steer with ← → or A D. Shift toggles flagellar wrapping (*V. fischeri*, *C. insecticola*, *C. jejuni*). Where the road splits, take the side your species is faster on; yellow-signed shortcuts are viscous but shorter; holes and rail-less edges send you back a little.
