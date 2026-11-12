-- Self-serve account deletion (menu → Delete account).
--
-- An account that never booked, rented out, chatted or set up payments is
-- deleted outright (everything cascades from auth.users).
--
-- An account with history is anonymised instead, because the other party's
-- bookings, messages and agreements, the bookkeeping records (7 years) and
-- the platform report to Skatteverket (host_tax_info) must stay: name, about,
-- photo, last name, phone, access instructions, push devices and the login
-- (email, Google identity, sessions) are removed, listings without
-- bookings are deleted and the rest are paused, and the account is locked.
--
-- Deletion is refused while a rental is running or coming up, a request is
-- waiting for an answer, or money is still on its way.
--
-- The app removes the user's own photos in Storage first (Storage files
-- cannot be deleted with SQL).

alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function private.account_blockers(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pending_requests', (select count(*) from public.requests r
                          where (r.host_id = p_user or r.renter_id = p_user) and r.status = 'pending'),
    'active_rentals', (select count(*) from public.requests r
                        where (r.host_id = p_user or r.renter_id = p_user) and r.status = 'accepted'
                          and case when r.kind = 'hour' then r.end_at > now()
                                   else r.end_date is null or r.end_date >= (now() at time zone 'Europe/Stockholm')::date end),
    'open_payments', (select count(*) from public.payments p
                       where (p.host_id = p_user or p.renter_id = p_user)
                         and (p.status in ('due', 'processing', 'failed')
                              or (p.status = 'paid' and p.transferred_at is null and p.refund_requested_at is null)
                              or (p.refund_requested_at is not null and p.refunded_at is null)))
  );
$$;

create or replace function private.account_has_history(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.requests r where r.host_id = p_user or r.renter_id = p_user)
      or exists (select 1 from public.conversations c where c.host_id = p_user or c.renter_id = p_user)
      or exists (select 1 from public.payments p where p.host_id = p_user or p.renter_id = p_user)
      or exists (select 1 from public.host_tax_info t where t.user_id = p_user)
      or exists (select 1 from private.stripe_customers s where s.user_id = p_user)
      or exists (select 1 from private.stripe_accounts s where s.user_id = p_user);
$$;

-- What deleting would do: { mode: 'delete' | 'anonymise', blockers: {...}, ok }.
create or replace function public.account_deletion_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b jsonb;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  b := private.account_blockers(me);
  return jsonb_build_object(
    'mode', case when private.account_has_history(me) then 'anonymise' else 'delete' end,
    'blockers', b,
    'ok', (b->>'pending_requests')::int + (b->>'active_rentals')::int + (b->>'open_payments')::int = 0);
end;
$$;

create or replace function public.delete_my_account()
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b jsonb;
  cus text;
  acct text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  -- One deletion at a time per account (a double click must not race).
  perform 1 from public.profiles where id = me for update;
  b := private.account_blockers(me);
  if (b->>'pending_requests')::int + (b->>'active_rentals')::int + (b->>'open_payments')::int > 0 then
    raise exception 'account_busy' using errcode = 'P0001';
  end if;

  if not private.account_has_history(me) then
    delete from auth.users where id = me;
    return 'deleted';
  end if;

  select customer_id into cus from private.stripe_customers where user_id = me;
  select account_id into acct from private.stripe_accounts where user_id = me;

  -- The profile and its private details.
  update public.profiles set first_name = '', about = '', avatar_url = null, deleted_at = now() where id = me;
  update public.profile_private set last_name = '', phone = '', updated_at = now() where id = me;

  -- Listings: those never booked or asked about go; the rest stay (the other
  -- party's history points at them) but are paused, photo-less and without
  -- access instructions. The address stays for the platform report.
  delete from public.listings l
   where l.host_id = me
     and not exists (select 1 from public.requests r where r.listing_id = l.id)
     and not exists (select 1 from public.conversations c where c.listing_id = l.id);
  update public.listings set status = 'paused' where host_id = me and status <> 'paused';
  delete from public.listing_photos ph using public.listings l where ph.listing_id = l.id and l.host_id = me;
  update public.listing_private lp set access_instructions = ''
    from public.listings l where lp.listing_id = l.id and l.host_id = me;

  delete from public.push_subscriptions where user_id = me;
  delete from private.notifications where recipient = me and sent_at is null;
  delete from private.admins where user_id = me;
  update private.stripe_customers set payment_method = null, card_brand = null, card_last4 = null, card_exp = null where user_id = me;

  -- The login: no email, phone, Google link or session left, and locked.
  delete from auth.identities where user_id = me;
  delete from auth.sessions where user_id = me;
  delete from auth.refresh_tokens where user_id = me::text;
  delete from auth.one_time_tokens where user_id = me;
  update auth.users
     set email = null, phone = null, encrypted_password = null,
         raw_user_meta_data = '{}'::jsonb, banned_until = 'infinity'::timestamptz,
         email_change = '', phone_change = '', email_change_token_new = '', email_change_token_current = '',
         confirmation_token = '', recovery_token = '', reauthentication_token = ''
   where id = me;

  -- Stripe still holds the card or the payout account: the team closes them by hand.
  if cus is not null or acct is not null then
    perform private.raise_alert(
      'account_deleted',
      'Ett konto har raderats: stäng det hos Stripe',
      format(E'En användare har raderat sitt konto i appen. Uppgifterna i Spazia är anonymiserade.\n\n%s%s\nTa bort det sparade kortet och/eller avsluta utbetalningskontot i Stripe Dashboard när inga fler betalningar eller återbetalningar väntar. Bokföringsunderlag och uppgifter för plattformsrapporteringen ligger kvar.',
             case when cus is not null then format(E'Kund (kort): %s\n', cus) else '' end,
             case when acct is not null then format(E'Utbetalningskonto: %s\n', acct) else '' end),
      'account_deleted:' || me::text,
      interval '1 day');
  end if;
  return 'anonymised';
end;
$$;

revoke all on function private.account_blockers(uuid) from public;
revoke all on function private.account_has_history(uuid) from public;
revoke all on function public.account_deletion_status() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.account_deletion_status() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
