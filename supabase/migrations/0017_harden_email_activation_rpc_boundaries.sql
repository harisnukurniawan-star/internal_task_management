create or replace function private.claim_activation_email_core(
  p_email text,
  p_signup_grant text
)
returns table(slot_key text, email text, binding_status text)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_slot public.activation_slots%rowtype;
  v_existing_auth_id uuid;
  v_existing_meta jsonb;
  v_grant_hash text;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Email tidak valid.';
  end if;

  if length(coalesce(p_signup_grant, '')) < 20 then
    raise exception 'Grant aktivasi tidak valid.';
  end if;

  select * into v_slot
  from public.activation_slots s
  where lower(s.bound_email) = v_email
    and s.active = true
  for update;

  if not found then
    raise exception 'Email belum terdaftar untuk aktivasi.';
  end if;

  if v_slot.activation_code_consumed_at is not null then
    raise exception 'Akun ini sudah aktif. Gunakan halaman Masuk atau Lupa Password.';
  end if;

  select u.id, u.raw_user_meta_data
    into v_existing_auth_id, v_existing_meta
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_existing_auth_id is not null then
    if coalesce(v_existing_meta->>'activation_slot', '') <> v_slot.slot_key then
      raise exception 'Email sudah terikat ke akun Auth lain.';
    end if;

    insert into public.access_allowlist(email, full_name, role, active, updated_at)
    values(v_email, v_slot.full_name, v_slot.role, false, now())
    on conflict on constraint access_allowlist_pkey do update
    set full_name = excluded.full_name,
        role = excluded.role,
        active = false,
        updated_at = now();

    return query select v_slot.slot_key, v_email, 'resend'::text;
    return;
  end if;

  v_grant_hash := encode(digest(p_signup_grant, 'sha256'), 'hex');

  update public.activation_slots
  set signup_grant_hash = v_grant_hash,
      signup_grant_expires_at = now() + interval '5 minutes',
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  insert into public.access_allowlist(email, full_name, role, active, updated_at)
  values(v_email, v_slot.full_name, v_slot.role, false, now())
  on conflict on constraint access_allowlist_pkey do update
  set full_name = excluded.full_name,
      role = excluded.role,
      active = false,
      updated_at = now();

  return query select v_slot.slot_key, v_email, 'ready'::text;
end;
$$;

revoke all on function private.claim_activation_email_core(text, text) from public;
grant execute on function private.claim_activation_email_core(text, text) to anon, authenticated;

create or replace function public.claim_activation_email(
  p_email text,
  p_signup_grant text
)
returns table(slot_key text, email text, binding_status text)
language sql
security invoker
set search_path = private, public, pg_temp
as $$
  select * from private.claim_activation_email_core(p_email, p_signup_grant);
$$;

revoke all on function public.claim_activation_email(text, text) from public;
grant execute on function public.claim_activation_email(text, text) to anon, authenticated;

create or replace function private.get_my_activation_state_core()
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_slot public.activation_slots%rowtype;
begin
  if v_uid is null then return 'no_session'; end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null then return 'not_activation'; end if;

  select * into v_slot
  from public.activation_slots s
  where lower(s.bound_email) = v_email and s.active = true
  limit 1;

  if not found then return 'not_activation'; end if;
  if v_slot.activation_code_consumed_at is null then return 'pending'; end if;
  return 'active';
end;
$$;

revoke all on function private.get_my_activation_state_core() from public, anon;
grant execute on function private.get_my_activation_state_core() to authenticated;

create or replace function public.get_my_activation_state()
returns text
language sql
security invoker
set search_path = private, public, pg_temp
as $$
  select private.get_my_activation_state_core();
$$;

revoke all on function public.get_my_activation_state() from public, anon;
grant execute on function public.get_my_activation_state() to authenticated;

create or replace function private.complete_email_activation_core()
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_slot public.activation_slots%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesi aktivasi tidak valid.';
  end if;

  select lower(u.email)
    into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    return 'not_activation';
  end if;

  select *
    into v_slot
  from public.activation_slots s
  where lower(s.bound_email) = v_email
    and s.active = true
  for update;

  if not found then
    return 'not_activation';
  end if;

  if v_slot.activation_code_consumed_at is not null then
    return 'already_active';
  end if;

  if v_slot.password_set_at is null then
    raise exception 'Password baru belum berhasil disimpan.';
  end if;

  update public.activation_slots
  set activation_code_consumed_at = now(),
      signup_grant_hash = null,
      signup_grant_expires_at = null,
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  insert into public.access_allowlist(email, full_name, role, active, updated_at)
  values(v_slot.bound_email, v_slot.full_name, v_slot.role, true, now())
  on conflict on constraint access_allowlist_pkey do update
  set full_name = excluded.full_name,
      role = excluded.role,
      active = true,
      updated_at = now();

  insert into public.profiles(id, full_name, role, active, updated_at)
  values(v_uid, v_slot.full_name, v_slot.role, true, now())
  on conflict(id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

  if v_slot.role = 'employee' then
    update public.employees
    set profile_id = v_uid,
        updated_at = now()
    where lower(full_name) = lower(v_slot.full_name)
      and active = true
      and (profile_id is null or profile_id = v_uid);
  end if;

  return 'activated';
end;
$$;

revoke all on function private.complete_email_activation_core() from public, anon;
grant execute on function private.complete_email_activation_core() to authenticated;

create or replace function public.complete_email_activation()
returns text
language sql
security invoker
set search_path = private, public, pg_temp
as $$
  select private.complete_email_activation_core();
$$;

revoke all on function public.complete_email_activation() from public, anon;
grant execute on function public.complete_email_activation() to authenticated;
