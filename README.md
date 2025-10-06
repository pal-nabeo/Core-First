# PAL物流SaaS ログイン管理システム

効率的な物流管理で、ビジネスを加速させるマルチテナント対応SaaSサービス

## プロジェクト概要

**PAL物流SaaS**は、物流企業向けのマルチテナント対応認証・ユーザー管理システムです。企業単位での完全なデータ分離と、物流業界特有の組織構造に対応した高度なユーザー管理機能を提供します。

### 主要な特徴

- 🏢 **マルチテナント対応**: 物流企業単位での完全なデータ分離
- 🔐 **高度なセキュリティ**: 2要素認証、アカウントロック、監査ログ
- 👥 **招待制ユーザー管理**: 管理者による招待制でのユーザー追加
- 🏛️ **階層的権限管理**: 本社・支店・営業所レベルでの権限設定
- 📊 **詳細な監査機能**: 全操作の記録と分析レポート
- ⚡ **Cloudflare Workers**: エッジでの高速処理

## URLs

- **開発環境**: https://3000-i5ksp8lcx165ruwocw37r-6532622b.e2b.dev
- **ログイン画面**: https://3000-i5ksp8lcx165ruwocw37r-6532622b.e2b.dev/login
- **管理画面**: https://3000-i5ksp8lcx165ruwocw37r-6532622b.e2b.dev/admin
- **API健康チェック**: https://3000-i5ksp8lcx165ruwocw37r-6532622b.e2b.dev/api/health

## データ アーキテクチャ

### 主要データモデル
- **Tenants（テナント）**: 物流企業の管理、プラン情報、日付管理
- **Users（ユーザー）**: 企業内ユーザーの管理
- **Roles（ロール）**: 権限の定義
- **Organization Units（事業所）**: 本社・支店・営業所の階層管理
- **Invitations（招待）**: ユーザー招待の管理
- **Audit Logs（監査ログ）**: 全操作の記録、プラン変更履歴

### ストレージサービス
- **Cloudflare D1 Database**: SQLiteベースの分散データベース
- **セッション管理**: Cookie + データベーストークン
- **ファイルストレージ**: Cloudflare R2（将来実装予定）

### データフロー
1. **ログイン**: サブドメイン → テナント識別 → ユーザー認証 → セッション作成
2. **権限チェック**: セッション検証 → ロール確認 → 操作許可判定
3. **監査ログ**: 全操作 → ログ記録 → 監査レポート生成

## 実装済み機能

### ✅ 完成機能

#### 認証・ログイン機能 ✅ **修正完了**
- ✅ マルチテナント対応ログイン画面
- ✅ Web Crypto API を使用した secure なパスワードハッシュ化
- ✅ セッション管理（Cookie + データベース）
- ✅ ログイン試行回数制限とアカウントロック
- ✅ 認証API エンドポイント（POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout）
- ✅ メールアドレス・パスワード認証
- ✅ サブドメインによるテナント識別
- ✅ セッション管理（Cookie + データベース）
- ✅ ログイン状態保持機能
- ✅ パスワードリセット機能（基盤）
- ✅ **パスワードハッシュ統一化によるログイン修正（2025-10-06）**

#### プラン・アップグレード機能
- ✅ 4種類のプラン（Free, Standard, Plus, Pro）
- ✅ プラン変更API（アップグレード・ダウングレード）
- ✅ 利用状況の追跡と制限チェック
- ✅ プラン変更履歴の記録と表示
- ✅ 現在プランと使用量の表示
- ✅ プラン比較とアップグレードUI

#### アカウント管理機能
- ✅ ユーザープロフィール編集（表示名、電話番号、言語、タイムゾーン）
- ✅ パスワード変更機能（強度チェック付き）
- ✅ 2要素認証の有効化・無効化
- ✅ ロール・権限情報の表示
- ✅ アカウントセキュリティ設定
- ✅ 管理者向けユーザー権限編集機能
- ✅ ユーザーステータス変更（有効・無効・凍結）
- ✅ ロール割り当て・削除機能
- ✅ 監査ログによる変更追跡

#### スーパー管理者機能 ✅ **新規追加**
- ✅ **包括的ユーザー情報編集（表示名、メール、電話番号、言語、タイムゾーン）**
- ✅ **ユーザーセキュリティ設定管理（メール認証、2FA、パスワードリセット要求）**
- ✅ **管理者によるパスワードリセット機能（一時パスワード生成）**
- ✅ **ログイン失敗カウンタリセット・アカウントロック解除**
- ✅ **スーパー管理者権限チェック・監査ログ記録**

