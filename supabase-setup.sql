create table public.planner_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start timestamptz not null,
  end timestamptz not null,
  user_role text not null check (user_role in ('me', 'her')),
  created_at timestamptz not null default now()
);

alter table public.planner_events enable row level security;

create policy "Users can read events" on public.planner_events
for select using (true);

create policy "Users can insert events" on public.planner_events
for insert with check (true);

create policy "Users can update events" on public.planner_events
for update using (true) with check (true);

create policy "Users can delete events" on public.planner_events
for delete using (true);
