# Core First デプロイメントガイド

## 🚀 Cloudflare Pages デプロイメント

### 前提条件

1. **Cloudflare アカウント**
   - https://dash.cloudflare.com でアカウント作成
   
2. **Cloudflare API Token**
   - https://dash.cloudflare.com/profile/api-tokens で作成
   - 必要な権限: `Account - Cloudflare Pages: Edit`, `Account - D1: Edit`

3. **Cloudflare Account ID**
   - Cloudflare Dashboard → Workers & Pages → Overview で確認
   - または、`wrangler whoami` コマンドで確認

### 初回デプロイ手順

#### 1. ローカル環境でビルドテスト

```bash
cd /home/user/webapp
npm install
npm run build
```

#### 2. Cloudflare API認証設定

```bash
# Wranglerで認証（ブラウザが開く）
npx wrangler login

# または、環境変数で設定
export CLOUDFLARE_API_TOKEN=your-api-token
export CLOUDFLARE_ACCOUNT_ID=your-account-id
```

#### 3. D1データベース作成（本番用）

```bash
# 本番データベース作成
npx wrangler d1 create corefirst-production

# 出力されたdatabase_idをwrangler.jsoncに設定
```

#### 4. wrangler.jsonc の設定

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "corefirst-webapp",
  "main": "src/index.tsx",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "corefirst-production",
      "database_id": "your-database-id-here"  // 手順3で取得したID
    }
  ]
}
```

#### 5. Cloudflare Pagesプロジェクト作成

```bash
# プロジェクト作成
npx wrangler pages project create corefirst-webapp \
  --production-branch main \
  --compatibility-date 2024-01-01
```

#### 6. マイグレーション実行（本番）

```bash
# 本番データベースにマイグレーション適用
npx wrangler d1 migrations apply corefirst-production --remote
```

#### 7. 初回デプロイ

```bash
# ビルド＆デプロイ
npm run build
npx wrangler pages deploy dist --project-name=corefirst-webapp
```

### GitHub Actions でのCI/CDセットアップ

#### 1. GitHubシークレット設定

GitHubリポジトリ → Settings → Secrets and variables → Actions で以下を追加：

- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

#### 2. 自動デプロイの有効化

`.github/workflows/deploy.yml` が既に設定済みです。

**mainブランチへのpushで自動デプロイ**されます：
```bash
git add .
git commit -m "Update application"
git push origin main
```

#### 3. プルリクエストでのプレビューデプロイ

新しいブランチを作成してPRを送ると、自動的にプレビュー環境が作成されます：

```bash
git checkout -b feature/new-feature
# 変更を加える
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
# GitHub上でPRを作成
```

### データベースマイグレーション

#### 手動実行

```bash
# ローカルテスト
npx wrangler d1 migrations apply corefirst-production --local

# 本番適用
npx wrangler d1 migrations apply corefirst-production --remote
```

#### GitHub Actions経由

GitHub → Actions → "Database Migration" → Run workflow

### 環境変数・シークレット管理

#### 開発環境（ローカル）

`.dev.vars` ファイルを作成（.gitignoreに含まれています）：

```
API_KEY=your-dev-api-key
DATABASE_URL=local
```

#### 本番環境（Cloudflare）

```bash
# シークレット追加
npx wrangler pages secret put API_KEY --project-name=corefirst-webapp

# シークレット一覧
npx wrangler pages secret list --project-name=corefirst-webapp
```

### デプロイ後の確認

1. **デプロイURL確認**
   ```bash
   # デプロイ完了後、URLが表示されます
   # 例: https://corefirst-webapp.pages.dev
   ```

2. **ヘルスチェック**
   ```bash
   curl https://corefirst-webapp.pages.dev/api/health
   ```

3. **データベース確認**
   ```bash
   npx wrangler d1 execute corefirst-production \
     --remote \
     --command="SELECT COUNT(*) FROM tenants;"
   ```

### トラブルシューティング

#### ビルドエラー

```bash
# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### データベース接続エラー

```bash
# データベース存在確認
npx wrangler d1 list

# データベースID確認
npx wrangler d1 info corefirst-production
```

#### デプロイ失敗

```bash
# Wranglerのログ確認
cat ~/.wrangler/logs/wrangler-*.log

# 強制再デプロイ
npm run build
npx wrangler pages deploy dist --project-name=corefirst-webapp --branch=main
```

### ロールバック

```bash
# デプロイ履歴確認
npx wrangler pages deployment list --project-name=corefirst-webapp

# 特定のデプロイメントに戻す
npx wrangler pages deployment tail <deployment-id> --project-name=corefirst-webapp
```

### カスタムドメイン設定

```bash
# カスタムドメイン追加
npx wrangler pages domain add example.com --project-name=corefirst-webapp

# ドメイン一覧
npx wrangler pages domain list --project-name=corefirst-webapp
```

## 📊 モニタリング

### Cloudflare Analytics

- Workers Analytics: https://dash.cloudflare.com/
- Pages Analytics: Workers & Pages → corefirst-webapp → Analytics

### ログ確認

```bash
# リアルタイムログ
npx wrangler pages deployment tail --project-name=corefirst-webapp

# 特定のデプロイメントのログ
npx wrangler pages deployment tail <deployment-id> --project-name=corefirst-webapp
```

## 🔐 セキュリティ

### 定期的なタスク

1. **API Token のローテーション**（3ヶ月ごと推奨）
2. **依存関係の更新**（月次）
   ```bash
   npm outdated
   npm update
   npm audit fix
   ```
3. **データベースバックアップ**（週次推奨）
   ```bash
   npx wrangler d1 export corefirst-production --remote --output=backup.sql
   ```

## 📝 更新履歴

- 2025-10-19: 初版作成、GitHub Actions CI/CD設定
- 2025-10-19: Cloudflare Pages デプロイメント設定
