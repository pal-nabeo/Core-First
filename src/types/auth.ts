// PAL物流SaaS 認証システム 型定義

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain_allowlist?: string[];
  plan_id: string;
  status: 'active' | 'disabled' | 'trial_expired';
  company_type?: string;
  company_size?: string;
  trial_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  status: 'active' | 'disabled' | 'frozen' | 'trial_expired';
  last_login_at?: string;
  last_login_ip?: string;
  phone_number?: string;
  locale: string;
  timezone: string;
  failed_login_count: number;
  locked_until?: string;
  email_verified: boolean;
  two_fa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  organization_unit_id?: string;
  scope: 'tenant' | 'organization_unit';
  assigned_by?: string;
  assigned_at: string;
  expires_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  tenant_id: string;
  session_token: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  is_remember_me: boolean;
  last_activity_at: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
  tenant_subdomain?: string;
}

export interface LoginResponse {
  success: boolean;
  session_token?: string;
  user?: Omit<User, 'hashed_password'>;
  tenant?: Tenant;
  roles?: Role[];
  redirect_url?: string;
  error?: string;
  requires_2fa?: boolean;
  two_fa_methods?: string[];
}

export interface PasswordResetRequest {
  email: string;
  tenant_subdomain?: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface Invitation {
  id: string;
  tenant_id: string;
  inviter_id: string;
  email: string;
  role_id: string;
  organization_unit_id?: string;
  token: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  invitation_message?: string;
  created_at: string;
}

export interface InviteUserRequest {
  email: string;
  role_id: string;
  organization_unit_id?: string;
  invitation_message?: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_user_id?: string;
  action_type: string;
  target_type: string;
  target_id: string;
  ip_address?: string;
  user_agent?: string;
  result: 'success' | 'failure' | 'error';
  error_message?: string;
  created_at: string;
}

export interface AuthContext {
  user: User;
  tenant: Tenant;
  roles: Role[];
  session: Session;
}

// Cloudflare Workers環境の型定義
export interface CloudflareBindings {
  DB: D1Database;
  KV?: KVNamespace;
  R2?: R2Bucket;
}