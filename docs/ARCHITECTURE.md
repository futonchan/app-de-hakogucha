# 実装設計・状態遷移・データ構造

**文書版0.4 / 技術設計はP-16を中心とする初期実装案**

これは実装のたたき台であり、ライブラリやクラス名までユーザー承認済みではない。
同じ仕様・テスト可能性を満たす、より簡単な実装に変える場合は理由を記録する。
通信対戦・サーバー・リプレイUI・汎用物理エンジンは作らない。

## 1. 最小の分離

```text
DOM Pointer/Keyboard
    → InputController → 時刻と順序付きゲーム入力
    → Engine（ルール・ゲーム時計・seed付き乱数）
    → GameState + GameEvents
    → CanvasRenderer / DOM UI

Page lifecycle / Pause → RuntimeClock（ゲーム時計を停止・再開）
```

| 部分 | 責務 | 依存させないもの |
|---|---|---|
| core | 盤面、移動、押す、殴る、落下、消去、得点、終了 | DOM、Canvas、ブラウザ時計、実際の入力機器 |
| input | マルチタッチ、向き、押下／解放、リピート、キーボード補助 | 箱のHPや消去アルゴリズム |
| render | stateから盤面・向き・HP・演出を描く | 勝敗や時間の更新 |
| ui/runtime | 開始、結果、ポーズ、ゲーム時計、Canvasリサイズ | 重複した盤面ルール |

既存環境がなければ次のように作る。ファイル名は例。

```text
src/
├── main.ts
├── config.ts                 # 設定資料を検証・変換してcoreへ渡す
├── core/
│   ├── types.ts
│   ├── engine.ts             # advanceTo、同時刻イベント処理
│   ├── board.ts              # 占有索引、支え判定、境界
│   ├── actions.ts            # move/push/punch
│   ├── gravity.ts
│   ├── matches.ts
│   ├── scoring.ts
│   └── random.ts
├── input/
│   └── controller.ts
├── render/
│   └── canvas.ts
├── ui/
│   ├── runtime.ts
│   └── screens.ts
└── styles.css
tests/
├── unit/
└── e2e/
```

## 2. 状態遷移

```text
READY → COUNTDOWN → PLAYING → ENDED
                     ↕
                   PAUSED

COUNTDOWN → PAUSED（中断）→ COUNTDOWN（明示再開）
ENDED → COUNTDOWN（リトライ時に新しいゲーム状態）
```

ゲームの終了理由は`time_up`、`crushed`、`no_spawn_column`。
ポーズ前の状態とカウントダウン残時間を保持する。
ポーズ時・終了時には全入力とリピート予約を解除する。
画面表示とcore状態の対応は一つのRuntimeが管理し、多重のゲームループを作らない。

## 3. データ構造例

以下は設計例。実装済みコードではない。

```ts
type Direction = 'up' | 'down' | 'left' | 'right';
type BoxColor = 'red' | 'blue' | 'green' | 'gray';
type BoxId = number;

type Box = {
  id: BoxId;
  color: BoxColor;
  hp: number;
  x: number;
  y: number;
  nextFallAtMs: number | null; // 停止中はnull。落下中はゲーム時計上の期限
  motion: BoxMotion | null;    // プッシュ中の表示移動。グリッド座標は完了まで元マス
  unbreakable: boolean;        // 初期配置専用。パンチではHPを減らさない
};

type Player = { x: number; y: number; facing: Direction };
type EndReason = 'time_up' | 'crushed' | 'no_spawn_column';
type ClearAnimation = { boxIds: BoxId[]; startedAtMs: number; durationMs: number };

type GameState = {
  phase: 'playing' | 'clearing' | 'ended';
  timeMs: number;             // 整数。PLAYINGとして進んだゲーム時刻
  boxes: Box[];              // 箱配置の唯一の正本
  player: Player;
  score: number;
  combo: number;
  maxCombo: number;
  lastClearAtMs: number | null;
  nextSpawnAtMs: number;
  rngState: number;           // seed付き疑似乱数器の状態
  nextBoxId: number;
  endReason: EndReason | null;
  clearAnimation: ClearAnimation | null;
  movementLocks: Direction[]; // 箱アクション後、releaseまで通常移動へ引き継がない方向
};

type GameInput =
  | { atMs: number; seq: number; type: 'move'; direction: Direction }
  | { atMs: number; seq: number; type: 'punch' }
  | { atMs: number; seq: number; type: 'release'; direction: Direction | null };

type InitialBoxPattern = {
  id: string;
  rows: BoxColor[][];
};
```

