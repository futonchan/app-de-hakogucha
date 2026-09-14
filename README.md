# アプリでハコグチャ（仮）

1人用・iPhone Safari・縦持ち向けの60秒スコアアタックMVPです。TypeScriptのcoreでゲームロジックを分離し、Canvas 2DとHTML/CSSで仮素材を描画します。2人対戦、サーバー、ログイン、ランキング、課金、原作素材利用、外部API連携は含みません。

## 実装範囲

- 10列×12段、60,000ms、1,000msごとの箱生成、250msごとの落下を実装しています。
- 十字キーで上下左右移動／隣接する静止箱のプッシュ、パンチで向き方向の隣接箱を攻撃します。箱へのアクション後もプレイヤーは自動前進せず、プッシュは静止箱だけが1マス動き、パンチは箱だけがダメージ／破壊されます。
- 赤・青・緑はHP1、灰はHP3。同色3個以上の上下左右連結消去、2秒以内コンボ、仮スコア式を実装しています。
- ポーズ、非表示・フォーカス喪失・横持ち時の自動ポーズ、リトライ、結果表示を実装しています。
- 採用したP-xxは`src/config.ts`の`adoptedProvisionalRules`で分離しています。内容の根拠は`docs/DECISIONS.md`を参照してください。

## セットアップ

Node.js 20.19以上または22.12以上を推奨します。Vite 7系の実行要件に合わせています。

```sh
npm install
```

Playwrightのブラウザが未導入の場合は、初回だけ次を実行します。

```sh
npx playwright install
```

WebKit実行時にOSライブラリ不足が出る場合は、管理者権限のある環境で次を実行してから再試行します。

```sh
sudo npx playwright install-deps
```

## 開発PCで起動

```sh
npm run dev
```

PC上のブラウザでは、表示されたLocalアドレスを開きます。Vite設定により開発サーバーはHTTPSで起動します。

## iPhone Safariで試す

1. 開発PCとiPhoneを、信頼できる同じLANへ接続します。
2. 開発PCで次を実行します。

```sh
npm run dev -- --host 0.0.0.0
```

3. ターミナルに表示される`Network`のURLをiPhone Safariで開きます。
4. `localhost`はiPhone自身を指すため、iPhoneでは使わず、開発PCのLAN内アドレスを使います。
5. つながらない場合は、同じWi-Fiか、VPNやゲストWi-Fi分離がないか、OSファイアウォールがローカル通信を遮っていないかを確認してください。

自己署名証明書の警告が出る場合があります。LAN内での開発確認用です。外部公開は行いません。

## 検証コマンド

```sh
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

`npm run test:e2e`はChromium/WebKitのiPhoneエミュレーションで画面遷移と代表サイズを確認します。これはiPhone実機Safariの操作感確認とは別です。
この環境ではWebKitのOS依存ライブラリ導入にsudoパスワードが必要だったため、Chromiumプロジェクト単体の確認には`npm run test:e2e -- --project=chromium-iphone`を使いました。

## 仕様ドキュメント

- `AGENTS.md`: 実装方針、固定ルール、禁止範囲、完了報告ルール
- `docs/MVP_SPEC.md`: MVP機能仕様
- `docs/DECISIONS.md`: R-xxとP-xxの区別、変更記録
- `docs/ARCHITECTURE.md`: 状態、イベント順、時計・入力・描画分離
- `docs/ACCEPTANCE_TESTS.md`: 自動テストとiPhone手動チェック
- `config/mvp-defaults.json`: 確定値と仮値の設定資料
