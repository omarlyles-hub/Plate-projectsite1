-- Photos without GPS are now accepted, so a venue typed by hand (and its review card)
-- can have no coordinates.
alter table public.venues alter column latitude drop not null;
alter table public.venues alter column longitude drop not null;
alter table public.meal_candidates alter column latitude drop not null;
alter table public.meal_candidates alter column longitude drop not null;