残り時間は`max(0, durationMs - timeMs)`、落下中かどうかは`nextFallAtMs !== null`など、
正本から求められる値を別の書換可能な状態として重ね持ちしない。
箱のグリッド座標`x,y`は衝突・支え・連結判定に使う確定マスであり、描画用の表示座標は
`nextFallAtMs`または`motion`から補間して求める。表示座標を盤面判定の正本にしない。R-23。
箱の位置索引`(x,y) → BoxId`は必要時に再構築してよい。最大120セルなので複雑な最適化は不要。
破壊・消去済み箱の予約が残っていても、そのIDが存在しなければ処理しない。

`createGame`は設定の`initialBoxPatterns`からseed付き乱数で1パターンを選び、最下段2行へ
`unbreakable: true`の箱として配置する。これらは通常色を持つがパンチでHPを減らさない。通常生成箱は
`unbreakable: false`で作る。R-26。
初期パターンは設定データとして分離し、各行10列・2行の編集で配置変更できるようにする。

プッシュ成功時はR-20により箱だけを1マス移動し、プレイヤー座標は変更しない。
箱が空けたマスへ進む処理は、次の移動入力として扱う。
これにより、支え箱を押した瞬間にプレイヤーが崩落予定マスへ自動追従しない。
プッシュに使った方向は`movementLocks`へ入れ、同じ方向の押しっぱなしリピートを通常移動として処理しない。`release`入力後の再入力だけを新しい移動意思として扱う。R-25。
プッシュ対象はR-22により静止箱だけで、`nextFallAtMs !== null`の落下中箱は押せない。
プッシュはR-23により250msの等速表示移動として扱い、`motion.endsAtMs`でグリッド座標を確定する。
パンチ成功時もR-21により、箱のHP減少または箱削除だけを行い、プレイヤー座標は変更しない。
`unbreakable`な箱へパンチした場合は、命中イベントだけを出し、HP・箱有無・プレイヤー座標を変更しない。R-26。
破壊された箱のマスへ進む処理も、次の移動入力として扱う。
パンチで箱を破壊した場合も向き方向を`movementLocks`へ入れ、方向キーを押したままのリピートで破壊後の空きマスへ入らないようにする。R-25。
箱へのアクション成功後にプレイヤーを対象箱の元いたマスへ移動させる共通処理は置かない。

## 4. coreのインターフェース案

```ts
createGame(config, seed): GameState
advanceTo(state, targetGameTimeMs, orderedInputs, config): {
  state: GameState;
  events: GameEvent[];
}
finishClearAnimation(state, config): {
  state: GameState;
  events: GameEvent[];
}
```

`advanceTo`は指定されたゲーム時刻まで、入力・落下期限・生成期限・制限時刻を**時系列順**に処理する。
外部の`Date.now()`、`performance.now()`、`Math.random()`を内部から呼ばない。
同じ設定・初期状態・seed・入力列なら、更新を呼ぶ回数を変えても同じ結果にする。
`clearing`中の`advanceTo`はゲーム時刻を進めず、入力・生成・落下・コンボ失効を処理しない。
点滅0.5秒の経過はRuntimeが壁時計で測り、完了時に`finishClearAnimation`を呼ぶ。
イベントは`box_punched`、`box_broken`、`boxes_clear_started`、`boxes_cleared`、`game_ended`等の最小限でよい。

## 5. 時刻tでの処理順（P-10）

同じ時刻の境界を曖昧にしない。次の順で処理する。

