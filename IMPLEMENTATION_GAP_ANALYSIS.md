# Core First 実装状況と要件定義書のギャップ分析

**分析日**: 2025-10-19  
**対象文書**: Core First CLO向け管理機能システム設計書  
**現在の実装**: Core First 統合管理システム v1.0

---

## 📊 要約

### 全体実装状況

| カテゴリ | 実装済み | 部分実装 | 未実装 | 合計 |
|---------|----------|----------|--------|------|
| **認証・権限管理** | 8 | 2 | 1 | 11 |
| **テナント管理** | 6 | 1 | 2 | 9 |
| **CLO向けサイト機能** | 3 | 5 | 7 | 15 |
| **管理者サイト機能** | 5 | 3 | 4 | 12 |
| **データベース** | 15 | 3 | 5 | 23 |

**総合進捗**: 約 60% 完了

---

## 🎯 権限区分の明確化

### ✅ 正しく実装されている権限区分

#### サービス提供者側（システム管理者）
- ✅ `system` テナント: Core First サービス提供者
- ✅ ロール定義済み:
  - `role_system_super_admin` - スーパー管理者
  - `role_system_admin` - システム管理者
  - `role_system_operation_admin` - 運用管理者
  - `role_system_customer_success` - カスタマーサクセス
  - `role_system_finance_admin` - 経理担当者
  - `role_system_auditor` - 監査担当者

#### サービス利用者側（テナント企業）
- ✅ `role-template` テナント: ロールテンプレート
- ✅ ロール定義済み:
  - `template-tenant-owner` - テナント管理者（スーパー管理者）
  - `template-tenant-admin` - テナント副管理者
  - `template-department-manager` - 部門管理者 ✅ **NEW** (migration 0009)
  - `template-user` - 一般ユーザー
  - `template-guest` - ゲストユーザー

### ⚠️ 要件定義書との相違点

| 要件定義書 | 現在の実装 | 状態 | 対応 |
|-----------|-----------|------|------|
| 部門管理者 | ✅ 実装済み | ✅ | migration 0009で追加済み |
| テナント内権限階層の詳細制御 | 基本実装のみ | ⚠️ | 強化が必要 |

---

## 1. 認証・権限管理

### ✅ 実装済み

| 機能 | ファイル | 状態 |
|------|---------|------|
| ID・パスワード認証 | `src/routes/auth-simple.ts` | ✅ 完全実装 |
| セッション管理 | `src/middleware/auth.ts` | ✅ 完全実装 |
| 2FA（TOTP/SMS） | `src/routes/two-factor-auth.ts` | ✅ 完全実装 |
| 2FA middleware | `src/middleware/two-factor-auth.ts` | ✅ 完全実装 |
| パスワードポリシー | `src/middleware/password-policy.ts` | ✅ 完全実装 |
| ロール分離 | `src/middleware/role-separation.ts` | ✅ 完全実装 |
| サービス提供者認証 | `src/routes/service-provider-auth.ts` | ✅ 完全実装 |
| アカウント管理 | `src/routes/account.ts` | ✅ 完全実装 |

### ⚠️ 部分実装

| 機能 | 現在の状態 | 不足内容 |
|------|-----------|---------|
| SSO連携 | 未実装 | SAML/OAuth2.0対応が必要 |
| アカウントロックアウト | 基本実装 | 段階的ロック（3回→5分、5回→15分）の詳細実装が必要 |

### ❌ 未実装

| 機能 | 優先度 | 備考 |
|------|--------|------|
| 統合認証基盤の完全実装 | 中 | 現在は簡易認証 |

---

## 2. テナント管理

### ✅ 実装済み

| 機能 | ファイル | 状態 |
|------|---------|------|
| テナント情報管理 | `src/routes/tenant.ts` | ✅ 実装済み |
| ユーザー管理 | `src/routes/users.ts` | ✅ 完全実装 |
| 管理者機能 | `src/routes/admin.ts` | ✅ 完全実装 |
| 招待機能 | `src/routes/invitations.ts` | ✅ 完全実装 |
| ライセンス管理 | `src/routes/licenses.ts` | ✅ 実装済み |
| ライセンスチェック | `src/middleware/license.ts` | ✅ 完全実装 |

### ⚠️ 部分実装

