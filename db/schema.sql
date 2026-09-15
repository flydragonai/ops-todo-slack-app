create extension if not exists pgcrypto;

-- Prefixed with ops_ to avoid colliding with an existing `tasks` table in a shared database.
create table ops_tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,

  source_channel_id     text not null,
  source_message_ts     text,
  source_thread_ts      text,
  source_permalink      text,
  source_author_user_id text,
  requester_user_id     text not null,
  created_via           text not null default 'slash_command'
                          check (created_via in ('slash_command','message_shortcut','manual')),

  assignee_user_id      text,
  priority              text not null default 'medium'
                          check (priority in ('urgent','high','medium','low')),
  status                text not null default 'open'
                          check (status in ('open','in_progress','done','archived')),
  due_date              date,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index idx_ops_tasks_status   on ops_tasks(status);
create index idx_ops_tasks_priority on ops_tasks(priority);
create index idx_ops_tasks_assignee on ops_tasks(assignee_user_id);

-- tracks the single pinned "live list" message so it can be updated in place
create table ops_app_state (
  key         text primary key,   -- 'pinned_list'
  channel_id  text,
  message_ts  text,
  updated_at  timestamptz not null default now()
);
