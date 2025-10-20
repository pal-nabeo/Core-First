# データベース仕様書 (Database Specification)

**プロジェクト名**: Core First - CLO向け経営管理クラウドサービス  
**データベース種類**: Cloudflare D1 (SQLite)  
**最終更新日**: 2025-10-19  
**バージョン**: 1.2

---

## 目次

1. [データベース概要](#1-データベース概要)
2. [全テーブル一覧](#2-全テーブル一覧)
3. [詳細テーブル定義](#3-詳細テーブル定義)
   - [3.1 マルチテナント・組織管理](#31-マルチテナント組織管理)
   - [3.2 認証・アクセス制御](#32-認証アクセス制御)
   - [3.3 権限管理](#33-権限管理)
   - [3.4 セキュリティ・監査](#34-セキュリティ監査)
   - [3.5 2要素認証](#35-2要素認証)
   - [3.6 CLO機能（データアップロード・分析）](#36-clo機能データアップロード分析)
   - [3.7 サービス提供者管理](#37-サービス提供者管理)
   - [3.8 ビュー（View）](#38-ビューview)
4. [データモデル図](#4-データモデル図)
5. [インデックス一覧](#5-インデックス一覧)
6. [トリガー一覧](#6-トリガー一覧)
7. [マイグレーション履歴](#7-マイグレーション履歴)

---

## 1. データベース概要

### 1.1 アーキテクチャ

このシステムは**マルチテナントSaaSアーキテクチャ**を採用しており、以下の特徴があります：

- **完全なデータ分離**: 各テナント（企業）のデータは論理的に完全分離
- **サブドメインベース識別**: `{subdomain}.example.com` でテナント識別
- **階層的権限管理**: サービス提供者・テナント・組織単位の3階層
- **グローバル分散配置**: Cloudflare D1によるエッジロケーション配置
- **RBAC (Role-Based Access Control)**: 役割ベースのアクセス制御

### 1.2 テナント構造

```
┌─────────────────────────────────────────────────────┐
│ サービス提供者テナント (system / pal-style)         │
│ - スーパー管理者（テナント横断管理）                │
│ - システム管理者（技術・インフラ管理）              │
│ - 運用管理者（日常運用・サポート）                  │
│ - カスタマーサクセス（テナントサポート）            │
│ - 経理担当者（請求・財務管理）                      │
│ - 監査担当者（ログ・コンプライアンス）              │
└─────────────────────────────────────────────────────┘
                      ↓ 管理
┌─────────────────────────────────────────────────────┐
│ テナントA（企業A）                                   │
│ ├── テナント管理者（スーパー管理者）                │
│ ├── テナント副管理者（管理者）                      │
│ ├── 部門管理者（部門単位管理）                      │
│ ├── 一般ユーザー（基本機能利用）                    │
│ └── ゲストユーザー（閲覧のみ）                      │
│                                                     │
│ ├── 組織単位（事業所A）                             │
│ ├── 組織単位（事業所B）                             │
│ └── 組織単位（事業所C）                             │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ テナントB（企業B）                                   │
│ └── （同様の階層構造）                               │
└─────────────────────────────────────────────────────┘
```

### 1.3 主要機能領域

| 機能領域 | 説明 | 主要テーブル |
|---------|------|------------|
| **マルチテナント管理** | 企業・組織の管理 | `tenants`, `organization_units` |
| **認証・アクセス制御** | ログイン・セッション管理 | `users`, `sessions`, `invitations` |
| **権限管理** | ロール・権限スコープ管理 | `roles`, `user_roles`, `permission_scopes` |
| **セキュリティ** | 失敗ログイン・アカウントロック・IP制限 | `failed_logins`, `account_lockouts`, `ip_allowlists` |
| **2要素認証** | TOTP/SMS認証 | `two_factor_secrets`, `two_factor_auth_logs` |
| **監査ログ** | 全操作の追跡 | `audit_logs`, `tenant_management_logs` |
| **CLO機能** | データアップロード・AI分析・レポート | `data_uploads`, `ai_analysis_results`, `reports` |
| **サービス提供者管理** | システム運営側機能 | `service_provider_auth`, `cross_tenant_users` (view) |

---

## 2. 全テーブル一覧

| # | テーブル名 | 説明 | レコード例 |
|---|-----------|------|----------|
| **マルチテナント・組織管理** ||||
| 1 | `tenants` | テナント（企業）マスタ | 10-1000件 |
| 2 | `organization_units` | 組織単位（事業所・部門） | 100-10000件 |
| **認証・アクセス制御** ||||
| 3 | `users` | ユーザーアカウント | 1000-100000件 |
| 4 | `roles` | ロール定義 | 20-100件 |
| 5 | `user_roles` | ユーザー・ロール紐付け | 1000-100000件 |
| 6 | `invitations` | ユーザー招待 | 100-10000件 |
| 7 | `password_resets` | パスワードリセットトークン | 10-1000件 |
| 8 | `sessions` | アクティブセッション | 100-10000件 |
| **権限管理** ||||
| 9 | `permission_scopes` | 権限スコープ定義 | 50-500件 |
| **セキュリティ・監査** ||||
| 10 | `failed_logins` | 失敗ログイン記録 | 1000-100000件 |
| 11 | `account_lockouts` | アカウントロック | 10-1000件 |
| 12 | `audit_logs` | 監査ログ | 10000-1000000件 |
| 13 | `ip_allowlists` | IP許可リスト | 10-1000件 |
| **2要素認証** ||||
| 14 | `two_factor_secrets` | 2FA シークレット | 100-10000件 |
| 15 | `two_factor_methods` | 2FA 方法設定 | 100-10000件 |
| 16 | `backup_codes` | バックアップコード | 1000-100000件 |
| 17 | `session_two_factor_verification` | セッション2FA確認 | 100-10000件 |
| 18 | `two_factor_auth_logs` | 2FA監査ログ | 1000-100000件 |
| 19 | `sms_verification_codes` | SMS認証コード | 100-10000件 |
| **CLO機能（データアップロード・分析）** ||||
| 20 | `data_uploads` | データアップロード記録 | 1000-100000件 |
| 21 | `mapping_templates` | マッピングテンプレート | 10-1000件 |
| 22 | `template_fields` | テンプレートフィールド定義 | 100-10000件 |
| 23 | `ai_analysis_results` | AI分析結果 | 1000-100000件 |
| 24 | `chat_history` | AIチャット履歴 | 1000-100000件 |
| 25 | `reports` | レポート管理 | 1000-100000件 |
| 26 | `report_deliveries` | レポート配信記録 | 1000-100000件 |
| **サービス提供者管理** ||||
| 27 | `tenant_management_logs` | テナント管理ログ | 1000-100000件 |
| 28 | `service_provider_auth` | サービス提供者認証情報 | 10-100件 |

**合計**: 28テーブル + 1ビュー

---

## 3. 詳細テーブル定義

### 3.1 マルチテナント・組織管理

#### 3.1.1 `tenants` - テナントマスタ

**説明**: システムを利用する各企業（テナント）の基本情報を管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | テナントID（UUID） |
| `subdomain` | TEXT | NOT NULL | - | サブドメイン（一意、例: `abc-logistics`） |
| `name` | TEXT | NOT NULL | - | テナント名（企業名） |
| `plan_id` | TEXT | NOT NULL | `'free'` | プランID（`free`, `basic`, `standard`, `premium`, `unlimited`） |
| `company_type` | TEXT | NULL | - | 企業タイプ（`logistics`, `delivery`, `warehouse`, `service_provider`, `template`） |
| `company_size` | TEXT | NULL | - | 企業規模（`small`, `medium`, `large`, `enterprise`） |
| `status` | TEXT | NOT NULL | `'active'` | ステータス（`active`, `suspended`, `deleted`） |
| `domain_allowlist` | TEXT | NULL | - | 許可ドメインリスト（JSON配列、例: `["pal-style.co.jp"]`） |
| `max_users` | INTEGER | NULL | 100 | 最大ユーザー数 |
| `license_type` | TEXT | NULL | `'trial'` | ライセンスタイプ（`trial`, `paid`） |
| `license_expires_at` | DATETIME | NULL | - | ライセンス有効期限 |
| `plan_started_at` | DATETIME | NULL | - | プラン開始日 |
| `plan_expires_at` | DATETIME | NULL | - | プラン有効期限 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**制約**:
- UNIQUE: `subdomain`

**インデックス**:
- `idx_tenants_subdomain` ON `subdomain`
- `idx_tenants_plan_id` ON `plan_id`
- `idx_tenants_status` ON `status`

**特殊テナント**:
- `id='system'`, `subdomain='pal-style'`: サービス提供者テナント（システム管理者用）
- `id='role-template'`: ロールテンプレート専用テナント（実際には使用されない）

---

#### 3.1.2 `organization_units` - 組織単位

**説明**: テナント内の組織階層（本社・支社・営業所・部門など）を管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 組織単位ID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | 所属テナントID |
| `parent_id` | TEXT | NULL | - | 親組織ID（NULL=最上位） |
| `name` | TEXT | NOT NULL | - | 組織名（例: `東京本社`, `大阪支社`） |
| `type` | TEXT | NOT NULL | - | 組織タイプ（`headquarters`, `branch`, `office`, `department`, `team`） |
| `code` | TEXT | NULL | - | 組織コード（社内識別用） |
| `manager_user_id` | TEXT | NULL | - | 組織責任者のユーザーID |
| `status` | TEXT | NOT NULL | `'active'` | ステータス（`active`, `inactive`） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `parent_id` → `organization_units(id)` ON DELETE CASCADE
- `manager_user_id` → `users(id)` ON DELETE SET NULL

**インデックス**:
- `idx_organization_units_tenant_id` ON `tenant_id`
- `idx_organization_units_parent_id` ON `parent_id`
- `idx_organization_units_type` ON `type`

---

### 3.2 認証・アクセス制御

#### 3.2.1 `users` - ユーザーアカウント

**説明**: システム利用者の基本情報とログイン認証情報。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ユーザーID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | 所属テナントID |
| `email` | TEXT | NOT NULL | - | メールアドレス（ログインID） |
| `password_hash` | TEXT | NOT NULL | - | パスワードハッシュ（bcrypt） |
| `display_name` | TEXT | NOT NULL | - | 表示名 |
| `status` | TEXT | NOT NULL | `'active'` | ステータス（`active`, `invited`, `suspended`, `deleted`） |
| `organization_unit_id` | TEXT | NULL | - | 所属組織単位ID |
| `last_login_at` | DATETIME | NULL | - | 最終ログイン日時 |
| `failed_login_count` | INTEGER | NOT NULL | 0 | 連続ログイン失敗回数 |
| `is_locked` | INTEGER | NOT NULL | 0 | アカウントロックフラグ（0=未ロック, 1=ロック） |
| `locked_until` | DATETIME | NULL | - | ロック解除予定日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `organization_unit_id` → `organization_units(id)` ON DELETE SET NULL

**制約**:
- UNIQUE: (`tenant_id`, `email`)

**インデックス**:
- `idx_users_tenant_id` ON `tenant_id`
- `idx_users_email` ON `email`
- `idx_users_status` ON `status`
- `idx_users_organization_unit_id` ON `organization_unit_id`

---

#### 3.2.2 `roles` - ロール定義

**説明**: システム全体およびテナント内のロール（役割）定義。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ロールID |
| `tenant_id` | TEXT | NOT NULL | - | 所属テナントID（`system`, `role-template`, または各テナントID） |
| `name` | TEXT | NOT NULL | - | ロール名（英語識別子、例: `super_admin`, `admin`, `user`） |
| `display_name` | TEXT | NOT NULL | - | ロール表示名（日本語） |
| `description` | TEXT | NULL | - | ロール説明 |
| `is_system_role` | INTEGER | NOT NULL | 0 | システムロールフラグ（1=システム標準ロール） |
| `permissions` | TEXT | NOT NULL | `'[]'` | 権限配列（JSON、例: `["user.create", "user.update"]`） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: (`tenant_id`, `name`)

**インデックス**:
- `idx_roles_tenant_id` ON `tenant_id`
- `idx_roles_name` ON `name`

**標準ロール**:

##### サービス提供者ロール（`tenant_id='system'`）
1. `super_admin` - スーパー管理者（テナント横断・システム全体管理）
2. `admin` - システム管理者（技術・インフラ管理）
3. `operation_admin` - 運用管理者（日常運用・サポート）
4. `customer_success` - カスタマーサクセス（テナントサポート）
5. `finance_admin` - 経理担当者（請求・財務管理）
6. `auditor` - 監査担当者（ログ・コンプライアンス）

##### テナント管理者ロール（`tenant_id='role-template'`、各テナントで複製）
1. `tenant_owner` - テナント管理者（スーパー管理者、テナント内最高権限）
2. `tenant_admin` - テナント副管理者（管理者、ユーザー管理・基本設定）
3. `department_manager` - 部門管理者（部門単位管理）
4. `user` - 一般ユーザー（基本機能利用）
5. `guest` - ゲストユーザー（閲覧専用）

---

#### 3.2.3 `user_roles` - ユーザー・ロール紐付け

**説明**: ユーザーとロールの多対多関係を管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 紐付けID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `role_id` | TEXT | NOT NULL | - | ロールID |
| `assigned_by` | TEXT | NULL | - | 割り当て実施者ユーザーID |
| `assigned_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 割り当て日時 |
| `scope_type` | TEXT | NULL | - | スコープタイプ（`tenant`, `organization_unit`） |
| `scope_id` | TEXT | NULL | - | スコープID（テナントIDまたは組織単位ID） |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE
- `role_id` → `roles(id)` ON DELETE CASCADE
- `assigned_by` → `users(id)` ON DELETE SET NULL

**制約**:
- UNIQUE: (`user_id`, `role_id`, `scope_type`, `scope_id`)

**インデックス**:
- `idx_user_roles_user_id` ON `user_id`
- `idx_user_roles_role_id` ON `role_id`

---

#### 3.2.4 `invitations` - ユーザー招待

**説明**: 新規ユーザーの招待トークン管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 招待ID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | 招待先テナントID |
| `email` | TEXT | NOT NULL | - | 招待メールアドレス |
| `token` | TEXT | NOT NULL | - | 招待トークン（UUID） |
| `role_id` | TEXT | NOT NULL | - | 割り当て予定ロールID |
| `invited_by` | TEXT | NOT NULL | - | 招待実施者ユーザーID |
| `status` | TEXT | NOT NULL | `'pending'` | ステータス（`pending`, `accepted`, `expired`, `cancelled`） |
| `expires_at` | DATETIME | NOT NULL | - | 有効期限 |
| `accepted_at` | DATETIME | NULL | - | 受諾日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `role_id` → `roles(id)` ON DELETE CASCADE
- `invited_by` → `users(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: `token`

**インデックス**:
- `idx_invitations_tenant_id` ON `tenant_id`
- `idx_invitations_email` ON `email`
- `idx_invitations_token` ON `token`
- `idx_invitations_status` ON `status`

---

#### 3.2.5 `password_resets` - パスワードリセット

**説明**: パスワードリセットトークンの管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | リセットID（UUID） |
| `user_id` | TEXT | NOT NULL | - | 対象ユーザーID |
| `token` | TEXT | NOT NULL | - | リセットトークン（UUID） |
| `expires_at` | DATETIME | NOT NULL | - | 有効期限 |
| `used_at` | DATETIME | NULL | - | 使用日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: `token`

**インデックス**:
- `idx_password_resets_user_id` ON `user_id`
- `idx_password_resets_token` ON `token`

---

#### 3.2.6 `sessions` - セッション管理

**説明**: アクティブなユーザーセッションの管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | セッションID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `token` | TEXT | NOT NULL | - | セッショントークン（UUID） |
| `ip_address` | TEXT | NULL | - | IPアドレス |
| `user_agent` | TEXT | NULL | - | User-Agent文字列 |
| `expires_at` | DATETIME | NOT NULL | - | 有効期限 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時（ログイン日時） |
| `last_activity_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 最終アクティビティ日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE
- `tenant_id` → `tenants(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: `token`

**インデックス**:
- `idx_sessions_user_id` ON `user_id`
- `idx_sessions_token` ON `token`
- `idx_sessions_expires_at` ON `expires_at`

---

### 3.3 権限管理

#### 3.3.1 `permission_scopes` - 権限スコープ定義

**説明**: システム全体の権限とそのスコープ（適用範囲）を定義。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 権限スコープID |
| `scope_type` | TEXT | NOT NULL | - | スコープタイプ（`system`, `tenant`, `organization_unit`） |
| `scope_id` | TEXT | NOT NULL | - | スコープID（`system`, テナントID, 組織単位ID） |
| `permission` | TEXT | NOT NULL | - | 権限名（例: `tenant.create`, `user.view_department`） |
| `resource_type` | TEXT | NULL | - | リソースタイプ（例: `tenant`, `user`, `data`） |
| `resource_pattern` | TEXT | NULL | - | リソースパターン（正規表現、例: `.*`, `department:.*`） |
| `description` | TEXT | NULL | - | 権限説明 |
| `is_active` | INTEGER | NOT NULL | 1 | 有効フラグ（0=無効, 1=有効） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**制約**:
- UNIQUE: (`scope_type`, `scope_id`, `permission`, `resource_type`)

**インデックス**:
- `idx_permission_scopes_scope` ON (`scope_type`, `scope_id`)
- `idx_permission_scopes_permission` ON `permission`

**権限カテゴリ例**:

| 権限プレフィックス | 説明 | 例 |
|------------------|------|-----|
| `tenant.*` | テナント管理 | `tenant.create`, `tenant.update`, `tenant.delete` |
| `user.*` | ユーザー管理 | `user.create`, `user.view_department` |
| `data.*` | データ管理 | `data.read`, `data.create`, `data.update` |
| `system.*` | システム管理 | `system.monitor`, `system.backup` |
| `billing.*` | 請求管理 | `billing.manage`, `billing.view` |
| `audit.*` | 監査 | `audit.view`, `logs.view` |

---

### 3.4 セキュリティ・監査

#### 3.4.1 `failed_logins` - 失敗ログイン記録

**説明**: ログイン失敗の監査ログ（セキュリティ分析用）。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ログID（UUID） |
| `tenant_id` | TEXT | NULL | - | テナントID（不明な場合NULL） |
| `email` | TEXT | NOT NULL | - | ログイン試行メールアドレス |
| `ip_address` | TEXT | NULL | - | IPアドレス |
| `user_agent` | TEXT | NULL | - | User-Agent文字列 |
| `reason` | TEXT | NULL | - | 失敗理由（例: `invalid_password`, `account_locked`） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 失敗日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE

**インデックス**:
- `idx_failed_logins_email` ON `email`
- `idx_failed_logins_ip_address` ON `ip_address`
- `idx_failed_logins_created_at` ON `created_at`

---

#### 3.4.2 `account_lockouts` - アカウントロック

**説明**: セキュリティポリシーに基づくアカウントロックの記録。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ロックID（UUID） |
| `user_id` | TEXT | NOT NULL | - | 対象ユーザーID |
| `reason` | TEXT | NOT NULL | - | ロック理由（例: `failed_login_attempts`, `admin_action`） |
| `locked_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | ロック日時 |
| `locked_until` | DATETIME | NOT NULL | - | ロック解除予定日時 |
| `unlocked_at` | DATETIME | NULL | - | 実際の解除日時 |
| `locked_by` | TEXT | NULL | - | ロック実施者ユーザーID（管理者操作の場合） |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE
- `locked_by` → `users(id)` ON DELETE SET NULL

**インデックス**:
- `idx_account_lockouts_user_id` ON `user_id`
- `idx_account_lockouts_locked_until` ON `locked_until`

---

#### 3.4.3 `audit_logs` - 監査ログ

**説明**: システム全体の操作履歴を記録（コンプライアンス対応）。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ログID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `user_id` | TEXT | NULL | - | 実行ユーザーID（システム操作の場合NULL） |
| `action` | TEXT | NOT NULL | - | アクション（例: `user.created`, `plan.changed`） |
| `resource_type` | TEXT | NOT NULL | - | リソースタイプ（例: `user`, `tenant`, `role`） |
| `resource_id` | TEXT | NULL | - | リソースID |
| `changes` | TEXT | NULL | - | 変更内容（JSON） |
| `details` | TEXT | NULL | - | 詳細情報（JSON） |
| `ip_address` | TEXT | NULL | - | IPアドレス |
| `user_agent` | TEXT | NULL | - | User-Agent文字列 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 実行日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE SET NULL

**インデックス**:
- `idx_audit_logs_tenant_id` ON `tenant_id`
- `idx_audit_logs_user_id` ON `user_id`
- `idx_audit_logs_action` ON `action`
- `idx_audit_logs_resource_type` ON `resource_type`
- `idx_audit_logs_created_at` ON `created_at`

---

#### 3.4.4 `ip_allowlists` - IP許可リスト

**説明**: テナントまたはユーザー単位でのIP制限設定。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 許可リストID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `user_id` | TEXT | NULL | - | ユーザーID（ユーザー個別設定の場合） |
| `ip_address` | TEXT | NOT NULL | - | 許可IPアドレス（CIDR表記可） |
| `description` | TEXT | NULL | - | 説明（例: `本社オフィス`, `VPN接続`） |
| `is_active` | INTEGER | NOT NULL | 1 | 有効フラグ（0=無効, 1=有効） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE

**インデックス**:
- `idx_ip_allowlists_tenant_id` ON `tenant_id`
- `idx_ip_allowlists_user_id` ON `user_id`

---

### 3.5 2要素認証

#### 3.5.1 `two_factor_secrets` - 2FAシークレット

**説明**: TOTP（Time-based One-Time Password）のシークレットキー管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | シークレットID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `secret` | TEXT | NOT NULL | - | TOTPシークレット（暗号化推奨） |
| `backup_codes` | TEXT | NULL | - | バックアップコード（JSON配列） |
| `method` | TEXT | NOT NULL | `'totp'` | 認証方法（`totp`, `sms`, `email`） |
| `phone_number` | TEXT | NULL | - | 電話番号（SMS認証用） |
| `is_enabled` | INTEGER | NOT NULL | 0 | 有効フラグ（0=無効, 1=有効） |
| `verified_at` | DATETIME | NULL | - | 検証完了日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE
- `tenant_id` → `tenants(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: (`user_id`, `tenant_id`)

**インデックス**:
- `idx_two_factor_secrets_user_id` ON `user_id`
- `idx_two_factor_secrets_tenant_id` ON `tenant_id`
- `idx_two_factor_secrets_enabled` ON `is_enabled`

---

#### 3.5.2 `two_factor_methods` - 2FA方法設定

**説明**: ユーザーが設定した2FA方法の管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 方法ID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `method_type` | TEXT | NOT NULL | - | 方法タイプ（`totp`, `sms`, `email`, `backup_code`） |
| `is_primary` | INTEGER | NOT NULL | 0 | プライマリ方法フラグ（0=サブ, 1=プライマリ） |
| `is_enabled` | INTEGER | NOT NULL | 1 | 有効フラグ（0=無効, 1=有効） |
| `phone_number` | TEXT | NULL | - | 電話番号（SMS用） |
| `email` | TEXT | NULL | - | メールアドレス（Email用） |
| `verified_at` | DATETIME | NULL | - | 検証完了日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: (`user_id`, `method_type`)

**インデックス**:
- `idx_two_factor_methods_user_id` ON `user_id`
- `idx_two_factor_methods_type` ON `method_type`

---

#### 3.5.3 `backup_codes` - バックアップコード

**説明**: 2FA利用不可時の緊急ログイン用バックアップコード。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | コードID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `code_hash` | TEXT | NOT NULL | - | コードハッシュ（bcrypt） |
| `is_used` | INTEGER | NOT NULL | 0 | 使用済みフラグ（0=未使用, 1=使用済み） |
| `used_at` | DATETIME | NULL | - | 使用日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE

**インデックス**:
- `idx_backup_codes_user_id` ON `user_id`
- `idx_backup_codes_used` ON `is_used`

---

#### 3.5.4 `session_two_factor_verification` - セッション2FA確認

**説明**: セッション単位での2FA検証状態管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 検証ID（UUID） |
| `session_id` | TEXT | NOT NULL | - | セッションID |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `verified_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 検証完了日時 |
| `expires_at` | DATETIME | NOT NULL | datetime('now', '+1 hour') | 検証有効期限 |
| `method_used` | TEXT | NOT NULL | `'totp'` | 使用された認証方法 |

**外部キー**:
- `session_id` → `sessions(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: (`session_id`, `user_id`)

**インデックス**:
- `idx_session_two_factor_session_id` ON `session_id`
- `idx_session_two_factor_user_id` ON `user_id`
- `idx_session_two_factor_expires_at` ON `expires_at`

---

#### 3.5.5 `two_factor_auth_logs` - 2FA監査ログ

**説明**: 2FA操作の監査ログ（セットアップ・検証・無効化など）。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ログID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `action` | TEXT | NOT NULL | - | アクション（`setup`, `verify`, `disable`, `backup_code_used`） |
| `method` | TEXT | NOT NULL | - | 方法（`totp`, `sms`, `backup_code`） |
| `result` | TEXT | NOT NULL | - | 結果（`success`, `failure`） |
| `ip_address` | TEXT | NULL | - | IPアドレス |
| `user_agent` | TEXT | NULL | - | User-Agent文字列 |
| `details` | TEXT | NULL | - | 詳細（JSON） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 実行日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE
- `tenant_id` → `tenants(id)` ON DELETE CASCADE

**インデックス**:
- `idx_two_factor_auth_logs_user_id` ON `user_id`
- `idx_two_factor_auth_logs_action` ON `action`
- `idx_two_factor_auth_logs_created_at` ON `created_at`

---

#### 3.5.6 `sms_verification_codes` - SMS認証コード

**説明**: SMS 2FA用の一時的な認証コード管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | コードID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `phone_number` | TEXT | NOT NULL | - | 送信先電話番号 |
| `verification_code` | TEXT | NOT NULL | - | 認証コード（6桁など） |
| `purpose` | TEXT | NOT NULL | `'two_factor'` | 用途（`two_factor`, `password_reset`, `phone_verification`） |
| `attempts` | INTEGER | NOT NULL | 0 | 検証試行回数 |
| `is_used` | INTEGER | NOT NULL | 0 | 使用済みフラグ（0=未使用, 1=使用済み） |
| `expires_at` | DATETIME | NOT NULL | datetime('now', '+10 minutes') | 有効期限（10分） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE

**インデックス**:
- `idx_sms_verification_codes_user_id` ON `user_id`
- `idx_sms_verification_codes_phone` ON `phone_number`
- `idx_sms_verification_codes_expires_at` ON `expires_at`

---

### 3.6 CLO機能（データアップロード・分析）

#### 3.6.1 `data_uploads` - データアップロード記録

**説明**: ユーザーがアップロードしたデータファイルの管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | アップロードID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `user_id` | TEXT | NOT NULL | - | アップロード実施者ユーザーID |
| `file_name` | TEXT | NOT NULL | - | ファイル名 |
| `file_size` | INTEGER | NOT NULL | - | ファイルサイズ（バイト） |
| `file_type` | TEXT | NOT NULL | - | ファイルタイプ（`csv`, `excel`, `json`） |
| `storage_path` | TEXT | NOT NULL | - | ストレージパス（R2など） |
| `status` | TEXT | NOT NULL | `'pending'` | ステータス（`pending`, `processing`, `completed`, `failed`） |
| `progress` | INTEGER | NOT NULL | 0 | 処理進捗（0-100%） |
| `row_count` | INTEGER | NULL | - | データ行数 |
| `error_message` | TEXT | NULL | - | エラーメッセージ |
| `metadata` | TEXT | NULL | - | メタデータ（JSON） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `completed_at` | DATETIME | NULL | - | 完了日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE

**インデックス**:
- `idx_data_uploads_tenant_id` ON `tenant_id`
- `idx_data_uploads_user_id` ON `user_id`
- `idx_data_uploads_status` ON `status`
- `idx_data_uploads_created_at` ON `created_at`

---

#### 3.6.2 `mapping_templates` - マッピングテンプレート

**説明**: データ取り込み時のフィールドマッピングテンプレート定義。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | テンプレートID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `name` | TEXT | NOT NULL | - | テンプレート名 |
| `description` | TEXT | NULL | - | 説明 |
| `source_format` | TEXT | NOT NULL | - | 入力フォーマット（`csv`, `excel`, `json`） |
| `is_active` | INTEGER | NOT NULL | 1 | 有効フラグ（0=無効, 1=有効） |
| `created_by` | TEXT | NOT NULL | - | 作成者ユーザーID |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `created_by` → `users(id)` ON DELETE CASCADE

**インデックス**:
- `idx_mapping_templates_tenant_id` ON `tenant_id`
- `idx_mapping_templates_active` ON `is_active`

---

#### 3.6.3 `template_fields` - テンプレートフィールド定義

**説明**: マッピングテンプレートの個別フィールド定義。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | フィールドID（UUID） |
| `template_id` | TEXT | NOT NULL | - | 所属テンプレートID |
| `source_field` | TEXT | NOT NULL | - | 入力フィールド名 |
| `target_field` | TEXT | NOT NULL | - | 出力フィールド名 |
| `field_type` | TEXT | NOT NULL | - | データ型（`text`, `number`, `date`, `boolean`） |
| `is_required` | INTEGER | NOT NULL | 0 | 必須フラグ（0=任意, 1=必須） |
| `default_value` | TEXT | NULL | - | デフォルト値 |
| `transformation` | TEXT | NULL | - | 変換ルール（JSON） |
| `validation_rules` | TEXT | NULL | - | バリデーションルール（JSON） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `template_id` → `mapping_templates(id)` ON DELETE CASCADE

**インデックス**:
- `idx_template_fields_template_id` ON `template_id`

---

#### 3.6.4 `ai_analysis_results` - AI分析結果

**説明**: AI分析エンジンによる分析結果の保存。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 分析結果ID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `upload_id` | TEXT | NOT NULL | - | 元データアップロードID |
| `analysis_type` | TEXT | NOT NULL | - | 分析タイプ（`summary`, `trend`, `anomaly`, `forecast`） |
| `result_data` | TEXT | NOT NULL | - | 分析結果（JSON） |
| `confidence_score` | REAL | NULL | - | 信頼度スコア（0.0-1.0） |
| `insights` | TEXT | NULL | - | 洞察・提案（JSON配列） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `upload_id` → `data_uploads(id)` ON DELETE CASCADE

**インデックス**:
- `idx_ai_analysis_results_tenant_id` ON `tenant_id`
- `idx_ai_analysis_results_upload_id` ON `upload_id`
- `idx_ai_analysis_results_type` ON `analysis_type`
- `idx_ai_analysis_results_created_at` ON `created_at`

---

#### 3.6.5 `chat_history` - AIチャット履歴

**説明**: ユーザーとAIアシスタントのチャット会話履歴。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | チャットID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `upload_id` | TEXT | NULL | - | 関連データアップロードID |
| `message_type` | TEXT | NOT NULL | - | メッセージタイプ（`user`, `assistant`, `system`） |
| `message` | TEXT | NOT NULL | - | メッセージ内容 |
| `context_data` | TEXT | NULL | - | コンテキストデータ（JSON） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 送信日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE
- `upload_id` → `data_uploads(id)` ON DELETE SET NULL

**インデックス**:
- `idx_chat_history_tenant_id` ON `tenant_id`
- `idx_chat_history_user_id` ON `user_id`
- `idx_chat_history_upload_id` ON `upload_id`
- `idx_chat_history_created_at` ON `created_at`

---

#### 3.6.6 `reports` - レポート管理

**説明**: 生成されたレポートの管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | レポートID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | テナントID |
| `created_by` | TEXT | NOT NULL | - | 作成者ユーザーID |
| `title` | TEXT | NOT NULL | - | レポートタイトル |
| `report_type` | TEXT | NOT NULL | - | レポートタイプ（`monthly`, `quarterly`, `custom`） |
| `format` | TEXT | NOT NULL | - | フォーマット（`pdf`, `excel`, `html`） |
| `storage_path` | TEXT | NOT NULL | - | ストレージパス（R2など） |
| `file_size` | INTEGER | NULL | - | ファイルサイズ（バイト） |
| `status` | TEXT | NOT NULL | `'draft'` | ステータス（`draft`, `published`, `archived`） |
| `period_start` | DATE | NULL | - | 対象期間開始日 |
| `period_end` | DATE | NULL | - | 対象期間終了日 |
| `metadata` | TEXT | NULL | - | メタデータ（JSON） |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `published_at` | DATETIME | NULL | - | 公開日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `created_by` → `users(id)` ON DELETE CASCADE

**インデックス**:
- `idx_reports_tenant_id` ON `tenant_id`
- `idx_reports_created_by` ON `created_by`
- `idx_reports_status` ON `status`
- `idx_reports_created_at` ON `created_at`

---

#### 3.6.7 `report_deliveries` - レポート配信記録

**説明**: レポートの配信・共有履歴の管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 配信ID（UUID） |
| `report_id` | TEXT | NOT NULL | - | レポートID |
| `recipient_type` | TEXT | NOT NULL | - | 受信者タイプ（`user`, `email`, `group`） |
| `recipient_id` | TEXT | NULL | - | 受信者ID（ユーザーIDまたはグループID） |
| `recipient_email` | TEXT | NULL | - | 受信者メールアドレス |
| `delivery_method` | TEXT | NOT NULL | - | 配信方法（`email`, `download`, `api`） |
| `status` | TEXT | NOT NULL | `'pending'` | ステータス（`pending`, `sent`, `failed`） |
| `sent_at` | DATETIME | NULL | - | 送信日時 |
| `opened_at` | DATETIME | NULL | - | 開封日時 |
| `downloaded_at` | DATETIME | NULL | - | ダウンロード日時 |
| `error_message` | TEXT | NULL | - | エラーメッセージ |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |

**外部キー**:
- `report_id` → `reports(id)` ON DELETE CASCADE

**インデックス**:
- `idx_report_deliveries_report_id` ON `report_id`
- `idx_report_deliveries_recipient_email` ON `recipient_email`
- `idx_report_deliveries_status` ON `status`
- `idx_report_deliveries_created_at` ON `created_at`

---

### 3.7 サービス提供者管理

#### 3.7.1 `tenant_management_logs` - テナント管理ログ

**説明**: サービス提供者側のテナント管理操作履歴（作成・変更・削除など）。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | ログID（UUID） |
| `tenant_id` | TEXT | NOT NULL | - | 対象テナントID |
| `action_type` | TEXT | NOT NULL | - | アクション（`created`, `updated`, `suspended`, `deleted`, `plan_changed`） |
| `performed_by` | TEXT | NOT NULL | - | 実行者ユーザーID（サービス提供者側） |
| `old_values` | TEXT | NULL | - | 変更前の値（JSON） |
| `new_values` | TEXT | NULL | - | 変更後の値（JSON） |
| `reason` | TEXT | NULL | - | 操作理由 |
| `approval_required` | INTEGER | NOT NULL | 0 | 承認要否フラグ（0=不要, 1=必要） |
| `approved_by` | TEXT | NULL | - | 承認者ユーザーID |
| `approved_at` | DATETIME | NULL | - | 承認日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 実行日時 |

**外部キー**:
- `tenant_id` → `tenants(id)` ON DELETE CASCADE
- `performed_by` → `users(id)` ON DELETE SET NULL
- `approved_by` → `users(id)` ON DELETE SET NULL

**インデックス**:
- `idx_tenant_management_logs_tenant_id` ON `tenant_id`
- `idx_tenant_management_logs_performed_by` ON `performed_by`
- `idx_tenant_management_logs_action_type` ON `action_type`

---

#### 3.7.2 `service_provider_auth` - サービス提供者認証情報

**説明**: システム管理者（サービス提供者側ユーザー）専用の認証情報管理。

**主キー**: `id` (TEXT)

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `id` | TEXT | NOT NULL | - | 認証情報ID（UUID） |
| `user_id` | TEXT | NOT NULL | - | ユーザーID |
| `auth_type` | TEXT | NOT NULL | - | 認証タイプ（`password`, `mfa`, `sso`） |
| `auth_data` | TEXT | NOT NULL | - | 認証データ（JSON、例: `{"algorithm": "bcrypt", "requires_mfa": true}`） |
| `is_active` | INTEGER | NOT NULL | 1 | 有効フラグ（0=無効, 1=有効） |
| `expires_at` | DATETIME | NULL | - | 有効期限 |
| `last_used_at` | DATETIME | NULL | - | 最終使用日時 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 作成日時 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 更新日時 |

**外部キー**:
- `user_id` → `users(id)` ON DELETE CASCADE

**制約**:
- UNIQUE: (`user_id`, `auth_type`)

**インデックス**:
- `idx_service_provider_auth_user_id` ON `user_id`
- `idx_service_provider_auth_type` ON `auth_type`

---

### 3.8 ビュー（View）

#### 3.8.1 `cross_tenant_users` - クロステナントユーザービュー

**説明**: サービス提供者側専用のテナント横断ユーザー一覧ビュー。

**対象**: サービス提供者（system テナント）管理者のみアクセス可能

**カラム**:
| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | TEXT | ユーザーID |
| `tenant_id` | TEXT | テナントID |
| `tenant_name` | TEXT | テナント名 |
| `email` | TEXT | メールアドレス |
| `display_name` | TEXT | 表示名 |
| `status` | TEXT | ステータス |
| `last_login_at` | DATETIME | 最終ログイン日時 |
| `roles` | TEXT | ロール一覧（カンマ区切り） |
| `created_at` | DATETIME | 作成日時 |

**SQL定義**:
```sql
CREATE VIEW IF NOT EXISTS cross_tenant_users AS
SELECT 
  u.id,
  u.tenant_id,
  t.name as tenant_name,
  u.email,
  u.display_name,
  u.status,
  u.last_login_at,
  GROUP_CONCAT(r.display_name, ', ') as roles,
  u.created_at
FROM users u
JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE t.id NOT IN ('system', 'role-template')
GROUP BY u.id, u.tenant_id, t.name, u.email, u.display_name, u.status, u.last_login_at, u.created_at;
```

---

## 4. データモデル図

### 4.1 マルチテナント・組織階層

```
┌─────────────────┐
│    tenants      │ 1:N ┌─────────────────────┐
│  (企業マスタ)   │─────│ organization_units  │
│                 │     │  (組織単位・部門)   │
│ - id (PK)       │     │                     │
│ - subdomain     │     │ - id (PK)           │
│ - name          │     │ - tenant_id (FK)    │
│ - plan_id       │     │ - parent_id (FK)    │
│ - status        │     │ - name              │
└─────────────────┘     │ - type              │
                        └─────────────────────┘
         │ 1:N                    │ 1:N
         └────────────┬───────────┘
                      ↓
         ┌─────────────────────┐
         │       users         │
         │   (ユーザー)        │
         │                     │
         │ - id (PK)           │
         │ - tenant_id (FK)    │
         │ - email             │
         │ - password_hash     │
         │ - organization_     │
         │   unit_id (FK)      │
         └─────────────────────┘
```

### 4.2 権限管理・RBAC

```
┌─────────────────────┐
│       users         │
└─────────────────────┘
         │ N:M
         ↓
┌─────────────────────┐       ┌─────────────────────┐
│    user_roles       │ N:1   │       roles         │
│  (ユーザー・ロール) │───────│   (ロール定義)      │
│                     │       │                     │
│ - id (PK)           │       │ - id (PK)           │
│ - user_id (FK)      │       │ - tenant_id (FK)    │
│ - role_id (FK)      │       │ - name              │
│ - scope_type        │       │ - display_name      │
│ - scope_id          │       │ - permissions (JSON)│
└─────────────────────┘       └─────────────────────┘
                                       │
                                       │ 関連
                                       ↓
                              ┌─────────────────────┐
                              │ permission_scopes   │
                              │  (権限スコープ)     │
                              │                     │
                              │ - id (PK)           │
                              │ - scope_type        │
                              │ - scope_id          │
                              │ - permission        │
                              │ - resource_type     │
                              └─────────────────────┘
```

### 4.3 認証・セキュリティ

```
┌─────────────────────┐
│       users         │
└─────────────────────┘
         │ 1:N
         ├─────────────────────────────────┐
         │                                 │
         ↓                                 ↓
┌─────────────────────┐       ┌─────────────────────┐
│     sessions        │       │  two_factor_secrets │
│  (アクティブセッション)│       │   (2FAシークレット)  │
└─────────────────────┘       └─────────────────────┘
         │ 1:1                              │ 1:N
         ↓                                  ↓
┌─────────────────────────┐   ┌─────────────────────┐
│ session_two_factor_     │   │  backup_codes       │
│ verification            │   │  (バックアップコード)│
│ (2FA検証状態)           │   └─────────────────────┘
└─────────────────────────┘

┌─────────────────────┐
│   failed_logins     │
│ (失敗ログイン記録)  │
└─────────────────────┘

┌─────────────────────┐
│ account_lockouts    │
│ (アカウントロック)  │
└─────────────────────┘
```

### 4.4 CLO機能・データ分析

```
┌─────────────────────┐
│   data_uploads      │
│  (データアップロード)│
│                     │
│ - id (PK)           │
│ - tenant_id (FK)    │
│ - user_id (FK)      │
│ - file_name         │
│ - status            │
└─────────────────────┘
         │ 1:N
         ├──────────────┬─────────────┐
         ↓              ↓             ↓
┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│ ai_analysis_     │  │   chat_history      │  │     reports      │
│ results          │  │  (AIチャット履歴)   │  │  (レポート管理)  │
│ (AI分析結果)     │  └─────────────────────┘  └──────────────────┘
└──────────────────┘                                    │ 1:N
                                                        ↓
                                             ┌─────────────────────┐
                                             │ report_deliveries   │
                                             │  (レポート配信記録) │
                                             └─────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│ mapping_templates   │ 1:N   │  template_fields    │
│ (マッピングテンプレート)│───│  (フィールド定義)   │
└─────────────────────┘       └─────────────────────┘
```

---

## 5. インデックス一覧

### 5.1 パフォーマンス最適化インデックス

| テーブル | インデックス名 | カラム | 目的 |
|---------|---------------|--------|------|
| `tenants` | `idx_tenants_subdomain` | `subdomain` | サブドメイン検索（ログイン時） |
| `tenants` | `idx_tenants_plan_id` | `plan_id` | プラン別集計 |
| `tenants` | `idx_tenants_status` | `status` | アクティブテナント検索 |
| `users` | `idx_users_tenant_id` | `tenant_id` | テナント単位ユーザー一覧 |
| `users` | `idx_users_email` | `email` | メールアドレス検索（ログイン時） |
| `users` | `idx_users_status` | `status` | アクティブユーザー検索 |
| `users` | `idx_users_organization_unit_id` | `organization_unit_id` | 組織単位別ユーザー一覧 |
| `organization_units` | `idx_organization_units_tenant_id` | `tenant_id` | テナント単位組織一覧 |
| `organization_units` | `idx_organization_units_parent_id` | `parent_id` | 階層構造検索 |
| `organization_units` | `idx_organization_units_type` | `type` | 組織タイプ別検索 |
| `roles` | `idx_roles_tenant_id` | `tenant_id` | テナント単位ロール一覧 |
| `roles` | `idx_roles_name` | `name` | ロール名検索 |
| `user_roles` | `idx_user_roles_user_id` | `user_id` | ユーザーのロール一覧 |
| `user_roles` | `idx_user_roles_role_id` | `role_id` | ロールの割り当てユーザー一覧 |
| `sessions` | `idx_sessions_user_id` | `user_id` | ユーザーのセッション一覧 |
| `sessions` | `idx_sessions_token` | `token` | トークン検証（高速化） |
| `sessions` | `idx_sessions_expires_at` | `expires_at` | 期限切れセッション削除 |
| `failed_logins` | `idx_failed_logins_email` | `email` | メールアドレス別失敗ログ |
| `failed_logins` | `idx_failed_logins_ip_address` | `ip_address` | IP別失敗ログ（攻撃検出） |
| `failed_logins` | `idx_failed_logins_created_at` | `created_at` | 時系列分析 |
| `audit_logs` | `idx_audit_logs_tenant_id` | `tenant_id` | テナント単位監査ログ |
| `audit_logs` | `idx_audit_logs_user_id` | `user_id` | ユーザー単位操作履歴 |
| `audit_logs` | `idx_audit_logs_action` | `action` | アクション別集計 |
| `audit_logs` | `idx_audit_logs_created_at` | `created_at` | 時系列分析 |
| `data_uploads` | `idx_data_uploads_tenant_id` | `tenant_id` | テナント単位アップロード一覧 |
| `data_uploads` | `idx_data_uploads_user_id` | `user_id` | ユーザー単位アップロード履歴 |
| `data_uploads` | `idx_data_uploads_status` | `status` | ステータス別検索 |
| `permission_scopes` | `idx_permission_scopes_scope` | `scope_type, scope_id` | スコープ別権限検索 |
| `permission_scopes` | `idx_permission_scopes_permission` | `permission` | 権限名検索 |

**合計**: 約70個のインデックス

---

## 6. トリガー一覧

### 6.1 自動クリーンアップトリガー

| トリガー名 | 対象テーブル | 実行タイミング | 目的 |
|-----------|------------|--------------|------|
| `cleanup_expired_session_2fa` | `session_two_factor_verification` | AFTER INSERT | 期限切れ2FA検証レコード自動削除 |
| `cleanup_expired_sms_codes` | `sms_verification_codes` | AFTER INSERT | 期限切れSMS認証コード自動削除 |

**トリガー定義例**:
```sql
CREATE TRIGGER IF NOT EXISTS cleanup_expired_session_2fa
AFTER INSERT ON session_two_factor_verification
BEGIN
  DELETE FROM session_two_factor_verification 
  WHERE expires_at < datetime('now');
END;
```

---

## 7. マイグレーション履歴

| # | ファイル名 | 実施日 | 説明 |
|---|-----------|-------|------|
| 0001 | `0001_initial_schema.sql` | 初回 | 基本14テーブル作成（テナント・ユーザー・認証・セキュリティ） |
| 0002 | `0002_add_license_fields.sql` | - | ライセンス管理カラム追加（`max_users`, `license_type`, `license_expires_at`） |
| 0002 | `0002_add_plan_dates.sql` | - | プラン管理カラム追加（`plan_started_at`, `plan_expires_at`） |
| 0003 | `0003_add_audit_details.sql` | - | 監査ログ詳細カラム追加（`details`） |
| 0005 | `0005_service_provider_enhancement_fixed.sql` | - | サービス提供者機能強化（6ロール追加、権限スコープ、テナント管理ログ） |
| 0009 | `0009_add_department_manager_role.sql` | - | 部門管理者ロール追加 |
| 0010 | `0010_data_upload_tables.sql` | - | CLO機能7テーブル追加（データアップロード・AI分析・レポート） |
| 0011 | `0011_two_factor_auth.sql` | - | 2要素認証5テーブル追加（TOTP・SMS・バックアップコード） |
| 0012 | `0012_update_service_provider_domain.sql` | 最新 | サービス提供者ドメイン変更（pal-style.co.jp） |

---

## 8. 付録

### 8.1 データ保持ポリシー

| テーブル | 保持期間 | 削除方法 |
|---------|---------|---------|
| `sessions` | 24時間（アイドル）、7日（最大） | 自動削除（有効期限） |
| `password_resets` | 1時間 | 自動削除（使用後） |
| `failed_logins` | 90日 | バッチ削除推奨 |
| `audit_logs` | 1年 | アーカイブ推奨 |
| `two_factor_auth_logs` | 1年 | アーカイブ推奨 |
| `sms_verification_codes` | 10分 | トリガー自動削除 |
| `session_two_factor_verification` | 1時間 | トリガー自動削除 |

### 8.2 セキュリティ推奨事項

1. **パスワードハッシュ**: bcrypt（コスト係数12以上）
2. **トークン生成**: UUID v4またはcrypto.randomBytes(32)
3. **セッション有効期限**: アイドル24時間、最大7日
4. **ログイン試行回数制限**: 5回失敗で15分ロック
5. **2FA推奨対象**: 管理者・経理担当者は必須
6. **IP制限**: サービス提供者アカウントは必須設定

### 8.3 バックアップ推奨設定

- **自動バックアップ**: 1日1回（深夜3時）
- **保持期間**: 30日間
- **PITR (Point-in-Time Recovery)**: 対応推奨
- **バックアップ対象**: 全テーブル（ビュー除く）
- **検証**: 週1回リストアテスト実施

### 8.4 パフォーマンス目標

| メトリクス | 目標値 |
|-----------|--------|
| ログイン応答時間 | < 500ms |
| データアップロード処理時間 | < 10秒（1MB） |
| レポート生成時間 | < 30秒 |
| 監査ログ検索 | < 1秒（直近30日） |
| テナント一覧表示 | < 200ms |

---

**END OF DATABASE SPECIFICATION**
