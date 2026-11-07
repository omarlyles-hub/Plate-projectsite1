-- Plate: initial schema. Every row belongs to one auth user and is protected by row-level security.
-- Photo thumbnails are NOT stored here; they stay on the user's device.

create table public.venues (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  map_item_id text,
  neighborhood text not null default '',
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date timestamptz not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  photo_ids text[] not null default '{}',
  rating text not null check (rating in ('loved', 'good', 'meh')),
  note text not null default '',
  companions text,
  price_feel smallint check (price_feel between 1 and 4),
  created_at timestamptz not null default now()
);

create table public.dishes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  name text not null,
  order_again boolean not null default false
);

-- Persisted triage queue (clustered meals awaiting review).
create table public.meal_candidates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  photo_ids text[] not null default '{}',
  candidates jsonb not null default '[]',
  status text not null default 'pending'
    check (status in ('pending', 'skipped', 'dismissed', 'confirmed'))
);

create index meals_user_date_idx on public.meals (user_id, date desc);
create index meals_venue_idx on public.meals (venue_id);
create index dishes_meal_idx on public.dishes (meal_id);
create index venues_user_idx on public.venues (user_id);
create index meal_candidates_user_status_idx on public.meal_candidates (user_id, status);

alter table public.venues enable row level security;
alter table public.meals enable row level security;
alter table public.dishes enable row level security;
alter table public.meal_candidates enable row level security;

-- Owner-only access. Signed-out (anon role) requests get nothing.
create policy "venues owner all" on public.venues
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "meals owner all" on public.meals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "dishes owner all" on public.dishes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "meal_candidates owner all" on public.meal_candidates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