#### 管理機能
- ✅ 管理者ダッシュボード
- ✅ 権限別アクセス制御
- ✅ テナント別データ分離
- ✅ 基本的な管理画面UI

#### データベース
- ✅ 完全なスキーマ設計
- ✅ マイグレーション機能
- ✅ テストデータ投入
- ✅ インデックス最適化

#### インフラ・環境
- ✅ Cloudflare Pages対応
- ✅ D1データベース統合
- ✅ ローカル開発環境
- ✅ PM2によるプロセス管理

### 🚧 部分実装・今後の予定

#### セキュリティ機能
- 🚧 アカウントロック機能（基盤実装済み）
- 🚧 2要素認証（SMS/TOTP）
- 🚧 パスワード強度チェック
- 🚧 IP制限・地理的制限

#### 管理機能
- 🚧 ユーザー管理（CRUD操作）
- 🚧 招待機能（メール送信）
- 🚧 CSV一括インポート/エクスポート
- 🚧 監査ログ表示
- 🚧 セキュリティ設定画面

#### 外部連携
- 🚧 SSO対応（Google/Microsoft）
- 🚧 API キー管理
- 🚧 Webhook機能

## 技術スタック

### フロントエンド
- **フレームワーク**: Pure HTML/CSS/JavaScript
- **UIライブラリ**: TailwindCSS
- **アイコン**: FontAwesome
- **状態管理**: Vanilla JavaScript + LocalStorage

### バックエンド
- **フレームワーク**: Hono (TypeScript)
- **ランタイム**: Cloudflare Workers
- **認証**: Web Crypto API + セッション管理
- **パスワードハッシュ**: SHA-256 + Salt
- **バリデーション**: カスタム関数

### データベース
- **メインDB**: Cloudflare D1 (SQLite)
- **セッション**: D1 Database
- **ファイル**: Cloudflare R2（将来実装）

### インフラ
- **ホスティング**: Cloudflare Pages
- **CDN**: Cloudflare
- **DNS**: Cloudflare
- **環境管理**: Wrangler

### 開発ツール
- **ビルド**: Vite
- **プロセス管理**: PM2
- **パッケージ管理**: npm
- **バージョン管理**: Git

## ローカル開発ガイド

### 前提条件
- Node.js 18.x 以上
- npm 8.x 以上
- Git

### セットアップ手順

1. **リポジトリのクローン**
```bash
git clone <repository-url>
cd webapp
```

2. **依存関係のインストール**
```bash
npm install
```

3. **データベースのセットアップ**
```bash
# マイグレーション実行
npm run db:migrate:local

# テストデータ投入
npm run db:seed
```

4. **プロジェクトのビルド**
```bash
npm run build
```

5. **開発サーバーの起動**
```bash
# PM2で起動（推奨）
pm2 start ecosystem.config.cjs

# または直接起動
npm run dev:d1
```

6. **動作確認**
```bash
# API健康チェック
curl http://localhost:3000/api/health

# Webブラウザでアクセス
open http://localhost:3000
```

### 利用可能なスクリプト

```bash
# 開発・ビルド
npm run dev              # Vite開発サーバー
npm run dev:d1           # Wrangler + D1 ローカルサーバー  
npm run build            # プロダクションビルド
npm run preview          # プロダクションプレビュー

# データベース
npm run db:migrate:local # ローカルマイグレーション
npm run db:migrate:prod  # 本番マイグレーション
npm run db:seed          # テストデータ投入
npm run db:reset         # DB初期化 + マイグレーション + シード

# ユーティリティ
npm run clean-port       # ポート3000をクリア
npm run test            # APIテスト（curl）
```

## デモユーザーアカウント

### テストアカウント一覧（サブドメイン方式）

| 企業 | メールアドレス | パスワード | 権限 | 用途 |
|------|----------------|------------|------|------|
| ABC物流株式会社 | admin@abc-logistics.co.jp | password123 | スーパー管理者 | フル機能テスト |
| ABC物流株式会社 | manager@abc-logistics.co.jp | password123 | 管理者 | 一般管理機能 |
| ABC物流株式会社 | staff1@abc-logistics.co.jp | password123 | 一般ユーザー | 基本機能のみ |
| XYZ配送サービス | admin@xyz-delivery.jp | password123 | スーパー管理者 | 小規模企業テスト |
| XYZ配送サービス | driver1@xyz-delivery.jp | password123 | 一般ユーザー | 配送担当者 |
| デモ物流企業 | admin@demo-logistics.com | password123 | スーパー管理者 | デモ・プレゼン用 |
| デモ物流企業 | user1@demo-logistics.com | password123 | 一般ユーザー | 基本機能確認 |

