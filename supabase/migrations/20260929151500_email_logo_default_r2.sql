-- Email logo default now points at the site's own R2 media domain.
alter table public.email_template_settings
  alter column logo_url set default 'https://media.metsxmfanzone.com/email-assets/metsxmfanzone-logo.png';
