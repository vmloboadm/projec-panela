drop policy if exists "authenticated full access" on contas;
drop policy if exists "authenticated full access" on categorias;
drop policy if exists "authenticated full access" on lancamentos;
drop policy if exists "authenticated full access" on contas_a_pagar;
drop policy if exists "authenticated full access" on ia_pendencias;
drop policy if exists "authenticated full access" on configuracao;

alter table contas disable row level security;
alter table categorias disable row level security;
alter table lancamentos disable row level security;
alter table contas_a_pagar disable row level security;
alter table ia_pendencias disable row level security;
alter table configuracao disable row level security;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
