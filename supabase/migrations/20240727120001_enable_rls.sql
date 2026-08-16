alter table contas enable row level security;
alter table categorias enable row level security;
alter table lancamentos enable row level security;
alter table contas_a_pagar enable row level security;
alter table ia_pendencias enable row level security;
alter table configuracao enable row level security;

create policy "authenticated full access" on contas for all to authenticated using (true) with check (true);
create policy "authenticated full access" on categorias for all to authenticated using (true) with check (true);
create policy "authenticated full access" on lancamentos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on contas_a_pagar for all to authenticated using (true) with check (true);
create policy "authenticated full access" on ia_pendencias for all to authenticated using (true) with check (true);
create policy "authenticated full access" on configuracao for all to authenticated using (true) with check (true);