1. tが60,000ms以上なら時間切れを確定し、以後の処理を行わない。
2. tの入力を処理する。同時刻内は`release`を先、移動系を次、パンチを後、その中では`seq`順とする。
3. 支えを再計算し、移動中または同時刻に完了予定の箱を除いた停止中の同色連結を検出する。対象があれば`clearing`へ入り、この時刻のワールド処理を止める。
4. tに期限が来た落下アニメーションまたはプッシュアニメーションを確定する。落下確定で圧死ならその場で終了する。
5. 支えを更新し、着地・プッシュ完了などで生じた連結消去を検出する。対象があれば`clearing`へ入り、この時刻のワールド処理を止める。
6. tが生成期限なら、現在の盤面で生成する。空き列なし／生成マスのプレイヤー衝突なら終了する。
7. 支え・連結消去を更新する。対象があれば`clearing`へ入り、この時刻のワールド処理を止める。
8. 0.5秒の点滅完了後、`finishClearAnimation`で対象箱を削除し、コンボを1回だけ更新して加点し、最大コンボを更新する。

入力や落下の前段で消去対象が確定した場合は、その時点で`clearing`に入り、後段の落下・生成・終了判定はワールド再開後に扱う。
圧死した落下の後は新しい消去を判定しない。時間切れは最初に終わるので加点もない。
この扱いを専用テストで固定し、早期returnで加点を失う／死亡後に救済されるバグを避ける。

コンボ失効は`t > lastClearAtMs + 2000`で扱う。同時刻の消去集約より前に、
`>=`でコンボを消してしまわない。2,000msちょうどの判定を維持する。

## 6. 支えの再計算と落下予約（P-09）

箱が変化するたびに、各列を下から上へ見て支えを計算する。

```text
y=11の箱 → 支えあり
真下に「支えあり」の箱 → 支えあり
それ以外 → 支えなし
```

支えありになった箱は`nextFallAtMs = null`。
支えなしになった箱は、従来nullなら`now + 250`、従来から期限があればその期限を維持する。
これにより、崩れた積み重なり全体に同じ時刻の初回予約を付けられる。
新規生成箱も支えがなければ生成時刻+250msを最初の期限にする。

落下期限tの処理では、変更前の盤面から移動対象集合を作る。
下のマスが空白、または同じtに移動する下の箱が空けるマスなら1マス進める。
下の箱が移動対象でないなら進めない。盤面外には進めない。
進めるかどうかを下から決めて、全対象を一括移動する。
移動先にプレイヤーがいれば終了し、生存中の重複配置を残さない。

期限を処理した後も支えがない箱の次回期限はt+250ms。
まだ期限が来ていない落下箱は、その期限を不用意に書き換えない。
停止に転じた箱はnullにする。これを箱一覧の処理順に依存させない。

## 7. 消去・集約

対象は初期案P-06の停止中の箱。上下左右のFlood Fill／BFSで色別の連結成分を得る。
同じスナップショットから3個以上の全成分を集め、和集合を除去する。
同色成分の重複カウントを避ける。
落下またはプッシュの移動途中にある箱は、連結消去の探索対象から外す。
盤面全体の判定を止めるのではなく、停止中で支えのある箱だけを対象に判定する。
移動アニメーションが完了し、グリッド座標を確定した箱は、その直後のスナップショットで判定対象へ戻す。R-23。
消去対象のIDは`clearAnimation.boxIds`へ保持し、箱は即削除しない。
Runtimeは壁時計で0.5秒の点滅を描画し、その間coreの`timeMs`を進めない。
点滅完了時に対象箱を削除し、同じゲーム時刻でコンボ・スコアを更新してから支えを再計算する。R-24。

1時刻の処理で複数の同色成分が見つかっても、除去箱IDを重複なく集約して1回だけコンボを更新する。
パンチの`box_broken`はこの集合へ入れない。
点滅中の箱は描画対象として残るが、ワールド時間が止まっているため衝突・入力・生成・落下は進まない。
`unbreakable`な箱も同色3個以上の連結消去では通常箱と同じ対象として扱う。パンチ耐性は連結消去耐性ではない。R-26。

## 8. 時計と描画

描画には`requestAnimationFrame`を使う案とする。ブラウザの再描画頻度は固定とは限らず、
非表示ページではコールバックが停止されることがあるため、フレーム回数をゲーム時間にしない。
技術資料は[参考資料W-03・W-04](../references/README.md)。

Runtimeが単調増加の外部時刻からゲームの進行時間を作り、coreへ渡す。
ポーズ中・カウントダウン中は60秒時計を進めない。
非表示等の中断時はポーズ前までの状態で止め、再開時に外部時計の基準を取り直す。
バックグラウンドで過ぎた時間分の箱を復帰直後にまとめて生成しない。

