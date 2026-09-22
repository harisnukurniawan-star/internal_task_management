-- Allow activation binding calls from both unauthenticated and stale/authenticated browser sessions.
-- The function itself only accepts the predefined activation slots and enforces first-Gmail binding.

grant execute on function public.claim_activation_slot(text,text) to authenticated;
