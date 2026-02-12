-- Campaign logs schema for tracking campaign changes
-- Usage:
--   psql "$DATABASE_URL" -f sql/campaign_logs_schema.sql

create table if not exists campaign_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  school_id text not null,
  action text not null, -- 'detected', 'approved', 'rejected', 'updated'
  
  -- Change tracking
  old_campaign_data jsonb,
  new_campaign_data jsonb,
  
  -- Approval tracking
  slack_message_ts text,
  approved_by text,
  approved_at timestamptz,
  
  -- Metadata
  source_url text,
  notes text
);

-- Indexes for efficient querying
create index if not exists campaign_logs_school_id_idx on campaign_logs (school_id, created_at desc);
create index if not exists campaign_logs_created_at_idx on campaign_logs (created_at desc);
create index if not exists campaign_logs_action_idx on campaign_logs (action, created_at desc);

-- Add columns if they don't exist (for schema updates)
alter table campaign_logs add column if not exists slack_message_ts text;
alter table campaign_logs add column if not exists approved_by text;
alter table campaign_logs add column if not exists approved_at timestamptz;
alter table campaign_logs add column if not exists source_url text;
alter table campaign_logs add column if not exists notes text;
