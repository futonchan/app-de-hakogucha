# 参考資料と出典の扱い

**整理日：2026-09-14**

## 1. ゲーム仕様の主な根拠

主な根拠はこのチャットのユーザー発言と明示採用です。
具体的な抜粋と要件IDの対応は[DECISIONS.md](../docs/DECISIONS.md)に記録しています。
同書のU-01〜U-06は会話内の出典管理用IDであり、外部リンクではありません。

これまでの助手の回答には、スコア、灰色の連結消去、4方向プッシュなどの仮案が含まれていました。
それらをユーザー承認済みとして転記せず、P-xxに分類しています。

## 2. ユーザー指定の参考動画

| ID | 用途・ユーザーによる説明 | URL |
|---|---|---|
| V-01 | 1人用ゲーム性の主な参考。パワプロクンポケット5のプレイ動画。 | `https://youtu.be/F7HV1tcJZIA` |
| V-02 | 将来の2人対戦イメージ。二次創作の2人用風動画で会話が多い。 | `https://youtu.be/tvLoYVp0iXE` |

リンク先ページのタイトルは確認しましたが、動画全編を再生してルール・タイミングを検証したものではありません。
原作の落下速度、得点式、灰色の特殊条件をこれらから確定したとは書いていません。
このMVPでは会話で合意した数値とルールを優先します。

## 3. 添付画像

元の会話でユーザーが共有した画像を、参照しやすいファイル名で同梱しています。
説明対象は画面の構成と操作文であり、登場人物の特定は不要です。

| ID | ファイル | 観察できる内容 |
|---|---|---|
| IMG-01 | [01-two-player-screen.png](images/01-two-player-screen.png) | 2つの盤面とスコア・時間表示。今回の1人用へ2画面をそのまま移植しない。 |
| IMG-02 | [02-two-player-combo.png](images/02-two-player-combo.png) | 2画面とコンボ表示。表示だけから具体的な得点式は確定できない。 |
| IMG-03 | [03-movement-help.png](images/03-movement-help.png) | 十字キー移動、障害物のない場所は移動可能という操作説明。 |
| IMG-04 | [04-falling-and-push-help.png](images/04-falling-and-push-help.png) | 落下箱に潰されると死亡、十字ボタンを押し続けて箱を動かすという説明。 |
| IMG-05 | [05-push-middle-help.png](images/05-push-middle-help.png) | 箱を横から押す、積まれた箱の途中を抜けるという説明。 |

元の6枚目は5枚目とバイト単位で同じ画像だったため、ファイルは5枚にまとめています。
画像にある×箱は、今回合意した4色・HPのMVPルールに追加しません。
「横から押す」という画像の説明と、初期案の4方向プッシュの違いはP-03に残しています。

**これらは参考資料であり、ゲーム内素材ではありません。**
`public/`、アプリ資産、ビルド成果物へコピーせず、公開する場合は参考資料も別に扱ってください。
画像・キャラクター・音源を利用できるという権利確認をしたものではありません。

## 4. 実装技術の一次資料

以下は2026-09-14に確認した、文書作成・実装設計の参考資料です。
特定のモデル、ライブラリ、ブラウザ版の将来の動作を保証する資料としては扱いません。
ゲームルールの根拠ではありません。

| ID | 資料 | 用途・URL |
|---|---|---|
| W-01 | OpenAI / Custom instructions with AGENTS.md | AGENTS.mdの読込と配置。`https://developers.openai.com/codex/guides/agents-md/` （確認時の転送先：`https://learn.chatgpt.com/docs/agent-configuration/agents-md`） |
| W-02 | MDN / Pointer events | pointerId、複数の指、pointercancel、pointer capture、touch-action。`https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events` |
| W-03 | MDN / Page Visibility API | ページの非表示と復帰の検知。`https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API` |
| W-04 | MDN / Window: requestAnimationFrame() | 描画コールバックと時刻、非表示時の扱い。`https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame` |
| W-05 | Vite / Getting Started | 開発環境の準備と対応する実行環境の確認。`https://vite.dev/guide/` |
| W-06 | Playwright / Emulation | 画面サイズ・タッチ等のエミュレーション。`https://playwright.dev/docs/emulation` |
| W-07 | Vite / Server Options | LAN試遊のhost指定など。`https://vite.dev/config/server-options` |

AGENTS.mdには作業方針と参照先を置き、詳細仕様はdocsへ分けています。
特定モデルの名称・モデルID・料金・利用資格は本ゲームの仕様に含めず、Codex環境側の選択に委ねます。
ブラウザAPIの利用方法は公式資料と対象実機で再確認してください。
