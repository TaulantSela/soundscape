-- Sounds people upload to their own account. Files live in the private Blob
-- store under users/<user_id>/<id>.<ext>; only their owner can read them.
create table if not exists user_sounds (
  id uuid primary key,
  user_id uuid not null references neon_auth."user" (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  pathname text not null unique,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  -- 'pending' from the moment an upload URL is issued until the file is
  -- confirmed in Blob. Pending rows reserve quota for a short while only.
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now()
);

create index if not exists user_sounds_user_id_created_at_idx on user_sounds (user_id, created_at);
