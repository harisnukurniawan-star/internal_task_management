-- First Gmail activation binding for the four fixed app identities.
-- The first Gmail registered for each identity becomes permanent unless changed administratively.

create table if not exists public.activation_slots (
  slot_key text primary key,
  full_name text not null unique,
  role text not null check (role in ('admin','supervisor','employee')),
  bound_email text unique,
  active boolean not null default true,
  bound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activation_slots_email_lowercase check (bound_email is null or bound_email = lower(bound_email)),
  constraint activation_slots_gmail_only check (bound_email is null or bound_email ~ '^[a-z0-9._%+\-]+@gmail\.com$')
);

alter table public.activation_slots enable row level security;
revoke all on table public.activation_slots from anon, authenticated;

insert into public.activation_slots(slot_key, full_name, role, bound_email, bound_at)
values
  ('harisnu_kurniawan','Harisnu Kurniawan','admin','harisnu@gmail.com',now()),
  ('endang_mirah_ayu','Endang Mirah Ayu','employee',null,null),
  ('citra_aries','Citra Aries','employee',null,null),
  ('heri_syamsudin','Heri Syamsudin','employee',null,null)
on conflict (slot_key) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  bound_email = case when public.activation_slots.bound_email is null then excluded.bound_email else public.activation_slots.bound_email end,
  bound_at = case when public.activation_slots.bound_email is null and excluded.bound_email is not null then now() else public.activation_slots.bound_at end,
  active = true,
  updated_at = now();

update public.access_allowlist
set full_name='Harisnu Kurniawan', role='admin', active=true, updated_at=now()
where email='harisnu@gmail.com';

create or replace function private.sync_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare allowed public.access_allowlist%rowtype;
begin
  if new.email is null then return new; end if;
  select * into allowed from public.access_allowlist where email=lower(new.email) limit 1;
  if found and allowed.active then
    insert into public.profiles(id,full_name,role,active,updated_at)
    values(new.id,allowed.full_name,allowed.role,true,now())
    on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();
    if allowed.role='employee' then
      update public.employees set profile_id=new.id,updated_at=now()
      where lower(full_name)=lower(allowed.full_name) and active=true and (profile_id is null or profile_id=new.id);
    end if;
  else
    update public.profiles set active=false,updated_at=now() where id=new.id;
  end if;
  return new;
end; $$;

create or replace function private.sync_profiles_from_allowlist()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid;
begin
  select u.id into v_user_id from auth.users u where lower(u.email)=new.email limit 1;
  if v_user_id is not null then
    insert into public.profiles(id,full_name,role,active,updated_at)
    values(v_user_id,new.full_name,new.role,new.active,now())
    on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=excluded.active,updated_at=now();
    if new.role='employee' and new.active then
      update public.employees set profile_id=v_user_id,updated_at=now()
      where lower(full_name)=lower(new.full_name) and active=true and (profile_id is null or profile_id=v_user_id);
    end if;
  end if;
  return new;
end; $$;

create or replace function public.claim_activation_slot(p_slot_key text, p_email text)
returns table(slot_key text, full_name text, role text, email text, binding_status text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_slot public.activation_slots%rowtype;
  v_email text := lower(trim(coalesce(p_email,'')));
  v_other text;
  v_was_bound boolean;
begin
  if v_email !~ '^[a-z0-9._%+\-]+@gmail\.com$' then raise exception 'Hanya alamat @gmail.com yang dapat digunakan untuk aktivasi.'; end if;
  select * into v_slot from public.activation_slots s where s.slot_key=p_slot_key and s.active=true for update;
  if not found then raise exception 'Identitas user tidak valid.'; end if;

  select s.slot_key into v_other from public.activation_slots s where s.bound_email=v_email and s.slot_key<>v_slot.slot_key limit 1;
  if v_other is not null then raise exception 'Email Gmail ini sudah terikat ke user lain.'; end if;
  if v_slot.bound_email is not null and v_slot.bound_email<>v_email then raise exception 'User ini sudah terikat ke Gmail pertama yang didaftarkan.'; end if;

  v_was_bound := v_slot.bound_email is not null;
  if not v_was_bound then
    update public.activation_slots set bound_email=v_email,bound_at=now(),updated_at=now() where activation_slots.slot_key=v_slot.slot_key;
    v_slot.bound_email:=v_email;
  end if;

  insert into public.access_allowlist(email,full_name,role,active,updated_at)
  values(v_email,v_slot.full_name,v_slot.role,true,now())
  on conflict on constraint access_allowlist_pkey do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();

  return query select v_slot.slot_key,v_slot.full_name,v_slot.role,v_email,case when v_was_bound then 'already_bound' else 'bound' end;
end; $$;

revoke all on function public.claim_activation_slot(text,text) from public;
grant execute on function public.claim_activation_slot(text,text) to anon, authenticated;
