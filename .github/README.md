# GitHub Actions CI/CD パイプライン

このディレクトリには、Core First プロジェクトのCI/CDパイプライン設定が含まれています。

## 🔄 ワークフロー一覧

### 1. Deploy to Cloudflare Pages (`deploy.yml`)

**トリガー**: 
- `main` ブランチへのpush
- `main` ブランチへのPull Request

**処理内容**:
1. リポジトリをチェックアウト
2. Node.js 20 をセットアップ
3. 依存関係をインストール (`npm ci`)
4. プロジェクトをビルド (`npm run build`)
5. Cloudflare Pagesにデプロイ
6. PR の場合、デプロイURLをコメント

**必要なシークレット**:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

### 2. Run Tests (`test.yml`)

**トリガー**: 
- `main`, `develop` ブランチへのpush
- `main`, `develop` ブランチへのPull Request

**処理内容**:
1. リポジトリをチェックアウト
2. Node.js 20 をセットアップ
3. 依存関係をインストール
4. Linterを実行（設定されている場合）
5. プロジェクトをビルド
6. テストを実行（設定されている場合）
7. TypeScriptエラーチェック

**必要なシークレット**: なし

### 3. Database Migration (`database-migration.yml`)

**トリガー**: 
- 手動実行（workflow_dispatch）

**処理内容**:
1. リポジトリをチェックアウト
2. Node.js 20 をセットアップ
3. 依存関係をインストール
4. 指定された環境（production/staging）でマイグレーションを実行

**必要なシークレット**:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

**実行方法**:
1. GitHub → Actions タブ
2. "Database Migration" を選択
3. "Run workflow" をクリック
4. 環境（production/staging）を選択
5. "Run workflow" を実行

## 🔧 セットアップ手順

### 1. GitHub Secretsの設定

リポジトリの Settings → Secrets and variables → Actions で以下を追加：

#### CLOUDFLARE_API_TOKEN

1. https://dash.cloudflare.com/profile/api-tokens にアクセス
2. "Create Token" をクリック
3. "Edit Cloudflare Workers" テンプレートを選択
4. 必要な権限:
   - Account → Cloudflare Pages: Edit
   - Account → D1: Edit
   - Zone → Workers Routes: Edit
5. Tokenを生成してGitHub Secretsに追加

#### CLOUDFLARE_ACCOUNT_ID

1. https://dash.cloudflare.com/ にアクセス
2. Workers & Pages → Overview
3. 右側に表示される "Account ID" をコピー
4. GitHub Secretsに追加

または、CLIで確認:
```bash
npx wrangler whoami
```

### 2. Cloudflare Pages プロジェクト作成

初回デプロイ前に、Cloudflare Pagesプロジェクトを作成:

```bash
npx wrangler pages project create corefirst-webapp \
  --production-branch main \
  --compatibility-date 2024-01-01
```

### 3. D1 Database 作成

```bash
# 本番データベース作成
npx wrangler d1 create corefirst-production

# database_id を wrangler.jsonc に設定
```

## 📊 ワークフロー実行状況の確認

### GitHub UI

1. リポジトリのトップページ
2. "Actions" タブをクリック
3. 左側のサイドバーでワークフローを選択
4. 実行履歴とログを確認

### バッジの追加

README.md にバッジを追加して、ビルド状態を表示:

```markdown
[![Deploy to Cloudflare Pages](https://github.com/pal-nabeo/Core-First/actions/workflows/deploy.yml/badge.svg)](https://github.com/pal-nabeo/Core-First/actions/workflows/deploy.yml)
[![Run Tests](https://github.com/pal-nabeo/Core-First/actions/workflows/test.yml/badge.svg)](https://github.com/pal-nabeo/Core-First/actions/workflows/test.yml)
```

## 🔄 デプロイフロー

### 通常のデプロイ（main ブランチ）

```bash
git add .
git commit -m "Update feature"
git push origin main
```

→ 自動的に `deploy.yml` が実行され、Cloudflare Pagesにデプロイされます。

### プレビューデプロイ（Pull Request）

```bash
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

→ GitHub上でPRを作成すると、プレビュー環境が自動作成されます。

### データベースマイグレーション

1. GitHub → Actions → "Database Migration"
2. "Run workflow" をクリック
3. 環境を選択（production/staging）
4. 実行

## ⚠️ 注意事項

### 1. シークレットの管理

- **絶対にコミットしない**: API TokenやAccount IDをコードに含めない
- **定期的なローテーション**: 3ヶ月ごとにAPI Tokenを更新
- **権限の最小化**: 必要最小限の権限のみ付与

### 2. デプロイのタイミング

- **営業時間外推奨**: 本番デプロイは利用者の少ない時間帯に
- **段階的ロールアウト**: まずstagingで検証してからproduction
- **バックアップ**: デプロイ前にデータベースをバックアップ

### 3. 失敗時の対応

- **ロールバック**: Cloudflare Dashboard から前のデプロイメントに戻す
- **ログ確認**: GitHub Actionsのログで詳細を確認
- **手動デプロイ**: 必要に応じてローカルから手動デプロイ

## 🐛 トラブルシューティング

### デプロイが失敗する

**原因**: API Token の権限不足

**解決策**:
1. Cloudflare Dashboard でToken権限を確認
2. 必要に応じてTokenを再作成
3. GitHub Secretsを更新

### ビルドエラー

**原因**: 依存関係の問題

**解決策**:
```bash
npm ci
npm run build
```
ローカルで確認後、再度push

### データベースマイグレーションエラー

**原因**: マイグレーションファイルのSQL構文エラー

**解決策**:
1. ローカルで `--local` フラグでテスト
2. エラーを修正
3. 再度マイグレーションを実行

## 📚 参考資料

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
