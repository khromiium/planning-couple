# Nous deux — planning partagé

Ce projet est prêt pour un déploiement en ligne avec un accès réservé à deux comptes.

## Comptes autorisés

- jorick.lerissel@outlook.com
- pontonnier.manon@gmail.com

## Déploiement

1. Crée un projet Supabase.
2. Ouvre le dashboard Supabase puis crée une table `planner_events` avec cette structure :

```sql
create table public.planner_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start timestamptz not null,
  end timestamptz not null,
  user_role text not null check (user_role in ('me', 'her')),
  created_at timestamptz not null default now()
);

alter table public.planner_events enable row level security;

create policy "Users can read own events" on public.planner_events
  for select using (true);

create policy "Users can insert own events" on public.planner_events
  for insert with check (true);

create policy "Users can update own events" on public.planner_events
  for update using (true) with check (true);

create policy "Users can delete own events" on public.planner_events
  for delete using (true);
```

3. Crée les utilisateurs dans l’onglet "Authentication" de Supabase avec les deux emails ci-dessus.
4. Ouvre `config.js` et remplace les valeurs par ton URL Supabase et ta clé anon.
5. Envoie le dossier sur Netlify ou Vercel.

## Infos importantes

- Toute personne n’ayant pas l’un de ces deux emails ne peut pas se connecter.
- Les événements sont stockés côté serveur et partagés entre les deux comptes.
- Le site n’est pas ouvert au public.

## Lancer localement

Ouvre simplement le fichier `index.html` dans le navigateur, ou lance un petit serveur local :

```bash
python -m http.server 8000
```

Puis ouvre : http://localhost:8000
