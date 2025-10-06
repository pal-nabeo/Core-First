-- Add details column to audit_logs table for enhanced plan change tracking
ALTER TABLE audit_logs ADD COLUMN details TEXT;