### 企業識別子（サブドメイン）
- `abc-logistics`: ABC物流株式会社
- `xyz-delivery`: XYZ配送サービス
- `demo-company`: デモ物流企業

## API エンドポイント

### 認証 API
```
POST   /api/auth/login           # ログイン（サブドメイン自動判定）
POST   /api/auth/logout          # ログアウト
GET    /api/auth/me              # セッション確認
POST   /api/auth/password/reset  # パスワードリセット要求
POST   /api/auth/password/reset/confirm # パスワードリセット実行
```

### テナント API（NEW）
```
GET    /api/tenant/info          # 現在のテナント情報取得
GET    /api/tenant/list          # 利用可能テナント一覧
```

### アップグレード・プラン管理 API（NEW）
```
GET    /api/upgrade/plans        # 利用可能プラン一覧
GET    /api/upgrade/status       # 現在のプラン状況と利用量
POST   /api/upgrade/change-plan  # プラン変更（アップグレード・ダウングレード）
GET    /api/upgrade/history      # プラン変更履歴
```

### アカウント管理 API（NEW）
```
GET    /api/account/profile      # 現在のユーザープロフィール取得
PUT    /api/account/profile      # プロフィール更新（表示名、電話番号等）
PUT    /api/account/password     # パスワード変更
POST   /api/account/2fa/enable   # 2要素認証有効化
POST   /api/account/2fa/disable  # 2要素認証無効化
```

### 管理者向けユーザー管理 API（NEW）
```
GET    /api/admin/users          # テナント内ユーザー一覧（検索・ページング付き）
GET    /api/admin/users/:id      # 特定ユーザーの詳細情報取得
POST   /api/admin/users/:id/roles     # ユーザーへのロール追加・割り当て
DELETE /api/admin/users/:id/roles/:assignmentId # ロール割り当て削除
PUT    /api/admin/users/:id/status    # ユーザーステータス変更
GET    /api/admin/roles          # 利用可能ロール一覧
```

### テスト API（開発用）
```
GET    /api/test/hello           # 基本テスト
GET    /api/test/db              # DB接続テスト
GET    /api/test/tenants         # テナント一覧
GET    /api/test/users/:id       # ユーザー一覧
POST   /api/test/login-test      # ログインテスト
```

### その他の管理 API（実装予定）
```
POST   /api/admin/users          # ユーザー作成
POST   /api/admin/invite         # ユーザー招待
GET    /api/admin/audit          # 監査ログ
GET    /api/admin/organizations  # 組織管理
GET    /api/admin/settings       # システム設定
```

## セキュリティ要件

### 実装済みセキュリティ機能
- ✅ HTTPS強制
- ✅ セキュリティヘッダー設定
- ✅ CORS設定
- ✅ セッション管理
- ✅ SQL インジェクション対策

### 実装済みセキュリティ機能
- ✅ パスワードハッシュ化（SHA-256 + Salt）
- ✅ アカウントロック（3-5-10回失敗）
- ✅ セッション管理（Cookie + DB）

### 実装予定セキュリティ機能
- 🚧 2要素認証（SMS/TOTP）
- 🚧 IP制限・地理的制限
- 🚧 レート制限
- 🚧 CSRFプロテクション

### セキュリティ要件詳細

#### パスワードポリシー
- 最小8文字（推奨12文字以上）
- 英大文字・小文字・数字・記号の3種類以上
- 辞書語・個人情報の使用禁止
- パスワード履歴管理（過去12回分）
- 90日間の有効期限（プラン依存）

#### アカウントロック仕様
| 失敗回数 | ロック時間 | 解除方法 | 通知 |
|----------|------------|----------|------|
| 3回 | 5分間 | 時間経過で自動解除 | ユーザーのみ |
| 5回 | 15分間 | 時間経過 or 管理者解除 | ユーザー・管理者 |
| 10回 | 24時間 | 管理者解除必須 | セキュリティアラート |
| 15回以上 | 無期限 | 管理者調査・手動解除 | インシデント扱い |

## プラン・課金設計

### プラン比較

