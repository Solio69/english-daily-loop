create or replace function public.get_random_reading_text(p_tier text)
returns public.reading_texts
language sql
volatile
as $$
  select rt
  from public.reading_texts as rt
  where rt.tier = p_tier
    and rt.is_active = true
  order by random()
  limit 1;
$$;

grant execute on function public.get_random_reading_text(text) to anon;
grant execute on function public.get_random_reading_text(text) to authenticated;
grant execute on function public.get_random_reading_text(text) to service_role;
