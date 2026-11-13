-- Two functions from the favourites/blocking migration were meant for
-- signed-in users only, but Supabase's default grants also let anonymous
-- callers run them. Harmless (they return nothing private), but tidy.
revoke execute on function public.conversation_blocked(uuid) from anon;
revoke execute on function public.price_hint(text, text) from anon;