| 機能 | 現在の状態 | 不足内容 |
|------|-----------|---------|
| 組織階層管理 | テーブルのみ | 本社・支店・営業所・配送センター構造のAPI実装が必要 |

### ❌ 未実装

| 機能 | 優先度 | 備考 |
|------|--------|------|
| CSV一括ユーザー登録 | 低 | Standard以上のプラン機能 |
| 組織階層の完全UI | 低 | `organization_units` テーブルは存在 |

---

## 3. CLO向けサイト機能

### ✅ 実装済み（画面のみ）

| 機能 | ファイル | 状態 |
|------|---------|------|
| チュートリアルページ | `public/static/clo-tutorial.css` | ✅ 画面のみ |
| メインダッシュボード | `public/static/main-dashboard.css/js` | ✅ 画面のみ |
| ログイン画面 | `public/static/login.css/js` | ✅ 完全実装 |

### ⚠️ 部分実装（画面あり、API不足）

| 機能 | 画面 | API | 不足内容 |
|------|-----|-----|---------|
| AI分析・チャット | ✅ | ❌ | バックエンドAPIが未実装 |
| データ連携・マッピング | ✅ | ❌ | データマッピングAPIが未実装 |
| データ統合管理 | ✅ | ❌ | 統合処理APIが未実装 |
| レポート管理 | ✅ | ❌ | レポート生成APIが未実装 |
| ダッシュボード | ✅ | ⚠️ | KPI取得APIの実装が不完全 |

### ✅ 実装済み（2025-10-19 更新）

| 機能 | ファイル | 状態 |
|------|---------|------|
| データアップロード機能 | `src/routes/data-upload.ts` | ✅ **完全実装** |
| テンプレート管理 | `src/routes/template-management.ts` | ✅ **完全実装** |

### ❌ 未実装

| 機能 | 優先度 | 備考 |
|------|--------|------|
| AI自動マッピング | 高 | 未実装 |
| カテゴリ別AI分析 | 高 | 積載効率・庫内作業・配送ルート最適化など |
| チャットAI機能 | 高 | 自然言語処理・コンテキスト保持 |
| レポート自動生成 | 中 | テンプレート活用・スケジュール配信 |
| 外部システム連携 | 低 | ERP・WMS・TMS連携 |

---

## 4. 管理者サイト機能（サービス提供者側）

### ✅ 実装済み

| 機能 | ファイル | 状態 |
|------|---------|------|
| サービス提供者ダッシュボード | `src/routes/provider-dashboard.ts` | ✅ 完全実装 |
| サービス提供者認証 | `src/routes/service-provider-auth.ts` | ✅ 完全実装 |
| ライセンス統計 | `src/routes/licenses.ts` | ✅ 実装済み |
| プラン管理 | `src/routes/upgrade.ts` | ✅ 実装済み |
| ライセンスチェック | `src/routes/license-management.ts` | ✅ 実装済み |

### ⚠️ 部分実装

| 機能 | 現在の状態 | 不足内容 |
|------|-----------|---------|
| ログ管理 | スタブのみ | 統合ログ管理APIの実装が必要 |
| 監査機能 | テーブルのみ | リアルタイム監視・異常検知の実装が必要 |
| クロステナント監査 | スタブのみ | 実装が必要 |

### ❌ 未実装

| 機能 | 優先度 | 備考 |
|------|--------|------|
| 自動課金処理 | 中 | Stripe連携が必要 |
| 使用量監視ダッシュボード | 中 | ユーザー数・データ容量・AI分析回数 |
| コンプライアンス対応 | 低 | 監査証跡・長期保存（最大7年間） |
| 緊急アクセス機能 | 低 | スタブのみ（`breakglass.ts`） |

---

## 5. データベース

### ✅ 実装済み（20テーブル）

| テーブル | 用途 | 状態 |
|---------|------|------|
| tenants | テナント管理 | ✅ |
| users | ユーザー管理 | ✅ |
| roles | ロール定義 | ✅ |
| user_roles | ユーザーロール割り当て | ✅ |
| organization_units | 組織階層 | ✅ |
| sessions | セッション管理 | ✅ |
| invitations | 招待管理 | ✅ |
| audit_logs | 監査ログ | ✅ |
| password_resets | パスワードリセット | ✅ |
| failed_logins | 失敗ログイン | ✅ |
| account_lockouts | アカウントロック | ✅ |
| ip_allowlists | IP制限 | ✅ |
| permission_scopes | 権限スコープ | ✅ |
| service_provider_auth | サービス提供者認証 | ✅ |
| two_factor_methods | 2FA設定 | ✅ |

