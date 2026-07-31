alter table public.user_active_reading_texts
add column if not exists last_read_paragraph_index integer;

alter table public.user_active_reading_texts
drop constraint if exists user_active_reading_texts_last_read_paragraph_index_check;

alter table public.user_active_reading_texts
add constraint user_active_reading_texts_last_read_paragraph_index_check
check (
  last_read_paragraph_index is null
  or last_read_paragraph_index >= 0
);
