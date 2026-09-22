create or replace function public.resolve_auth_email(p_username text)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  with input as (
    select lower(trim(coalesce(p_username, ''))) as identifier
  )
  select s.bound_email
  from public.activation_slots s, input i
  where s.active = true
    and s.activation_code_consumed_at is not null
    and s.bound_email is not null
    and (
      s.username = i.identifier
      or lower(s.bound_email) = i.identifier
    )
  limit 1;
$$;

revoke all on function public.resolve_auth_email(text) from public;
grant execute on function public.resolve_auth_email(text) to anon, authenticated;
