# Cloudflare Pages デプロイ - 実行手順書

## ✅ 準備完了している項目

1. ✅ プロジェクトコードの準備完了
2. ✅ GitHubリポジトリへのプッシュ完了
3. ✅ デプロイメントドキュメント作成完了
4. ✅ Cloudflare project name設定: `corefirst-webapp`

## 🔐 Cloudflare API Key 設定後の手順

### ステップ1: API Key認証確認

```bash
cd /home/user/webapp
npx wrangler whoami
```

**期待される出力**:
```
 ⛅️ wrangler 4.42.0
─────────────────────────────────────────────
Getting User settings...
👋 You are logged in with an API Token, associated with the email 'your-email@example.com'!
┌──────────────────────┬──────────────────────────────────┐
│ Account Name         │ Account ID                        │
├──────────────────────┼──────────────────────────────────┤
│ Your Account         │ your-account-id                   │
└──────────────────────┴──────────────────────────────────┘
```

**Account ID をコピーしておいてください。**

---

### ステップ2: D1データベース作成（本番用）

```bash
cd /home/user/webapp
npx wrangler d1 create corefirst-production
```

**重要**: 出力される `database_id` をコピーしてください。

**出力例**:
```
✅ Successfully created DB 'corefirst-production'!

[[d1_databases]]
binding = "DB"
database_name = "corefirst-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  ← これをコピー
```

---

### ステップ3: wrangler.jsonc の更新

`wrangler.jsonc` ファイルの `database_id` を更新します：

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
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  // ← ステップ2でコピーしたID
    }
  ]
}
```

---

### ステップ4: Cloudflare Pagesプロジェクト作成

```bash
cd /home/user/webapp
npx wrangler pages project create corefirst-webapp \
  --production-branch main \
  --compatibility-date 2024-01-01
```

**出力例**:
```
✨ Successfully created the 'corefirst-webapp' project.
🌎  View your project at https://corefirst-webapp.pages.dev
```

---

### ステップ5: データベースマイグレーション実行

```bash
cd /home/user/webapp

# 本番データベースにマイグレーションを適用
npx wrangler d1 migrations apply corefirst-production --remote
```

**確認プロンプトで `yes` を選択してください。**

---

### ステップ6: 初回デプロイ

```bash
cd /home/user/webapp

# ビルド
npm run build

# デプロイ
npx wrangler pages deploy dist --project-name=corefirst-webapp
```

**デプロイ完了後、URLが表示されます**:
```
✨ Success! Uploaded 1 files (440 KiB)

✨ Compiled Worker successfully
✨ Uploading Worker bundle
✨ Deployment complete!

🌎 https://xxxxxxxx.corefirst-webapp.pages.dev
🌎 https://corefirst-webapp.pages.dev
```

---

### ステップ7: デプロイ確認

#### ヘルスチェック
```bash
curl https://corefirst-webapp.pages.dev/api/health
```

**期待される出力**:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-19T12:00:00.000Z"
}
```

#### データベース確認
```bash
npx wrangler d1 execute corefirst-production \
  --remote \
  --command="SELECT COUNT(*) as tenant_count FROM tenants;"
```

**期待される出力**:
```json
{
  "results": [
    {
      "tenant_count": 5
    }
  ],
  "success": true
}
```

---

### ステップ8: GitHub Secretsの設定

GitHubリポジトリ（https://github.com/pal-nabeo/Core-First）で：

1. Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 以下の2つを追加：

**Secret 1: CLOUDFLARE_API_TOKEN**
- Name: `CLOUDFLARE_API_TOKEN`
- Secret: （Cloudflare API Token を貼り付け）

**Secret 2: CLOUDFLARE_ACCOUNT_ID**
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Secret: （ステップ1でコピーした Account ID を貼り付け）

---

### ステップ9: GitHub Actions Workflowファイルの作成

GitHubリポジトリ上で直接作成します：

#### 1. deploy.yml

1. GitHub → Code → `.github/workflows/` ディレクトリ
2. "Add file" → "Create new file"
3. ファイル名: `deploy.yml`
4. 内容は `/home/user/webapp/.github/workflows/deploy.yml` をコピー
5. "Commit new file"

#### 2. test.yml

同様に `test.yml` を作成

#### 3. database-migration.yml

同様に `database-migration.yml` を作成

---

### ステップ10: 自動デプロイのテスト

```bash
cd /home/user/webapp

# 小さな変更を加える
echo "# CI/CD Test" >> README.md

# コミット＆プッシュ
git add README.md
git commit -m "Test CI/CD pipeline"
git push origin main
```

GitHub → Actions タブで、自動デプロイが実行されることを確認してください。

---

## 🎉 完了！

すべてのステップが完了すると：

✅ **本番環境URL**: https://corefirst-webapp.pages.dev
✅ **自動デプロイ**: mainブランチへのpushで自動デプロイ
✅ **プレビュー環境**: PRで自動的にプレビュー作成
✅ **データベース**: Cloudflare D1で本番稼働

---

## 🔧 オプション設定

### カスタムドメイン

```bash
npx wrangler pages domain add your-domain.com --project-name=corefirst-webapp
```

### 環境変数・シークレット

```bash
# シークレット追加
npx wrangler pages secret put API_KEY --project-name=corefirst-webapp

# シークレット一覧
npx wrangler pages secret list --project-name=corefirst-webapp
```

### アクセス制限

Cloudflare Dashboard:
1. Workers & Pages → corefirst-webapp
2. Settings → Access control
3. アクセスポリシーを設定

---

## 📊 モニタリング

### Analytics

Cloudflare Dashboard → Workers & Pages → corefirst-webapp → Analytics

### ログ

```bash
# リアルタイムログ
npx wrangler pages deployment tail --project-name=corefirst-webapp
```

---

## 🐛 トラブルシューティング

### デプロイエラー

```bash
# ログ確認
cat ~/.wrangler/logs/wrangler-*.log

# ビルド確認
npm run build

# 強制再デプロイ
npx wrangler pages deploy dist --project-name=corefirst-webapp --branch=main
```

### データベースエラー

```bash
# データベース一覧
npx wrangler d1 list

# データベース情報
npx wrangler d1 info corefirst-production

# マイグレーション状態
npx wrangler d1 migrations list corefirst-production --remote
```

---

## 📚 次のステップ

1. **モニタリング設定**: Cloudflare Analyticsの確認
2. **カスタムドメイン**: 独自ドメインの設定
3. **セキュリティ強化**: Cloudflare Access の設定
4. **パフォーマンス最適化**: Caching Rulesの設定
5. **バックアップ計画**: 定期的なデータベースバックアップ
