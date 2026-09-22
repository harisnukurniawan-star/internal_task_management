-- Username is no longer used to resolve login emails. Login remains direct email/password,
-- while username is only an activation alias. Retire the old exposed resolver.
revoke all on function public.resolve_auth_email(text) from public, anon, authenticated;
