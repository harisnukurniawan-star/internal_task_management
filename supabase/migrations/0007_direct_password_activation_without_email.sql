-- Direct first activation without email delivery.
-- One-time activation codes are stored only as SHA-256 hashes.

alter table public.activation_slots
  add column if not exists activation_code_hash text,
  add column if not exists activation_code_consumed_at timestamptz,
  add column if not exists signup_grant_hash text,
  add column if not exists signup_grant_expires_at timestamptz;

update public.activation_slots
set bound_email = 'hcconnectpln@gmail.com',
    bound_at = coalesce(bound_at, now()),
    activation_code_hash = '1191cd6301dce348262f1656d68bba164ee4d0c80bbefa0e64ac9621c528aff5',
    activation_code_consumed_at = null,
    signup_grant_hash = null,
    signup_grant_expires_at = null,
    updated_at = now()
where slot_key = 'system_admin';

update public.activation_slots
set activation_code_hash = '5fd0866474ed46008ea5c6266d44f072335d42986eda75ea7b542e0f92b850b4',
    activation_code_consumed_at = null,
    signup_grant_hash = null,
    signup_grant_expires_at = null,
    updated_at = now()
where slot_key = 'endang_mirah_ayu';

update public.activation_slots
set activation_code_hash = 'f9bb7214bf1421ed6797e0f840b9bf03124be01813f9ba1cc8c64c2494dd1cba',
    activation_code_consumed_at = null,
    signup_grant_hash = null,
    signup_grant_expires_at = null,
    updated_at = now()
where slot_key = 'citra_aries';

update public.activation_slots
set activation_code_hash = '0fcd6543750ed99c1ed182753f72a5b629508ffa5060e5e474ff22f5ead2a6db',
    activation_code_consumed_at = null,
    signup_grant_hash = null,
    signup_grant_expires_at = null,
    updated_at = now()
where slot_key = 'heri_syamsudin';

update public.activation_slots
set activation_code_hash = null,
    signup_grant_hash = null,
    signup_grant_expires_at = null,
    updated_at = now()
where slot_key = 'harisnu_kurniawan';

insert into public.access_allowlist(email, full_name, role, active, updated_at)
values ('hcconnectpln@gmail.com', 'Admin', 'admin', true, now())
on conflict on constraint access_allowlist_pkey do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

revoke all on function public.claim_activation_slot(text,text) from public, anon, authenticated;

create or replace function public.claim_activation_slot(
  p_slot_key text,
  p_email text,
  p_activation_code text,
  p_signup_grant text
)
returns table(slot_key text, full_name text, role text, email text, binding_status text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_slot public.activation_slots%rowtype;
  v_email text := lower(trim(coalesce(p_email,'')));
  v_other text;
  v_was_bound boolean;
  v_code_hash text;
  v_grant_hash text;
begin
  if v_email !~ '^[a-z0-9._%+\-]+@gmail\.com$' then
    raise exception 'Hanya alamat @gmail.com yang dapat digunakan untuk aktivasi.';
  end if;
  if length(coalesce(p_signup_grant,'')) < 20 then
    raise exception 'Grant aktivasi tidak valid.';
  end if;

  select * into v_slot
  from public.activation_slots s
  where s.slot_key = p_slot_key and s.active = true
  for update;

  if not found then raise exception 'Identitas user tidak valid.'; end if;
  if v_slot.activation_code_hash is null then
    raise exception 'Akun ini tidak menggunakan aktivasi pertama. Silakan gunakan login yang sudah ada.';
  end if;
  if v_slot.activation_code_consumed_at is not null then
    raise exception 'Kode aktivasi untuk user ini sudah pernah digunakan. Silakan login.';
  end if;

  v_code_hash := encode(digest(coalesce(p_activation_code,''), 'sha256'), 'hex');
  if v_code_hash <> v_slot.activation_code_hash then
    raise exception 'Kode aktivasi tidak valid.';
  end if;

  select s.slot_key into v_other
  from public.activation_slots s
  where s.bound_email = v_email and s.slot_key <> v_slot.slot_key
  limit 1;
  if v_other is not null then raise exception 'Email Gmail ini sudah terikat ke user lain.'; end if;
  if v_slot.bound_email is not null and v_slot.bound_email <> v_email then
    raise exception 'User ini sudah terikat ke Gmail pertama yang didaftarkan.';
  end if;

  v_was_bound := v_slot.bound_email is not null;
  v_grant_hash := encode(digest(p_signup_grant, 'sha256'), 'hex');

  update public.activation_slots
  set bound_email = coalesce(bound_email, v_email),
      bound_at = case when bound_email is null then now() else bound_at end,
      signup_grant_hash = v_grant_hash,
      signup_grant_expires_at = now() + interval '5 minutes',
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  insert into public.access_allowlist(email, full_name, role, active, updated_at)
  values(v_email, v_slot.full_name, v_slot.role, true, now())
  on conflict on constraint access_allowlist_pkey do update
  set full_name = excluded.full_name,
      role = excluded.role,
      active = true,
      updated_at = now();

  return query select v_slot.slot_key, v_slot.full_name, v_slot.role, v_email,
    case when v_was_bound then 'already_bound' else 'bound' end;
end;
$$;

revoke all on function public.claim_activation_slot(text,text,text,text) from public;
grant execute on function public.claim_activation_slot(text,text,text,text) to anon, authenticated;

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
  if v_slot.activation_code_consumed_at is not null then raise exception 'Akun ini sudah diaktifkan.'; end if;

  update public.activation_slots
  set activation_code_consumed_at = now(),
      signup_grant_hash = null,
      signup_grant_expires_at = null,
      updated_at = now()
  where activation_slots.slot_key = v_slot.slot_key;

  return new;
end;
$$;

revoke all on function private.enforce_activation_signup() from public, anon, authenticated;
grant execute on function private.enforce_activation_signup() to supabase_auth_admin;

drop trigger if exists enforce_activation_signup on auth.users;
create trigger enforce_activation_signup
before insert on auth.users
for each row execute function private.enforce_activation_signup();
