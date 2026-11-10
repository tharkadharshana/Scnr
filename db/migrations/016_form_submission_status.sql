-- Report-a-problem inbox: each form response can be marked new, in progress or done. Run once in the Supabase SQL editor. Safe to re-run.
alter table public.form_submissions add column if not exists status text not null default 'new';
alter table public.form_submissions drop constraint if exists form_submissions_status_check;
alter table public.form_submissions add constraint form_submissions_status_check check (status in ('new', 'progress', 'done'));
