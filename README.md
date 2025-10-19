# Core First 統合管理システム

[![Deploy to Cloudflare Pages](https://github.com/pal-nabeo/Core-First/actions/workflows/deploy.yml/badge.svg)](https://github.com/pal-nabeo/Core-First/actions/workflows/deploy.yml)
[![Run Tests](https://github.com/pal-nabeo/Core-First/actions/workflows/test.yml/badge.svg)](https://github.com/pal-nabeo/Core-First/actions/workflows/test.yml)

効率的な統合管理で、ビジネスを加速させるCLO（Chief Logistics Officer）向けマルチテナント対応SaaSサービス

## 🚀 プロジェクトステータス（2025-10-19更新）

✅ **プロジェクト復元完了** - 前回セッションからのバックアップを正常に復元しました

### 実装状況
- ✅ **データベース**: 5つのマイグレーションを適用完了（20テーブル作成）
- ✅ **シードデータ**: テストユーザーとテナントデータを投入完了
- ✅ **静的アセット**: CSS/JSファイル（24個）を配置完了
- ✅ **サーバー起動**: PM2で開発サーバーが正常稼働中
- ⚠️ **保留中のマイグレーション**: 0006-0008（ライセンス管理、セキュリティ強化、2FA）は構文エラーのため一時的に保留

### テストアカウント
- **システム管理者（PAL Style）**: system@pal-style.co.jp / password
- **ABC物流管理者**: admin@abc-logistics.co.jp / password
- **XYZ配送管理者**: admin@xyz-delivery.co.jp / password

### 技術スタック
- **フレームワーク**: Hono v4.0.0
- **ランタイム**: Cloudflare Workers/Pages
- **データベース**: Cloudflare D1 (SQLite)
- **開発ツール**: Vite v6.3.6, Wrangler v4.42.0
- **プロセス管理**: PM2
- **CI/CD**: GitHub Actions

### デプロイメント
- **本番URL**: `https://pal-style-webapp.pages.dev` (設定後)
- **デプロイ方法**: GitHubへのpushで自動デプロイ
- **詳細手順**: [DEPLOYMENT.md](./DEPLOYMENT.md) を参照
- **セットアップガイド**: [CLOUDFLARE_SETUP_STEPS.md](./CLOUDFLARE_SETUP_STEPS.md) を参照

## プロジェクト概要

**PAL Style CLOプラットフォーム**は、物流業界のCLO（最高物流責任者）向けに設計された、マルチテナント対応統合管理システムです。企業単位での完全なデータ分離と、物流業界特化の高度な分析・管理機能を提供します。

### 主要な特徴

- 🏢 **マルチテナント対応**: 物流企業単位での完全なデータ分離
- 👑 **サービス提供者・利用者分離管理**: 要件定義書に基づく明確なロール階層
- 📊 **CLO特化ダッシュボード**: チュートリアル形式のランディングページから専門画面へのナビゲーション
- 🤖 **AI分析・チャット**: 物流データの智能分析と対話型AI支援
- 🔗 **データ連携・マッピング**: ERP・WMS・TMSシステムの統合管理
- 📈 **レポート管理**: 自動生成・カスタムレポート作成機能
- ⚡ **Cloudflare Workers**: エッジでの高速処理

## URLs

- **開発環境**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai
- **CLOダッシュボード（チュートリアル）**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/dashboard
- **メインダッシュボード**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/main-dashboard
- **AI分析・チャット**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/ai-analysis
- **データ連携・マッピング**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/data-mapping
- **データ統合管理**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/data-integration
- **レポート管理**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/report-management
- **🆕 サービス提供者統合管理**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/admin-dashboard
- **🆕 テナント管理ダッシュボード**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/tenant-dashboard
- **ログイン画面**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/login
- **API健康チェック**: https://3000-ip4hyygtw38921qnvp167-5634da27.sandbox.novita.ai/api/health

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

## 🆕 データアップロードとマッピング機能（2025-10-19新規実装）

### Core First データアップロード・マッピング・セキュリティ統合システム

**要件定義書「Core First データアップロードとマッピング機能 要件定義書」に基づく包括的な機能実装を完了**

#### ✅ 実装されたデータ管理機能

**1. データアップロードとマッピング機能**
- **ファイルアップロード**: 暗号化対応・バリデーション付きファイルアップロード
- **データマッピング**: テンプレートベースのフィールドマッピング・リアルタイム検証
- **処理結果管理**: アップロード→マッピング→処理→完了までの全工程管理
- **テナント分離**: 厳格な権限分離でテナント管理者は自テナントのみアクセス可能

**2. テンプレート管理システム**
- **テンプレート作成・管理**: フィールド定義・検証ルール・バージョン管理
- **共有制御**: テナント内共有・グローバル配布・承認ワークフロー
- **権限分離**: サービス提供者（グローバル管理）・テナント管理者（自テナント管理）
- **使用状況監視**: テンプレート利用統計・クロステナント使用分析

**3. 暗号化・キー管理システム**
- **キー生成・管理**: テナント固有暗号化キー・強度レベル選択・自動ローテーション
- **データ暗号化**: ファイルレベル・フィールドレベル暗号化・復号化API
- **キーライフサイクル**: 生成→使用→ローテーション→無効化までの完全管理
- **緊急キー無効化**: サービス提供者による緊急キー停止・影響分析

**4. AI学習データ同意管理**
- **同意ポリシー設定**: テナント単位でのAI学習同意ポリシー・用途制限
- **データセット別同意**: アップロードデータごとの同意管理・機密性レベル設定
- **プロセス監視**: AI学習プロセス開始・進捗・完了・緊急停止の管理
- **同意撤回**: データ削除・処理停止・完全監査証跡

**5. フィールドレベルアクセス制御**
- **アクセス制御ポリシー**: フィールド単位でのアクセスレベル・マスキング設定
- **データ検証システム**: リアルタイムデータ検証・自動修正・品質レポート
- **マスキングパターン**: 役割別フィールドマスキング・動的マスキング
- **異常検知**: 不正アクセスパターン・データ品質異常の自動検出

**6. クロステナント監査・通知システム**
- **監査設定**: テナント単位でのクロステナント操作監視設定
- **操作記録**: サービス提供者によるクロステナント操作の完全記録
- **異常パターン検知**: 操作頻度・時間帯・承認なし操作の異常検出
- **リアルタイム通知**: 重要度に応じた即座通知・ダイジェスト通知

**7. 緊急アクセス拡張システム**
- **データ緊急アクセス**: データ破損・暗号化問題・AI処理エラー時の緊急対応
- **多段階承認**: 重要度に応じた1名～2名承認・条件付き承認
- **時限セッション**: 緊急アクセス用時限トークン・実行ログ記録
- **即座通知**: テナント管理者への緊急アクセス開始通知

#### 📊 データアップロード・マッピングAPI エンドポイント

**データアップロード機能API**
- `POST /api/data-upload/upload` - ファイルアップロード（暗号化・検証付き）
- `GET /api/data-upload/history` - アップロード履歴（テナント分離）
- `POST /api/data-upload/mapping` - マッピング設定作成
- `POST /api/data-upload/mapping/:mapping_id/process` - データ処理実行
- `GET /api/data-upload/global/overview` - 全テナント統計（サービス提供者専用）
- `POST /api/data-upload/emergency/access` - 緊急データアクセス

**テンプレート管理API**
- `POST /api/templates/create` - テンプレート作成（テナント内）
- `GET /api/templates/list` - テンプレート一覧（共有テンプレート含む）
- `PUT /api/templates/:template_id` - テンプレート更新（所有者のみ）
- `POST /api/templates/:template_id/share-request` - 共有リクエスト作成
- `POST /api/templates/global/distribute` - グローバル配布（サービス提供者専用）
- `PUT /api/templates/share-request/:request_id/approve` - 共有承認・却下

**暗号化・キー管理API**
- `POST /api/encryption/keys/generate` - 暗号化キー生成
- `GET /api/encryption/keys/list` - キー一覧（テナント分離）
- `POST /api/encryption/keys/:key_id/rotate` - キーローテーション
- `POST /api/encryption/encrypt` - データ暗号化
- `POST /api/encryption/decrypt` - データ復号化
- `GET /api/encryption/global/key-statistics` - グローバルキー統計（サービス提供者専用）
- `POST /api/encryption/emergency/revoke-key` - 緊急キー無効化

**AI学習データ同意管理API**
- `POST /api/ai-consent/consent-policy` - AI同意ポリシー設定
- `POST /api/ai-consent/dataset-consent` - データセット別同意設定
- `GET /api/ai-consent/consent-status` - 同意状況一覧
- `POST /api/ai-consent/revoke-consent/:consent_id` - 同意撤回
- `POST /api/ai-consent/ai-process/start` - AI学習プロセス開始通知
- `POST /api/ai-consent/ai-process/:process_id/complete` - AI学習プロセス完了通知
- `GET /api/ai-consent/global/consent-statistics` - グローバル同意統計（サービス提供者専用）
- `POST /api/ai-consent/emergency/stop-ai-process` - 緊急AI停止

**フィールドアクセス制御API**
- `POST /api/field-access/field-policy` - フィールドアクセス制御ポリシー設定
- `POST /api/field-access/validation-rules` - データ検証ルール設定
- `POST /api/field-access/data/access` - フィールドアクセス権限チェック付きデータ取得
- `POST /api/field-access/data/validate` - データ検証実行
- `PUT /api/field-access/masking-config/:policy_id` - マスキング設定更新
- `GET /api/field-access/global/field-access-stats` - グローバルフィールドアクセス統計（サービス提供者専用）

**クロステナント監査・通知API**
- `POST /api/cross-tenant-audit/audit-settings` - クロステナント監査設定
- `POST /api/cross-tenant-audit/notification-config` - 通知設定管理
- `POST /api/cross-tenant-audit/record-operation` - クロステナント操作記録
- `GET /api/cross-tenant-audit/operation-history` - 操作履歴取得
- `GET /api/cross-tenant-audit/anomaly-detection` - 異常パターン検知
- `GET /api/cross-tenant-audit/notification-history` - 通知履歴取得
- `PUT /api/cross-tenant-audit/notification/:notification_id/status` - 通知ステータス更新
- `GET /api/cross-tenant-audit/global/audit-statistics` - グローバル監査統計（サービス提供者専用）

**緊急アクセス拡張API**
- `POST /api/breakglass/data-emergency/request` - データ緊急アクセス要求
- `POST /api/breakglass/data-emergency/approve/:request_id` - 緊急承認（多段階）
- `POST /api/breakglass/data-emergency/execute` - 緊急操作実行

#### 🔒 セキュリティ・権限分離の実装

**サービス提供者権限**
- 全テナントのデータアップロード・マッピング状況監視
- グローバルテンプレート作成・配布
- 暗号化キーのグローバル管理・緊急無効化
- AI学習プロセスの緊急停止・データ削除
- クロステナント操作の完全監査・異常検知
- 緊急アクセスの承認・データ救済作業

**テナント管理者権限**
- 自テナント内データアップロード・処理管理
- 自テナント所有テンプレートの作成・編集・共有申請
- 自テナント暗号化キーの生成・管理
- 自テナントAI学習同意ポリシー・データセット同意管理
- 自テナント向けクロステナント操作監視設定
- 緊急アクセス通知の受信・対応

**完全なテナント分離**
- SQLレベルでのテナントID強制フィルタ
- APIレベルでのユーザーコンテキスト検証
- 暗号化キーのテナント分離管理
- AI同意・フィールドアクセス制御のテナント境界強制

## 🆕 ログ管理機能（2025-10-19新規実装）

### Core First ログ管理システム

**要件定義書に基づく包括的ログ管理機能を実装完了**

#### ✅ 実装されたログ管理機能

**1. 役割別ログアクセス制御**
- **サービス提供者**: 全テナント横断ログアクセス（システム・インフラ・セキュリティログ）
- **テナント管理者**: 自テナント内ログのみアクセス（ユーザー活動・ビジネス操作・監査ログ）
- **権限別フィールドマスキング**: PII情報の役割別表示制御
- **テナント分離**: SQLレベルでのデータ分離強制

**2. ログ種別対応**
- **システムログ**: インフラ・アプリケーション・システム起動ログ（サービス提供者のみ）
- **セキュリティログ**: 認証・認可・セキュリティイベント（権限に応じて両方）
- **ビジネスログ**: ユーザー活動・業務操作・データ変更（主にテナント、一部サービス提供者も参照）
- **監査ログ**: アクセス記録・コンプライアンス・データ変更履歴（両方、フィールド制限あり）

**3. 緊急アクセス（ブレイクグラス）システム**
- **要求承認フロー**: 理由記載→承認者承認→期間限定アクセストークン発行
- **承認者制限**: スーパー管理者・セキュリティ管理者・法務管理者のみ承認可能
- **完全監査**: 緊急アクセス要求・承認・使用・無効化の全工程記録
- **自動期限切れ**: 最大24時間・自動無効化・期限延長不可

**4. フィールドレベルセキュリティ**
- **PII マスキング**: メール・電話・IPアドレス・個人データの役割別マスキング
- **カスタマーサクセス**: 匿名化データのみアクセス（***MASKED***）
- **財務管理者**: 財務関連フィールドのみアクセス・他はRESTRICTED
- **緊急アクセス時**: マスキング解除（完全監査付き）

**5. 監査証跡システム**
- **アクセスログ記録**: 誰が・いつ・どのログに・なぜアクセスしたかを完全記録
- **検索履歴保存**: 検索条件・結果件数・ブレイクグラス使用の有無
- **改ざん防止**: ハッシュ値・デジタル署名・書き込み専用ストレージ対応
- **エクスポート監査**: CSV/PDF出力の完全ログ化・承認機能

#### 📊 ログ管理API エンドポイント

**ログ管理API**
- `POST /api/logs/search` - ログ検索（テナント分離・権限制御）
- `POST /api/logs/export` - ログエクスポート（非同期処理）
- `GET /api/logs/stats` - ログ統計（役割別集計）

**緊急アクセス（ブレイクグラス）API**  
- `POST /api/breakglass/request` - 緊急アクセス要求作成
- `POST /api/breakglass/approve/:requestId` - 要求承認・拒否
- `GET /api/breakglass/requests` - 要求一覧取得
- `POST /api/breakglass/revoke/:sessionToken` - セッション無効化

#### 🔒 セキュリティ実装詳細

**1. テナント分離強制**
```typescript
// 自動テナント分離
function enforceTenantseparation(query: any, userTenantId: string, userRole: string) {
  if (userRole.startsWith('system_') || userRole === 'super_admin') {
    return query; // サービス提供者は全テナント可能
  }
  return { ...query, tenant_id: userTenantId }; // テナント管理者は自テナントのみ
}
```

**2. 権限チェックマトリックス**
```typescript
const accessRules: Record<string, string[]> = {
  'system': ['system:logs:system_view'],
  'authentication': ['system:logs:view_all_tenants', 'tenant:logs:security_events'],
  'user_activity': ['system:logs:view_all_tenants', 'tenant:logs:user_activity'],
  'audit_trail': ['system:logs:audit_access', 'tenant:logs:audit_trail']
};
```

**3. ブレイクグラス承認フロー**
```sql
-- 緊急アクセス要求テーブル
CREATE TABLE breakglass_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  target_tenant_id TEXT NOT NULL, 
  reason TEXT NOT NULL, -- security_incident, system_failure, etc.
  justification TEXT NOT NULL,
  duration_hours INTEGER DEFAULT 2,
  status TEXT DEFAULT 'pending' -- pending, approved, denied, expired
);

-- 緊急アクセスセッション
CREATE TABLE breakglass_sessions (
  token TEXT PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  status TEXT DEFAULT 'approved' -- approved, used, expired, revoked
);
```

#### 🗄️ データベース構造（ログ管理）

```sql
-- ログ管理システムテーブル群
logs                         -- メインログテーブル
log_access_records           -- ログアクセス記録
breakglass_requests          -- 緊急アクセス要求  
breakglass_sessions          -- 緊急アクセスセッション
log_export_jobs             -- ログエクスポートジョブ
log_retention_policies      -- ログ保持ポリシー

-- サンプルログデータ（各種ログタイプ）
system, authentication, user_activity, audit_trail, 
security_event, business_operation, access_log, compliance
```

#### ✅ 権限拡張

**サービス提供者権限**
```typescript
// 追加されたログ管理関連権限
'system:logs:view_all_tenants',      // 全テナントログ参照
'system:logs:search_all_tenants',    // 全テナントログ検索  
'system:logs:export_all_tenants',    // 全テナントログエクスポート
'system:logs:emergency_access',      // 緊急アクセス権限
'system:logs:breakglass_approve',    // ブレイクグラス承認権限
'system:logs:audit_access',          // 監査ログアクセス
'system:logs:system_view',           // システムログ参照
'system:logs:infrastructure_view'    // インフラログ参照
```

**テナント管理者権限**
```typescript  
// テナント管理者専用ログ権限
'tenant:logs:view',                  // 自テナントログ参照
'tenant:logs:search',               // 自テナントログ検索
'tenant:logs:export',               // 自テナントログエクスポート  
'tenant:logs:user_activity',        // ユーザー活動ログ
'tenant:logs:business_operations',  // ビジネス操作ログ
'tenant:logs:security_events',      // セキュリティイベント
'tenant:logs:audit_trail'           // 監査証跡
```

## 🆕 ロール階層とアクセス分離（2025-10-18更新）

### サービス提供者側ロール（Core First運営側）

#### **スーパー管理者（Super Admin）**
- **権限範囲**: システム全体の最高権限
- **主要機能**: 
  - 全テナント管理（作成・編集・削除・停止）
  - 提供者側管理者アカウント管理
  - システム全体設定・セキュリティポリシー設定
  - 緊急対応権限（全テナント・全ユーザーへの操作）
- **承認要件**: 重要操作は2名承認必須、事後報告必須

#### **システム管理者（System Admin）**
- **権限範囲**: 技術・インフラ管理権限
- **主要機能**: 
  - システム監視・パフォーマンス管理
  - 障害対応・技術的復旧作業
  - バックアップ・復旧管理
  - セキュリティ脆弱性対応・パッチ適用
- **アクセス制限**: インフラ・技術領域のみ、顧客データへの直接アクセス不可

#### **運用管理者（Operations Admin）**
- **権限範囲**: 日常運用業務
- **主要機能**: 
  - アラート対応・ログ確認
  - ユーザーサポート・パスワードリセット支援
  - 運用レポート作成・定型作業
- **アクセス制限**: 運用業務範囲のみ、システム設定変更不可

#### **カスタマーサクセス**
- **権限範囲**: テナントサポート業務
- **主要機能**: 
  - テナント利用状況分析・健全性スコア管理
  - 問い合わせ対応・チケット管理
  - チャーン予測・予防アクション
- **アクセス制限**: サポート業務範囲、技術的操作不可

#### **経理担当者**
- **権限範囲**: 財務・経理業務
- **主要機能**: 
  - 請求管理・売上分析
  - 支払い管理・未収金追跡
  - 財務レポート作成
- **アクセス制限**: 財務データのみ、技術情報アクセス不可

#### **監査担当者**
- **権限範囲**: 監査・コンプライアンス（読み取り専用）
- **主要機能**: 
  - ログ分析・監査レポート作成
  - コンプライアンス確認
  - セキュリティ監査
- **アクセス制限**: 完全な読み取り専用、操作権限なし

### サービス利用者側ロール（テナント企業内）

#### **テナントオーナー**
- **権限範囲**: 自社テナント内の最高権限
- **主要機能**: 
  - テナント設定・請求管理
  - 自社内ユーザー管理・全機能アクセス
- **データ制限**: 自社テナント内データのみ

#### **テナント管理者**
- **権限範囲**: 自社テナント内管理権限
- **主要機能**: 
  - ユーザー管理・権限設定・部門管理
  - 業務機能アクセス
- **データ制限**: 自社テナント内データのみ

#### **一般ユーザー**
- **権限範囲**: 基本業務権限
- **主要機能**: 業務機能のみ使用可能
- **データ制限**: 許可された機能・データのみ

#### **ゲスト**
- **権限範囲**: 限定権限
- **主要機能**: 閲覧専用・一部機能のみ
- **データ制限**: 制限された範囲のみ

## CLO向けサイト構造

### 🎯 CLOダッシュボード（チュートリアル・トップページ）
メインダッシュボードとして、物流責任者向けに最適化されたチュートリアル形式のランディングページを実装。ここから各専門機能へスムーズに遷移できます。

### 🔗 特化画面へのナビゲーション
1. **📊 メインダッシュボード画面** - 総合評価ダッシュボードと利用状況ダッシュボードのタブ切り替え
2. **🤖 AI分析・チャット画面** - データ分析結果の表示と対話型AIアシスタント
3. **🔗 データ連携・マッピング画面** - ERP・WMS・TMSシステムのフィールドマッピング管理
4. **⚙️ データ連携・統合管理画面** - データフロー管理、リアルタイム監視、品質管理
5. **📋 レポート管理画面** - レポートビルダー、自動生成、出力管理

## 実装済み機能

### ✅ 完成機能

#### 🆕 管理者ダッシュボード分離設計 ✅ **新規実装完了（2025-10-18）**

##### **サービス提供者統合管理システム（/admin-dashboard）**
- ✅ **統合ダッシュボード**: 全テナントKPI、売上分析、稼働率監視
- ✅ **リアルタイム監視**: システム状況・アラート・パフォーマンス監視
- ✅ **テナント管理**: 企業管理・プラン設定・横断ユーザー管理
- ✅ **課金管理**: 売上ダッシュボード・請求管理・サブスクリプション管理
- ✅ **サポート管理**: チケット管理・カスタマーサクセス・健全性分析
- ✅ **システム管理**: システム監視・監査ログ・バックアップ管理
- ✅ **管理者管理**: 提供者側アカウント管理・権限管理

##### **テナント管理ダッシュボード（/tenant-dashboard）**
- ✅ **自社ユーザー管理**: テナント内ユーザーの作成・編集・権限設定
- ✅ **利用状況確認**: データ使用量・API利用量・制限値確認
- ✅ **権限管理**: 自社内ロール・アクセス制御管理
- ✅ **活動履歴**: 自社テナント内の操作ログ確認

##### **ロール切り替え機能**
- ✅ **提供者⇔利用者画面切り替え**: 権限に応じた画面間移動
- ✅ **権限別アクセス制御**: ロールベースの機能制限
- ✅ **データアクセス分離**: 提供者側（全テナント横断）vs 利用者側（自社のみ）

#### CLO向けサイト構造 ✅ **実装完了**
- ✅ チュートリアル・トップページ（/dashboard）
- ✅ メインダッシュボード（/main-dashboard）- KPI表示、チャート分析、AI推奨事項
- ✅ AI分析・チャット（/ai-analysis）- データ分析、予測分析、対話型AIチャット
- ✅ データマッピング（/data-mapping）- フィールドマッピング、変換ルール、プレビュー機能
- ✅ データ統合管理（/data-integration）- フロー管理、リアルタイム監視、データ品質
- ✅ レポート管理（/report-management）- レポートビルダー、自動レポート設定、エクスポート

#### 認証・ログイン機能 ✅ **修正完了**
- ✅ マルチテナント対応ログイン画面
- ✅ CLOユーザー向けプロフィール管理
- ✅ 管理者ダッシュボードへのアクセス制御
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

#### 管理機能詳細実装
- 🚧 テナント管理CRUD操作の詳細機能
- 🚧 横断ユーザー管理の検索・フィルタリング
- 🚧 リアルタイム監視の詳細メトリクス
- 🚧 売上ダッシュボードのチャート実装
- 🚧 サポートチケット管理の詳細機能
- 🚧 システム監視の詳細アラート機能

#### 外部連携
- 🚧 SSO対応（Google/Microsoft）
- 🚧 API キー管理
- 🚧 Webhook機能

## 🆕 管理画面機能マップ（2025-10-18更新）

### サービス提供者統合管理システム機能一覧

#### **統合管理セクション**
- **統合ダッシュボード**: 全テナントKPI・売上・稼働率
- **リアルタイム監視**: システム状況・アラート・パフォーマンス

#### **テナント管理セクション**
- **テナント管理**: 企業管理・プラン設定
- **横断ユーザー管理**: 全テナント検索・緊急操作
- **利用分析**: テナント別利用状況・傾向分析

#### **課金管理セクション**
- **売上ダッシュボード**: 売上分析・予測
- **請求管理**: 一括発行・支払い状況
- **サブスクリプション管理**: プラン変更・キャンセル

#### **サポートセクション**
- **サポートチケット**: 問い合わせ管理
- **カスタマーサクセス**: 健全性・チャーン予測

#### **システム管理セクション**
- **システム監視**: パフォーマンス・障害監視
- **監査ログ**: セキュリティ・コンプライアンス
- **バックアップ管理**: データ保護・復旧

#### **管理者管理セクション**
- **管理者管理**: 提供者側管理者アカウント
- **権限管理**: ロール・アクセス制御

### テナント管理ダッシュボード機能一覧

#### **自社管理機能**
- **ユーザー管理**: 自社内ユーザーの作成・編集・削除
- **権限管理**: 自社内ロール・権限設定
- **利用状況**: 自社のデータ使用量・API利用量確認

#### **セルフサービス機能**
- **プロフィール管理**: 企業情報・設定変更
- **プラン管理**: 現在プラン・使用量確認
- **請求情報**: 自社の請求情報・支払い履歴

## 技術スタック

### フロントエンド
- **フレームワーク**: Pure HTML/CSS/JavaScript
- **UIライブラリ**: TailwindCSS
- **アイコン**: FontAwesome
- **チャートライブラリ**: Chart.js
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
│       ├── login.js               # ログイン画面JavaScript
│       ├── login.css              # ログイン画面CSS
│       ├── admin-provider-dashboard.js    # 🆕 サービス提供者管理画面
│       ├── admin-provider-dashboard.css   # 🆕 サービス提供者管理画面CSS
│       └── admin.js               # 管理画面JavaScript
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

#### フェーズ2: 管理機能の詳細実装
- [ ] テナント管理CRUD操作の詳細機能
- [ ] 横断ユーザー管理の検索・フィルタリング詳細実装
- [ ] リアルタイム監視の詳細メトリクス・グラフ
- [ ] 売上ダッシュボードの詳細チャート実装
- [ ] サポートチケット管理の詳細ワークフロー

#### フェーズ3: 認証・セキュリティ強化
- [ ] 2要素認証（SMS/TOTP）実装
- [ ] SSO連携（Google/Microsoft）
- [ ] IP制限・地理的制限
- [ ] アカウントロック機能の完成

#### フェーズ4: 高度機能・外部連携
- [ ] APIキー管理
- [ ] Webhook機能
- [ ] 料金・課金システム
- [ ] 詳細分析・レポート

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## サポート

- **開発者**: PAL Style開発チーム
- **Email**: support@pal-style.co.jp
- **Documentation**: このREADME
- **Issues**: GitHub Issues

## 🎉 最新更新履歴

### 2025-10-18: ライセンス管理・ログイン管理要件対応完了 🆕

#### ✅ ライセンス管理システム実装完了
**包括的ライセンス管理機能**
- ✅ テナントライセンステーブル - プラン型・ステータス・自動更新管理
- ✅ プラン制限定義システム - Free/Standard/Plus/Pro/Enterpriseプラン対応
- ✅ 使用量メトリクス追跡 - API呼び出し・ストレージ・ユーザー数の自動集計
- ✅ 請求履歴管理 - Stripe連携対応・税計算・割引適用
- ✅ 使用量アラート機能 - 70%/85%/95%/100%での多段階通知
- ✅ 支払い方法管理 - 複数決済手段・デフォルト設定

**リアルタイムライセンス制限機能**
- ✅ ライセンスチェックミドルウェア - 全API呼び出しでのリアルタイム制限確認
- ✅ API呼び出しクォータ制限 - 月単位での自動制限・警告レベル計算
- ✅ 機能別アクセス制御 - プランに応じた機能制限・エラーレスポンス
- ✅ 使用量自動記録 - 月次集計・期間管理・アトミック更新

**ライセンス管理API**
- ✅ `GET /api/license-management/plans` - 利用可能プラン一覧
- ✅ `GET /api/license-management/v1/license/check` - ライセンス状態確認
- ✅ `POST /api/license-management/v1/usage/record` - 使用量記録
- ✅ `GET /api/license-management/tenant/current` - テナントライセンス情報
- ✅ `POST /api/license-management/tenant/upgrade-request` - プランアップグレード申請
- ✅ `GET /api/license-management/usage/stats` - 使用量統計

#### ✅ セキュリティ強化・ログイン管理実装完了
**パスワードセキュリティ強化**
- ✅ パスワード履歴管理 - 過去12回の履歴保存・重複チェック
- ✅ テナント別パスワードポリシー - プランに応じた要件設定
- ✅ 共通パスワード禁止リスト - 危険なパスワードの防止
- ✅ パスワード強度スコア計算 - 文字種別・複雑性の評価
- ✅ パスワード期限管理 - 90日期限・事前通知

**2要素認証（2FA）システム【完全有効化完了】**
- ✅ TOTP認証機能 - Google Authenticator対応・QRコード生成
- ✅ SMS認証機能（Pro以上） - 電話番号認証・コード送信
- ✅ バックアップコード機能 - 8個の緊急コード・使い捨て管理
- ✅ セッション2FA確認 - 高権限操作時の再認証要求
- ✅ 2FA管理API完備 - 有効化・無効化・状態確認
- ✅ 2FAミドルウェア有効化 - 高権限機能への自動チェック（2025-10-18追加）

**高度セキュリティ機能**
- ✅ セキュリティイベント監視 - 不正アクセス・ブルートフォース検知
- ✅ API キー管理システム - レート制限・権限設定・使用量追跡
- ✅ セッション詳細管理 - デバイス情報・リスクスコア・地理的情報
- ✅ 地理的制限機能（Pro以上） - 国別・IP範囲でのアクセス制御
- ✅ 緊急アクセス履歴 - サービス提供者による緊急操作の完全監査

**SSO（Single Sign-On）基盤**
- ✅ 複数プロバイダ対応 - Google/Azure/Okta/SAML
- ✅ 属性マッピング機能 - 外部認証情報の自動取得
- ✅ ドメイン制限 - 企業ドメインでの認証制限
- ✅ 自動プロビジョニング - ユーザーの自動作成・ロール割当

#### ✅ サービス提供者・テナント権限分離完全実装
**厳格な権限分離システム**
- ✅ サービス提供者専用権限定義 - システム横断・テナント管理・緊急アクセス権限
- ✅ テナント管理者権限制限 - 自テナント内のみの操作権限
- ✅ 権限チェックミドルウェア - パス別・メソッド別の細かい権限制御
- ✅ クロステナントアクセス監査 - サービス提供者による他テナント操作の完全ログ

**高権限機能の2FA必須化**
- ✅ サービス提供者機能 - 管理者ダッシュボード・緊急操作の2FA必須
- ✅ 重要操作の再認証 - ユーザー削除・ライセンス変更時の追加認証
- ✅ セッション管理強化 - 権限レベル別のセッション有効期限

#### 🗄️ データベース構造拡張
```sql
-- ライセンス管理テーブル群
tenant_licenses           -- テナント別ライセンス情報
plan_limits              -- プラン別制限定義  
usage_metrics            -- 使用量メトリクス
billing_history          -- 請求履歴
usage_alerts             -- 使用量アラート
payment_methods          -- 支払い方法
license_check_logs       -- ライセンスチェックログ
plan_change_history      -- プラン変更履歴

-- セキュリティ強化テーブル群
password_history         -- パスワード履歴
password_policies        -- パスワードポリシー
sso_configurations       -- SSO設定
security_events          -- セキュリティイベント
api_keys                 -- API キー管理
session_details          -- セッション詳細
geo_restrictions         -- 地理的制限
emergency_access_logs    -- 緊急アクセス履歴

-- 2要素認証テーブル群
two_factor_secrets       -- 2FA秘密鍵・設定
session_two_factor_verification  -- セッション2FA確認
two_factor_auth_logs     -- 2FA操作ログ
sms_verification_codes   -- SMS認証コード
```

#### 🔧 実装されたミドルウェア【完全有効化】
- ✅ `licenseCheckMiddleware` - APIクォータ・機能制限の自動チェック
- ✅ `roleSeparationMiddleware` - サービス提供者・テナント権限分離
- ✅ `requireTwoFactorAuth` - 高権限機能の2FA強制【有効化完了】
- ✅ パスワードポリシー検証 - 強度チェック・履歴確認・期限管理

#### ✅ 完全対応項目リスト
1. ✅ **ライセンス管理システム** - プラン管理・使用量追跡・制限機能
2. ✅ **リアルタイム制限機能** - API・機能・容量の動的制限
3. ✅ **包括的セキュリティ機能** - パスワード・2FA・監視・制限
4. ✅ **サービス提供者権限分離** - 厳格な権限管理・監査機能
5. ✅ **使用量監視・アラート** - 多段階警告・自動通知システム
6. ✅ **請求・課金基盤** - Stripe連携・履歴管理・支払い方法管理
7. ✅ **監査・コンプライアンス** - 全操作ログ・セキュリティイベント記録

**対応要件**: ライセンス管理機能・ログイン管理機能 要件定義書準拠

### 2025-10-19: ログ管理機能 要件定義書対応完了 🆕

#### ✅ Core First ログ管理システム実装完了

**包括的ログ管理機能**
- ✅ 役割別アクセス制御 - サービス提供者（全テナント）vs テナント管理者（自テナントのみ）
- ✅ ログ種別管理システム - システム・セキュリティ・ビジネス・監査ログの完全分類
- ✅ フィールドレベルマスキング - PII情報の役割別表示制御・匿名化機能
- ✅ テナント分離強制 - SQLレベルでの自動テナント分離・クロステナント防止
- ✅ 監査証跡システム - 全ログアクセスの記録・検索履歴保存・改ざん防止

**緊急アクセス（ブレイクグラス）システム**
- ✅ 要求承認フロー - 理由記載→多段階承認→期間限定トークン発行
- ✅ 承認者権限制御 - スーパー管理者・セキュリティ・法務管理者のみ承認可能
- ✅ JIT（Just-In-Time）アクセス - 最大24時間期限・自動無効化・セッション管理
- ✅ 完全監査機能 - 緊急要求・承認・使用・無効化の全工程記録・アラート送信

**セキュリティ強化機能**
- ✅ 権限マトリックス - ログ種別×ロール別のアクセス制御マトリックス
- ✅ 自動ログアクセス記録 - 誰が・いつ・どのログに・なぜアクセスしたかの完全記録
- ✅ エクスポート管理 - CSV/PDF出力の承認制・ダウンロード履歴・期限管理
- ✅ 多層防御設計 - RLS・APIレベル検証・セッション検証・ポリシーエンジン

**ログ管理API実装**
- ✅ `POST /api/logs/search` - 高度検索・テナント分離・権限制御・マスキング
- ✅ `POST /api/logs/export` - 非同期エクスポート・ジョブ管理・承認機能
- ✅ `GET /api/logs/stats` - 統計分析・ダッシュボード・傾向分析
- ✅ `POST /api/breakglass/request` - 緊急アクセス要求・承認フロー
- ✅ `POST /api/breakglass/approve/:requestId` - 承認・拒否・理由記録
- ✅ `POST /api/breakglass/revoke/:sessionToken` - セッション無効化・監査

**データベース拡張**
```sql
-- ログ管理システムテーブル群（新規追加）
logs                        -- メインログテーブル（改ざん防止ハッシュ付き）
log_access_records          -- ログアクセス完全監査
breakglass_requests         -- 緊急アクセス要求管理
breakglass_sessions         -- JITアクセストークン管理
log_export_jobs            -- エクスポートジョブ管理
log_retention_policies     -- ログ保持・削除ポリシー

-- サンプルデータ: 8種類のログタイプ
system, infrastructure, authentication, user_activity,
audit_trail, security_event, business_operation, compliance
```

**権限システム拡張**
- ✅ サービス提供者権限 - `system:logs:*` 全テナント横断ログ管理権限セット
- ✅ テナント管理者権限 - `tenant:logs:*` 自テナント限定ログ管理権限セット
- ✅ 緊急アクセス権限 - `system:logs:emergency_access` ブレイクグラス要求権限
- ✅ 承認者権限 - `system:logs:breakglass_approve` ブレイクグラス承認権限

**コンプライアンス対応**
- ✅ ログ保持ポリシー - GDPR・SOX・セキュリティコンプライアンス準拠
- ✅ 個人情報保護 - PII自動マスキング・匿名化・アクセス制御
- ✅ 監査要件対応 - 改ざん防止・長期保存・検索履歴・エクスポート管理
- ✅ セキュリティ監視 - クロステナントアクセス試行・不正操作の即時アラート

#### 🔧 実装されたミドルウェア・機能
- ✅ ログ検索フィルタリング - テナント分離・権限チェック・フィールドマスキング
- ✅ ブレイクグラス管理 - 要求作成・承認処理・セッション管理・監査記録
- ✅ 監査ログ自動記録 - 全ログアクセス・検索・エクスポート操作の自動記録
- ✅ PII マスキングエンジン - 役割別フィールド表示制御・段階的匿名化

#### ✅ 完全対応項目リスト
1. ✅ **サービス提供者・テナント管理者の権限分離** - 明確なアクセス範囲定義
2. ✅ **ログ管理機能における役割別アクセス制御** - 権限マトリックス実装
3. ✅ **各機能の対象範囲制御** - 全テナント対象 vs 自テナントのみの厳格分離
4. ✅ **ログの参照・操作権限の適切な分離** - 読み取り専用・エクスポート制限
5. ✅ **セキュリティ要件とアクセス制御の整合性** - 多層防御・監査証跡
6. ✅ **既存RBACシステムとの整合性** - 権限セット拡張・ポリシー連携

**対応要件**: Core First ログ管理機能 要件定義書 v2.0 準拠

### 2025-10-18: 要件定義書v2.0 対応完了

#### ✅ 実装完了項目

**1. サービス提供者・テナント管理者 完全分離**
- systemテナントの完全分離（Core First運営側専用）
- サービス提供者専用認証API（`/api/service-provider-auth`）
- テナントユーザー認証との完全分離

**2. サービス提供者ロール階層実装**
- スーパー管理者（super_admin）: 全権限・緊急対応
- システム管理者（system_admin）: インフラ・技術管理  
- 運用管理者（operation_admin）: 日常運用・サポート
- カスタマーサクセス（customer_success）: テナントサポート
- 経理担当者（finance_admin）: 請求・財務管理
- 監査担当者（auditor）: 監査・コンプライアンス

**3. 権限管理システム強化**
- 権限スコープ管理テーブル（permission_scopes）
- テナント管理ログテーブル（tenant_management_logs）  
- サービス提供者認証テーブル（service_provider_auth）
- クロステナントユーザー管理ビュー

**4. API機能拡充**
- サービス提供者ダッシュボードAPI（`/api/provider-dashboard`）
- テナント一覧・詳細管理
- クロステナントユーザー検索・管理
- セキュリティ監査レポート機能
- システム管理者アカウント管理

**5. データベース設計強化**
- テナントテンプレートシステム（role-templateテナント）
- 外部キー制約の適切な管理
- マイグレーション安全性の向上

#### 🔒 セキュリティ実装
- JWT認証による安全なサービス提供者ログイン
- 監査ログの自動記録（全操作ログ取得）
- テナント間データ完全分離の維持
- 権限ベースアクセス制御（RBAC）の厳密実装

#### 📊 実装されたAPI エンドポイント

**サービス提供者認証**
- `POST /api/service-provider-auth/login` - ログイン
- `GET /api/service-provider-auth/me` - 認証状態確認  
- `POST /api/service-provider-auth/logout` - ログアウト

**サービス提供者ダッシュボード**
- `GET /api/provider-dashboard/tenants` - テナント一覧
- `POST /api/provider-dashboard/tenants` - テナント作成
- `GET /api/provider-dashboard/users/search` - クロステナントユーザー検索
- `GET /api/provider-dashboard/security/audit` - セキュリティ監査

#### 🗄️ データベース構造更新
```sql
-- 新規追加テーブル
permission_scopes         -- 権限スコープ管理
tenant_management_logs    -- テナント操作ログ  
service_provider_auth     -- サービス提供者認証情報
cross_tenant_users        -- クロステナントユーザービュー

-- 拡張されたロール
roles テーブル: サービス提供者専用ロール追加
tenants テーブル: systemテナント情報更新
```

#### ✅ 完全対応項目リスト
1. ✅ サービス提供者とサービス利用者の明確分離
2. ✅ 独立した認証システム構築
3. ✅ ロール階層の適切な実装
4. ✅ 権限管理の粒度向上  
5. ✅ 監査機能の強化
6. ✅ クロステナント操作機能
7. ✅ セキュリティ要件の完全実装
8. ✅ API設計の要件準拠

**対応文書**: Core First アカウント管理機能 要件定義書 v2.0

---

© 2024 Core First System. All rights reserved.