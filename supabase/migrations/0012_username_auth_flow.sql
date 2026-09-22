alter table public.activation_slots
  add column if not exists username text;

update public.activation_slots set username = case slot_key
  when 'system_admin' then 'admin'
  when 'harisnu_kurniawan' then 'harisnu'
  when 'endang_mirah_ayu' then 'endang'
  when 'citra_aries' then 'citra'
  when 'heri_syamsudin' then 'heri'
  else username
end
where username is null;

alter table public.activation_slots
  alter column username set not null;

create unique index if not exists activation_slots_username_key
  on public.activation_slots (username);

alter table public.activation_slots
  drop constraint if exists activation_slots_username_format;

alter table public.activation_slots
  add constraint activation_slots_username_format
  check (username = lower(username) and username ~ '^[a-z0-9._-]{3,40}$');

create or replace function public.resolve_auth_email(p_username text)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.bound_email
  from public.activation_slots s
  where s.username = lower(trim(coalesce(p_username, '')))
    and s.active = true
    and s.activation_code_consumed_at is not null
    and s.bound_email is not null
  limit 1;
$$;

revoke all on function public.resolve_auth_email(text) from public;
grant execute on function public.resolve_auth_email(text) to anon, authenticated;

create or replace function private.claim_activation_username_core(
  p_username text,
  p_signup_grant text
)
returns table(slot_key text, full_name text, role text, email text, binding_status text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_slot public.activation_slots%rowtype;
  v_username text := lower(trim(coalesce(p_username, '')));
  v_grant_hash text;
  v_existing_auth uuid;
begin
  if v_username !~ '^[a-z0-9._-]{3,40}$' then
    raise exception 'Username tidak valid.';
  end if;

  if length(coalesce(p_signup_grant, '')) < 20 then
    raise exception 'Grant aktivasi tidak valid.';
  end if;

  select * into v_slot
  from public.activation_slots s
  where s.username = v_username and s.active = true
  for update;

  if not found then
    raise exception 'Username tidak ditemukan atau tidak aktif.';
  end if;

  if v_slot.activation_code_consumed_at is not null then
    raise exception 'Akun ini sudah aktif. Silakan gunakan halaman Masuk.';
  end if;

  if v_slot.bound_email is null then
    raise exception 'Email user belum didaftarkan administrator.';
  end if;

  select u.id into v_existing_auth
  from auth.users u
  where lower(u.email) = v_slot.bound_email
  limit 1;

  if v_existing_auth is not null then
    raise exception 'Akun login untuk user ini sudah ada. Silakan gunakan halaman Masuk.';
  end if;

  v_grant_hash := encode(digest(p_signup_grant, 'sha256'), 'hex');

  update public.activation_slots
  set signup_grant_hash = v_grant_hash,
      signup_grant_expires_at = now() + interval '5 minutes',
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  insert into public.access_allowlist(email, full_name, role, active, updated_at)
  values(v_slot.bound_email, v_slot.full_name, v_slot.role, true, now())
  on conflict on constraint access_allowlist_pkey do update
  set full_name = excluded.full_name,
      role = excluded.role,
      active = true,
      updated_at = now();

  return query
  select v_slot.slot_key, v_slot.full_name, v_slot.role, v_slot.bound_email, 'ready'::text;
end;
$$;

revoke all on function private.claim_activation_username_core(text, text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.claim_activation_username_core(text, text) to anon, authenticated;

create or replace function public.claim_activation_username(
  p_username text,
  p_signup_grant text
)
returns table(slot_key text, full_name text, role text, email text, binding_status text)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.claim_activation_username_core(p_username, p_signup_grant);
$$;

revoke all on function public.claim_activation_username(text, text) from public;
grant execute on function public.claim_activation_username(text, text) to anon, authenticated;