| 項目 | Free | Standard | Plus | Pro |
|------|------|----------|------|-----|
| **料金** | **無料** | **2,000円/月** | **8,000円/月** | **25,000円/月** |
| 利用期間 | 30日間 | 無制限 | 無制限 | 無制限 |
| ユーザー数 | 10名 | 50名 | 200名 | 無制限 |
| データ容量 | 1GB | 50GB | 500GB | 無制限 |
| 2FA | ❌ | ✅ | ✅ | ✅ |
| IP制限 | ❌ | ❌ | ✅ | ✅ |
| SSO連携 | ❌ | Google のみ | 複数プロバイダ | カスタムSSO |
| API利用 | ❌ | 制限あり | 標準 | 無制限 |
| サポート | メールのみ | メール・チャット | 優先サポート | 専任サポート |

## デプロイメント

### Cloudflare Pages デプロイ

1. **Cloudflare API キー設定**
```bash
# API キーを環境変数に設定
export CLOUDFLARE_API_TOKEN="your-api-token"
```

2. **D1 データベース作成**
```bash
# 本番データベース作成
npx wrangler d1 create webapp-production

# database_id を wrangler.jsonc に設定
```

3. **プロダクションデプロイ**
```bash
# マイグレーション実行
npm run db:migrate:prod

# デプロイ実行
npm run deploy:prod
```

### 環境変数設定

#### 開発環境（.dev.vars）
```
NODE_ENV=development
JWT_SECRET=development-secret-key
```

#### 本番環境（Cloudflare Secrets）
```bash
npx wrangler secret put JWT_SECRET --project-name webapp
npx wrangler secret put API_KEY --project-name webapp
```

## トラブルシューティング

### よくある問題

#### ビルドエラー
```bash
# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### データベース接続エラー
```bash
# ローカルD1をリセット
npm run db:reset

# マイグレーション確認
npm run db:migrate:local
```

#### ポート競合エラー
```bash
# ポート3000をクリア
npm run clean-port

# プロセス確認
pm2 list
pm2 delete all
```

#### 認証エラー
```bash
# セッション確認API
curl http://localhost:3000/api/auth/me

# ログインテストAPI
curl -X POST http://localhost:3000/api/test/login-test \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo-logistics.com", "tenant_subdomain": "demo-company"}'
```

## プロジェクト構成

```
webapp/
├── src/
│   ├── index.tsx           # メインアプリケーション
│   ├── types/
│   │   └── auth.ts         # 認証関連の型定義
│   ├── utils/
│   │   └── auth.ts         # 認証ユーティリティ
│   ├── middleware/
│   │   └── auth.ts         # 認証ミドルウェア
│   └── routes/
│       ├── auth.ts         # 認証APIルート
│       └── test.ts         # テストAPIルート
├── public/
│   └── static/
│       ├── login.js        # ログイン画面JavaScript
│       ├── login.css       # ログイン画面CSS
│       └── admin.js        # 管理画面JavaScript
├── migrations/
│   ├── 0001_initial_schema.sql # 初期スキーマ
│   ├── 0002_add_plan_dates.sql # プラン日付カラム追加
│   └── 0003_add_audit_details.sql # 監査ログ詳細カラム追加
├── dist/                   # ビルド出力
├── .wrangler/              # Wrangler ローカル状態
├── ecosystem.config.cjs    # PM2設定
├── wrangler.jsonc          # Cloudflare設定
├── seed.sql               # テストデータ
└── README.md              # このファイル
```

## 貢献・開発

### 開発フロー

1. **フィーチャーブランチ作成**
```bash
git checkout -b feature/new-feature
```

2. **開発・テスト**
```bash
npm run build
npm run test
```

3. **コミット・プッシュ**
```bash
git add .
git commit -m "Add: 新機能の実装"
git push origin feature/new-feature
```

### コードスタイル
- TypeScript を使用
- 関数・変数名は camelCase
- コンポーネント名は PascalCase
- 日本語コメントを積極的に使用

### 次のマイルストーン

#### フェーズ2: 完全な認証機能
- [ ] 完全なパスワードハッシュ化（bcrypt）
- [ ] アカウントロック機能の完成
- [ ] 2要素認証（SMS/TOTP）実装
- [ ] SSO連携（Google/Microsoft）

#### フェーズ3: 管理機能完成
- [ ] ユーザー管理CRUD操作
- [ ] 招待機能とメール送信
- [ ] CSV一括インポート/エクスポート
- [ ] 詳細な監査ログ表示

#### フェーズ4: 高度機能
- [ ] APIキー管理
- [ ] Webhook機能
- [ ] 料金・課金システム
- [ ] 詳細分析・レポート

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## サポート

- **開発者**: PAL物流SaaS開発チーム
- **Email**: support@pal-logistics-saas.com
- **Documentation**: このREADME
- **Issues**: GitHub Issues

---

© 2024 PAL物流SaaS. All rights reserved.