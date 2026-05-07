-- ================================================
-- Space LOFI DB Schema
-- Supabase SQL Editor에서 전체 실행
-- ================================================

-- 1. 유저 프로필
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  total_listen_seconds integer default 0,
  level integer default 1,
  created_at timestamptz default now()
);

-- 2. 스킨 마스터
create table if not exists skins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('body', 'engine', 'color')),
  unlock_seconds_required integer not null,
  asset_key text not null,
  preview_url text
);

-- 3. 유저 보유 스킨
create table if not exists user_skins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  skin_id uuid references skins(id),
  unlocked_at timestamptz default now(),
  unique(user_id, skin_id)
);

-- 4. LOFI 트랙
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  duration_seconds integer not null,
  mood text check (mood in ('chill', 'deep', 'cosmic'))
);

-- 5. 청취 기록
create table if not exists listen_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  track_id uuid references tracks(id),
  listened_at timestamptz default now(),
  duration_seconds integer not null
);

-- ================================================
-- Google 로그인 시 profiles 자동 생성 trigger
-- ================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================
-- RLS (Row Level Security) 설정
-- ================================================
alter table profiles enable row level security;
alter table user_skins enable row level security;
alter table listen_logs enable row level security;
alter table skins enable row level security;
alter table tracks enable row level security;

-- profiles: 본인 데이터만 읽기/수정
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- user_skins: 본인 데이터만 읽기
create policy "user_skins_select_own" on user_skins for select using (auth.uid() = user_id);

-- listen_logs: 본인 데이터만 삽입/읽기
create policy "listen_logs_select_own" on listen_logs for select using (auth.uid() = user_id);
create policy "listen_logs_insert_own" on listen_logs for insert with check (auth.uid() = user_id);

-- skins, tracks: 모든 로그인 유저가 읽기 가능
create policy "skins_select_all" on skins for select using (auth.role() = 'authenticated');
create policy "tracks_select_all" on tracks for select using (auth.role() = 'authenticated');
