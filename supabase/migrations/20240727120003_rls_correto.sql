-- Remove acesso anon
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke usage on schema public from anon;

-- Habilita RLS em todas as tabelas
alter table contas enable row level security;
alter table categorias enable row level security;
alter table lancamentos enable row level security;
alter table contas_a_pagar enable row level security;
alter table ia_pendencias enable row level security;
alter table configuracao enable row level security;

-- Policies: usuário autenticado tem acesso total
create policy "auth_all" on contas for all to authenticated using (true) with check (true);
create policy "auth_all" on categorias for all to authenticated using (true) with check (true);
create policy "auth_all" on lancamentos for all to authenticated using (true) with check (true);
create policy "auth_all" on contas_a_pagar for all to authenticated using (true) with check (true);
create policy "auth_all" on ia_pendencias for all to authenticated using (true) with check (true);
create policy "auth_all" on configuracao for all to authenticated using (true) with check (true);

-- Authenticated mantém acesso (precisa pro server-side)
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
