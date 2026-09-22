create or replace function public.claim_activation_email(
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

revoke all on function public.claim_activation_email(text, text) from public;
grant execute on function public.claim_activation_email(text, text) to anon, authenticated;

comment on function public.claim_activation_email(text, text) is
'Email-only activation entry. Validates the administrator-bound email, creates a short-lived signup grant for a new Auth user, or allows resend for a pending activation.';