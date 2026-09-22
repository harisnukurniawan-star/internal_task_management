alter table public.activation_slots
  add column if not exists password_set_at timestamptz;

create or replace function private.mark_activation_password_set()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    update public.activation_slots
    set password_set_at = now(),
        updated_at = now()
    where lower(bound_email) = lower(new.email)
      and active = true
      and activation_code_consumed_at is null;
  end if;

  return new;
end;
$$;

revoke all on function private.mark_activation_password_set() from public, anon, authenticated;

drop trigger if exists track_activation_password_set on auth.users;
create trigger track_activation_password_set
after update of encrypted_password on auth.users
for each row
execute function private.mark_activation_password_set();

create or replace function public.complete_email_activation()
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

revoke all on function public.complete_email_activation() from public, anon;
grant execute on function public.complete_email_activation() to authenticated;

comment on column public.activation_slots.password_set_at is
'Internal marker set only when Supabase Auth actually updates encrypted_password after the activation user already exists.';
