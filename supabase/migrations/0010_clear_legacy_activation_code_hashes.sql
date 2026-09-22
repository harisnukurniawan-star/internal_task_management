-- Manual activation codes are no longer used.
-- Keep activation_code_consumed_at temporarily as an internal activation-completed marker for backward compatibility.
update public.activation_slots
set activation_code_hash = null,
    updated_at = now()
where activation_code_hash is not null;
