-- Activation now follows an email-link flow:
-- username -> verified bound email -> Auth magic link -> set password -> activation complete.
-- `activation_code_consumed_at` remains the legacy-named activation-completed marker.

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
  v_existing_auth_id uuid;
  v_existing_meta jsonb;
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

  if not found then raise exception 'Username tidak ditemukan atau tidak aktif.'; end if;
  if v_slot.activation_code_consumed_at is not null then
    raise exception 'Akun ini sudah aktif. Silakan gunakan halaman Masuk.';
  end if;
  if v_slot.bound_email is null then
    raise exception 'Email user belum didaftarkan administrator.';
  end if;

  select u.id, u.raw_user_meta_data
  into v_existing_auth_id, v_existing_meta
  from auth.users u
  where lower(u.email) = v_slot.bound_email
  limit 1;

  if v_existing_auth_id is not null then
    if coalesce(v_existing_meta->>'activation_slot', '') <> v_slot.slot_key then
      raise exception 'Email sudah terikat ke akun Auth lain.';
    end if;

    insert into public.access_allowlist(email, full_name, role, active, updated_at)
    values(v_slot.bound_email, v_slot.full_name, v_slot.role, false, now())
    on conflict on constraint access_allowlist_pkey do update
    set full_name = excluded.full_name,
        role = excluded.role,
        active = false,
        updated_at = now();

    return query
    select v_slot.slot_key, v_slot.full_name, v_slot.role, v_slot.bound_email, 'resend'::text;
    return;
  end if;

  v_grant_hash := encode(digest(p_signup_grant, 'sha256'), 'hex');
  update public.activation_slots
  set signup_grant_hash = v_grant_hash,
      signup_grant_expires_at = now() + interval '5 minutes',
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  insert into public.access_allowlist(email, full_name, role, active, updated_at)
  values(v_slot.bound_email, v_slot.full_name, v_slot.role, false, now())
  on conflict on constraint access_allowlist_pkey do update
  set full_name = excluded.full_name,
      role = excluded.role,
      active = false,
      updated_at = now();

  return query
  select v_slot.slot_key, v_slot.full_name, v_slot.role, v_slot.bound_email, 'ready'::text;
end;
$$;

create or replace function private.enforce_activation_signup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_slot public.activation_slots%rowtype;
  v_slot_key text;
  v_grant text;
  v_grant_hash text;
begin
  if new.email is null then raise exception 'Signup tanpa email tidak diizinkan.'; end if;

  select * into v_slot
  from public.activation_slots s
  where s.bound_email = lower(new.email) and s.active = true
  for update;

  if not found then raise exception 'Email belum diizinkan untuk aktivasi aplikasi.'; end if;
  if v_slot.activation_code_consumed_at is not null then raise exception 'Akun ini sudah aktif.'; end if;

  v_slot_key := coalesce(new.raw_user_meta_data->>'activation_slot','');
  v_grant := coalesce(new.raw_user_meta_data->>'activation_grant','');
  v_grant_hash := encode(digest(v_grant, 'sha256'), 'hex');

  if v_slot_key <> v_slot.slot_key
     or v_slot.signup_grant_hash is null
     or v_slot.signup_grant_expires_at is null
     or v_slot.signup_grant_expires_at < now()
     or v_grant_hash <> v_slot.signup_grant_hash then
    raise exception 'Grant aktivasi tidak valid atau sudah kedaluwarsa.';
  end if;

  update public.activation_slots
  set signup_grant_hash = null,
      signup_grant_expires_at = null,
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  return new;
end;
$$;

create or replace function public.get_my_activation_state()
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
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then return 'not_activation'; end if;

  select * into v_slot
  from public.activation_slots s
  where s.bound_email = v_email and s.active = true
  limit 1;

  if not found then return 'not_activation'; end if;
  if v_slot.activation_code_consumed_at is null then return 'pending'; end if;
  return 'active';
end;
$$;

revoke all on function public.get_my_activation_state() from public, anon;
grant execute on function public.get_my_activation_state() to authenticated;

create or replace function public.complete_email_activation()
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_password text;
  v_slot public.activation_slots%rowtype;
begin
  if v_uid is null then raise exception 'Sesi aktivasi tidak valid.'; end if;

  select lower(u.email), u.encrypted_password
  into v_email, v_password
  from auth.users u
  where u.id = v_uid;

  if v_email is null then return 'not_activation'; end if;

  select * into v_slot
  from public.activation_slots s
  where s.bound_email = v_email and s.active = true
  for update;

  if not found then return 'not_activation'; end if;
  if v_slot.activation_code_consumed_at is not null then return 'already_active'; end if;
  if coalesce(v_password, '') = '' then raise exception 'Password belum terbentuk.'; end if;

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

revoke all on function public.complete_email_activation() from public, anon;
grant execute on function public.complete_email_activation() to authenticated;

-- Any not-yet-completed activation must remain disabled until the email link is
-- verified and complete_email_activation() finishes.
update public.access_allowlist a
set active = false,
    updated_at = now()
where exists (
  select 1
  from public.activation_slots s
  where s.bound_email = a.email
    and s.active = true
    and s.activation_code_consumed_at is null
);
