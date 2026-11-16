# Supabase Cloud-Synchronisierung einrichten

Die Trail Event App speichert Daten zunächst lokal. Nach erfolgreicher Anmeldung können die in der App aufgeführten Daten in Supabase gesichert werden.

## Einmalige Einrichtung

1. Öffne dein Supabase-Projekt.
2. Öffne **SQL Editor** und erstelle eine neue Abfrage.
3. Führe dieses SQL aus:

```sql
create table if not exists public.planner_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_data enable row level security;

drop policy if exists "Users can read own planner data" on public.planner_data;
create policy "Users can read own planner data"
on public.planner_data for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own planner data" on public.planner_data;
create policy "Users can insert own planner data"
on public.planner_data for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own planner data" on public.planner_data;
create policy "Users can update own planner data"
on public.planner_data for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

4. Kontrolliere unter **Authentication → URL Configuration**, dass die Site URL
   `https://mitschi77.github.io/Trail-Event-app/` lautet und diese Adresse als Redirect URL zugelassen ist.
5. Registriere dich in der App oder melde dich an. Falls E-Mail-Bestätigung aktiv ist, bestätige zuerst die E-Mail.
6. Lege einen Testeintrag an, warte auf die Synchronisierungsanzeige, lade die App neu und prüfe, ob der Eintrag erhalten bleibt.
7. Für einen vollständigen Sicherheitstest müssen zwei getrennte Konten verwendet werden. Jedes Konto darf ausschließlich seine eigenen Daten sehen.

## Sicherheit

- In der App darf nur der öffentliche Publishable Key verwendet werden.
- Niemals einen Supabase `service_role`-Key in die App oder dieses Repository eintragen.
- Die Row-Level-Security-Regeln oben beschränken jeden Datensatz auf den angemeldeten Benutzer.
- Die Datenbankeinrichtung kann nicht allein durch eine Änderung am GitHub-Repository abgeschlossen werden.
