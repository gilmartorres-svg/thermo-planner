create table public.planos_ses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  estado jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.planos_ses to authenticated;
grant all on public.planos_ses to service_role;

alter table public.planos_ses enable row level security;

create policy "usuario_ve_proprios_planos" on public.planos_ses
  for select to authenticated using (auth.uid() = user_id);
create policy "usuario_insere_proprios_planos" on public.planos_ses
  for insert to authenticated with check (auth.uid() = user_id);
create policy "usuario_atualiza_proprios_planos" on public.planos_ses
  for update to authenticated using (auth.uid() = user_id);
create policy "usuario_exclui_proprios_planos" on public.planos_ses
  for delete to authenticated using (auth.uid() = user_id);

create index planos_ses_user_id_atualizado_idx on public.planos_ses(user_id, atualizado_em desc);