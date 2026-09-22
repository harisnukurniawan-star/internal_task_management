-- Split dedicated Admin from Harisnu Kurniawan Supervisor.

update public.activation_slots
set full_name = 'Harisnu Kurniawan',
    role = 'supervisor',
    bound_email = 'harisnu@gmail.com',
    bound_at = coalesce(bound_at, now()),
    active = true,
    updated_at = now()
where slot_key = 'harisnu_kurniawan';

insert into public.activation_slots(slot_key, full_name, role, bound_email, active, bound_at, updated_at)
values ('system_admin', 'Admin', 'admin', 'hcconnectpln@gmail.com', true, now(), now())
on conflict (slot_key) do update
set full_name = excluded.full_name,
    role = excluded.role,
    bound_email = excluded.bound_email,
    active = true,
    bound_at = coalesce(public.activation_slots.bound_at, now()),
    updated_at = now();

insert into public.access_allowlist(email, full_name, role, active, updated_at)
values ('harisnu@gmail.com', 'Harisnu Kurniawan', 'supervisor', true, now())
on conflict on constraint access_allowlist_pkey do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

insert into public.access_allowlist(email, full_name, role, active, updated_at)
values ('hcconnectpln@gmail.com', 'Admin', 'admin', true, now())
on conflict on constraint access_allowlist_pkey do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();