### ✅ 実装済み（2025-10-19 更新）

| テーブル | 用途 | マイグレーション | 状態 |
|---------|------|---------------|------|
| two_factor_secrets | 2FA設定 | 0011 | ✅ 適用済み |
| session_two_factor_verification | 2FAセッション検証 | 0011 | ✅ 適用済み |
| two_factor_auth_logs | 2FA監査ログ | 0011 | ✅ 適用済み |
| sms_verification_codes | SMS検証コード | 0011 | ✅ 適用済み |
| data_uploads | データアップロード履歴 | 0010 | ✅ **NEW** 適用済み |
| mapping_templates | マッピングテンプレート | 0010 | ✅ **NEW** 適用済み |
| template_fields | テンプレートフィールド | 0010 | ✅ **NEW** 適用済み |
| ai_analysis_results | AI分析結果 | 0010 | ✅ **NEW** 適用済み |
| chat_history | チャット履歴 | 0010 | ✅ **NEW** 適用済み |
| reports | レポート管理 | 0010 | ✅ **NEW** 適用済み |
| report_deliveries | レポート配信管理 | 0010 | ✅ **NEW** 適用済み |

### ⚠️ 保留中（マイグレーション0006-0008）

| テーブル | 用途 | 状態 |
|---------|------|------|
| tenant_licenses | テナントライセンス | ⚠️ 構文エラーで保留 |
| plan_limits | プラン制限 | ⚠️ 構文エラーで保留 |
| usage_metrics | 使用量メトリクス | ⚠️ 構文エラーで保留 |

---

## 📋 優先度別対応リスト

### 🔴 高優先度（即座に対応が必要）

1. ✅ **データアップロード・マッピング機能の実装** - **完了** (2025-10-19)
   - ✅ `src/routes/data-upload.ts` の完全実装
   - ✅ `src/routes/template-management.ts` の完全実装
   - ✅ データベーステーブル追加: `data_uploads`, `mapping_templates`, `template_fields` (migration 0010)

2. **AI分析機能のバックエンド実装** - **次のタスク**
   - カテゴリ別AI分析API
   - チャットAI機能API
   - ✅ データベーステーブル追加: `ai_analysis_results`, `chat_history` (migration 0010)

3. ✅ **部門管理者ロールの追加** - **完了** (2025-10-19)
   - ✅ `roles` テーブルへのロール追加 (migration 0009)
   - `organization_units` との連携強化 - 今後の実装課題
   - 権限チェックミドルウェアの更新 - 今後の実装課題

4. **保留中のマイグレーション修正（0006-0008）**
   - SQLite構文エラーの修正
   - ライセンス管理テーブルの適用

### 🟡 中優先度（近い将来必要）

1. **レポート管理機能の実装**
   - `src/routes/report-management.ts` の作成
   - 自動レポート生成API
   - データベーステーブル追加: `reports`, `report_schedules`

2. **ログ管理・監査機能の強化**
   - `src/routes/logs.ts` の完全実装
   - リアルタイム監視ダッシュボード
   - 異常検知アルゴリズム

3. **組織階層管理UIの実装**
   - 本社・支店・営業所の階層表示
   - 組織単位での権限管理

4. **自動課金処理**
   - Stripe連携
   - 定額・従量課金処理

### 🟢 低優先度（将来的な機能拡張）

1. **SSO連携**
   - SAML/OAuth2.0対応
   - Google Workspace / Microsoft 365連携

2. **外部システム連携**
   - ERP・WMS・TMS API連携
   - IoTデバイス連携

3. **CSV一括ユーザー登録**
   - Standard以上のプラン機能

4. **コンプライアンス強化**
   - 監査証跡の長期保存（7年間）
   - GDPR対応

---

## 🔧 修正が必要な箇所

### 1. 権限階層の明確化

**現在の問題**:
- 「部門管理者」ロールが未定義
- テナント内権限階層の詳細制御が不足

**修正内容**:
```sql
-- rolesテーブルに部門管理者ロールを追加
INSERT INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions) VALUES 
  ('template-department-manager', 'role-template', 'department_manager', '部門管理者', 
   '部門・支店・営業所単位での管理権限', 1,
   '["user.view_department", "user.manage_department", "data.view_department", "data.manage_department"]');
```