前景で描画が少し遅れた場合は、その間のイベントを時系列に追いつかせる。
`delta`を勝手に切り捨てて、制限時間だけ進む／箱だけ遅くなる処理にしない。
著しいフリーズへの追加自動ポーズが必要なら、P-13の補完として閾値と扱いを記録する。

箱の落下・プッシュは250msで1マスの等速補間として表示する。R-23。
落下のグリッド座標は落下期限時刻に次マスへ確定する。プッシュのグリッド座標も`motion.endsAtMs`で確定する。
補間アニメーション中の表示座標は衝突・連結消去の正本にしない。
消去点滅はRenderer側のopacityやオーバーレイで実装し、箱画像や仮ラベルに依存させない。R-24。
`unbreakable`な箱の×マークもRenderer側の黒系オーバーレイで描画し、箱画像には焼き込まない。R-26。
物理エンジンを追加して実装を肥大化させない。

## 9. タッチ入力

Pointer EventsでpointerIdごとに状態を持つ案とする。
`pointerdown`、`pointermove`、`pointerup`、`pointercancel`、`lostpointercapture`を扱う。
操作領域にpointer captureを使う場合は、方向判定にイベントのtargetだけを使わず、
指の座標から十字キー内のどの方向かを再計算する。
技術資料は[参考資料W-02](../references/README.md)。

十字キーの指を1本保持し、パンチ用の別の指を受け付ける。
右手のpointerupで、左手の押下状態まで一括解除しない。
`isPrimary`だけを受け付ける実装では右手を落としてしまうため、用途別にpointerIdを扱う。
パンチを`pointerdown`と`click`の両方から実行して2発にしない。

十字キー：押下時0ms、継続250ms、350ms、450ms…のリピート。
指が別方向へ移れば新方向の即時1回を発行し、リピート待ちをリセットする初期案とする。
中央の無入力領域や十字キー外ではリピート停止。終了・ポーズ・pointercancelで予約を消す。
プッシュ成功またはパンチ破壊後は、その方向のリピートをcore側の`movementLocks`で無効化し、pointerup／keyup由来の`release`を受けるまで通常移動へ引き継がない。R-25。
同時に複数方向がある場合は最新の有効方向を採用する。斜め移動を作らない。

操作領域のみに`touch-action: none`等を適用してスクロール誤操作を抑える。
説明文などを含むページ全体の拡大操作を、無条件に禁止しない。
キーボードは開発補助として矢印／WASD＋Spaceを用意してよいが、スマホ操作を省かない。

## 10. 描画・レイアウト

盤面と操作UIを分離し、操作領域を確保した残りの高さと横幅から正方形セル寸法を計算する。
小さい画面でも盤面の列数・段数は変えない。
Canvasの描画バッファとCSS寸法を分け、高密度表示を考慮する。
画面回転・ブラウザUIの伸縮で再計算し、ゲーム状態はリサイズで初期化しない。

ボタンは意味のあるHTML要素と日本語ラベルを使う。
テストの安定性のため、開始、パンチ、各方向、ポーズ、再開、リトライへ
安定したラベルまたは`data-testid`を付ける。
原作のキャラクター画像・スクリーンショットを描画用素材にしない。

## 11. テスト・開発環境

Vitestでcoreと入力の時刻制御をテストし、Playwrightで画面と基本操作を検証する案とする。
Playwrightの端末エミュレーションはビューポートやタッチ設定等の再現に使えるが、
iPhone実機の操作感を検証したことにはしない。[参考資料W-06](../references/README.md)。

Vite等のバージョンはこの文書で「最新」と固定しない。実装時に公式要件とNode環境を確認し、
採用したバージョンをlockfileとREADMEに記録する。[参考資料W-05](../references/README.md)。
設定JSONを直接使うか型付き設定へ変換するかは任意だが、確定値と仮値の由来を保つ。

開発用の状態注入や固定seedはテストからcoreを直接呼ぶ構成を優先する。
ブラウザ試験用のデバッグ口が必要でも、本番配布に無制限の状態変更APIを残さない。
