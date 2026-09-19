-- The commercial inbox authorization belongs to the AXION workspace. A transient
-- sync failure must not make the shared grant appear disconnected to other members.
update public.workspace_integrations
set status = 'connected', updated_at = now()
where provider = 'google_gmail_quotes'
  and status = 'error'
  and encrypted_refresh_token <> '';