### 2. 画面とAPIの対応関係の明確化

**現在の問題**:
- フロントエンド画面は存在するが、対応するAPIが未実装

**修正が必要なファイル**:

| 画面 | 対応API | 状態 |
|------|---------|------|
| `public/static/ai-analysis.*` | `/api/ai/analyze` | ❌ 未実装 |
| `public/static/data-mapping.*` | `/api/data/mapping` | ❌ 未実装 |
| `public/static/data-integration.*` | `/api/data/integration` | ❌ 未実装 |
| `public/static/report-management.*` | `/api/reports` | ❌ 未実装 |

### 3. スタブファイルの実装

以下のスタブファイルを完全実装する必要があります:

```
src/routes/
├── logs.ts                          ❌ スタブ → 完全実装が必要
├── breakglass.ts                    ❌ スタブ → 完全実装が必要
├── data-upload.ts                   ❌ スタブ → 完全実装が必要
├── template-management.ts           ❌ スタブ → 完全実装が必要
├── encryption-management.ts         ❌ スタブ → 完全実装が必要
├── ai-consent-management.ts         ❌ スタブ → 完全実装が必要
├── field-access-control.ts          ❌ スタブ → 完全実装が必要
└── cross-tenant-audit.ts            ❌ スタブ → 完全実装が必要
```

---

## 📝 推奨実装順序

### フェーズ1: 基盤強化（1-2週間）

1. 保留中のマイグレーション修正・適用
2. 部門管理者ロールの追加
3. ログ管理機能の完全実装
4. 監査機能の強化

### フェーズ2: CLO向けコア機能（3-4週間）

1. データアップロード・マッピング機能
2. テンプレート管理機能
3. AI分析バックエンドAPI
4. チャットAI機能

### フェーズ3: レポート・統合機能（2-3週間）

1. レポート生成・管理機能
2. データ統合管理API
3. ダッシュボードKPI API

### フェーズ4: 高度な機能（2-3週間）

1. 自動課金処理
2. 外部システム連携
3. SSO連携

---

## ✅ 次のアクション

### ✅ 完了した作業 (2025-10-19)

1. ✅ **部門管理者ロールの追加** (migration 0009)
   - `template-department-manager` ロールをrole-templateテナントに追加
   - 11個の権限スコープ定義 (user.view_department, data.manage_department, etc.)

2. ✅ **データアップロード・テンプレート管理のテーブル作成** (migration 0010)
   - `data_uploads` - ファイルアップロード履歴
   - `mapping_templates` - マッピングテンプレート
   - `template_fields` - テンプレートフィールド定義
   - `ai_analysis_results` - AI分析結果
   - `chat_history` - チャット履歴
   - `reports` - レポート管理
   - `report_deliveries` - レポート配信管理

3. ✅ **2FA関連テーブルの追加** (migration 0011)
   - `two_factor_secrets`, `session_two_factor_verification`
   - `two_factor_auth_logs`, `sms_verification_codes`

4. ✅ **データアップロードAPIの完全実装** (`src/routes/data-upload.ts`)
   - ファイルアップロード処理
   - アップロード履歴取得
   - 詳細取得・削除・再処理
   - 統計情報取得

5. ✅ **テンプレート管理APIの完全実装** (`src/routes/template-management.ts`)
   - テンプレート一覧・詳細取得
   - テンプレートCRUD操作
   - フィールド管理（追加・削除）
   - テンプレート複製機能

### 即座に実施すべき作業

1. **AI分析APIの実装** - **最優先**
   - カテゴリ別AI分析エンドポイント
   - 分析結果の保存・取得
   - データベーステーブルは既に作成済み

2. **チャットAI機能APIの実装** - **最優先**
   - チャットメッセージの送受信
   - コンテキスト保持機能
   - データベーステーブルは既に作成済み

3. **レポート管理APIの実装** - **高優先度**
   - レポート生成・取得
   - スケジュール配信機能
   - データベーステーブルは既に作成済み

4. **マイグレーション0006-0008の修正** - **中優先度**
   - SQLite構文エラーの修正
   - ライセンス管理テーブルの適用

---

**分析完了日**: 2025-10-19  
**最終更新日**: 2025-10-19  
**次回レビュー予定**: AI機能実装完了後
