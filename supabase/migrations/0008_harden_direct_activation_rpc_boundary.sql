-- Keep privileged activation logic in private schema and expose only a SECURITY INVOKER wrapper.

create or replace function private.claim_activation_slot_core(
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
  if length(coalesce(p_signup_grant,'')) < 20 then raise exception 'Grant aktivasi tidak valid.'; end if;

  select * into v_slot from public.activation_slots s
  where s.slot_key = p_slot_key and s.active = true for update;

  if not found then raise exception 'Identitas user tidak valid.'; end if;
  if v_slot.activation_code_hash is null then
    raise exception 'Akun ini tidak menggunakan aktivasi pertama. Silakan gunakan login yang sudah ada.';
  end if;
  if v_slot.activation_code_consumed_at is not null then
    raise exception 'Kode aktivasi untuk user ini sudah pernah digunakan. Silakan login.';
  end if;

  v_code_hash := encode(digest(coalesce(p_activation_code,''), 'sha256'), 'hex');
  if v_code_hash <> v_slot.activation_code_hash then raise exception 'Kode aktivasi tidak valid.'; end if;

  select s.slot_key into v_other from public.activation_slots s
  where s.bound_email = v_email and s.slot_key <> v_slot.slot_key limit 1;
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

revoke all on function private.claim_activation_slot_core(text,text,text,text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.claim_activation_slot_core(text,text,text,text) to anon, authenticated;

create or replace function public.claim_activation_slot(
  p_slot_key text,
  p_email text,
  p_activation_code text,
  p_signup_grant text
)
returns table(slot_key text, full_name text, role text, email text, binding_status text)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.claim_activation_slot_core(p_slot_key, p_email, p_activation_code, p_signup_grant);
$$;

revoke all on function public.claim_activation_slot(text,text,text,text) from public;
grant execute on function public.claim_activation_slot(text,text,text,text) to anon, authenticated;
