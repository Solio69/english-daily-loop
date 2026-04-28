-- Local development seed data.
-- Safe to run multiple times. Dev scenario state is reset to the expected baseline.

insert into public.users (
  id,
  telegram_user_id,
  username,
  first_name,
  last_name,
  language_code,
  is_active,
  settings_completed_at,
  first_text_completed_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    999000001,
    'dev_fresh',
    'Fresh',
    'Dev',
    'ru',
    true,
    null,
    null
  ),
  (
    '11111111-1111-4111-8111-111111111112',
    999000002,
    'dev_onboarded',
    'Onboarded',
    'Dev',
    'ru',
    true,
    now() - interval '2 days',
    null
  ),
  (
    '11111111-1111-4111-8111-111111111113',
    999000003,
    'dev_active_text',
    'Active Text',
    'Dev',
    'ru',
    true,
    now() - interval '2 days',
    null
  ),
  (
    '11111111-1111-4111-8111-111111111114',
    999000004,
    'dev_completed_today',
    'Completed Today',
    'Dev',
    'ru',
    true,
    now() - interval '3 days',
    now() - interval '1 hour'
  ),
  (
    '11111111-1111-4111-8111-111111111115',
    999000005,
    'dev_paid',
    'Paid',
    'Dev',
    'ru',
    true,
    now() - interval '2 days',
    null
  ),
  (
    '11111111-1111-4111-8111-111111111116',
    999000006,
    'dev_history',
    'History',
    'Dev',
    'ru',
    true,
    now() - interval '10 days',
    now() - interval '3 days'
  )
on conflict (telegram_user_id) do update
set
  id = excluded.id,
  username = excluded.username,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  language_code = excluded.language_code,
  is_active = excluded.is_active,
  settings_completed_at = excluded.settings_completed_at,
  first_text_completed_at = excluded.first_text_completed_at;

with dev_users(id) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid),
    ('11111111-1111-4111-8111-111111111112'::uuid),
    ('11111111-1111-4111-8111-111111111113'::uuid),
    ('11111111-1111-4111-8111-111111111114'::uuid),
    ('11111111-1111-4111-8111-111111111115'::uuid),
    ('11111111-1111-4111-8111-111111111116'::uuid)
)
delete from public.reading_generation_attempts
where user_id in (select id from dev_users);

with dev_users(id) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid),
    ('11111111-1111-4111-8111-111111111112'::uuid),
    ('11111111-1111-4111-8111-111111111113'::uuid),
    ('11111111-1111-4111-8111-111111111114'::uuid),
    ('11111111-1111-4111-8111-111111111115'::uuid),
    ('11111111-1111-4111-8111-111111111116'::uuid)
)
delete from public.user_active_reading_texts
where user_id in (select id from dev_users);

with dev_users(id) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid),
    ('11111111-1111-4111-8111-111111111112'::uuid),
    ('11111111-1111-4111-8111-111111111113'::uuid),
    ('11111111-1111-4111-8111-111111111114'::uuid),
    ('11111111-1111-4111-8111-111111111115'::uuid),
    ('11111111-1111-4111-8111-111111111116'::uuid)
)
delete from public.user_daily_reading_completions
where user_id in (select id from dev_users);

with dev_users(id) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid),
    ('11111111-1111-4111-8111-111111111112'::uuid),
    ('11111111-1111-4111-8111-111111111113'::uuid),
    ('11111111-1111-4111-8111-111111111114'::uuid),
    ('11111111-1111-4111-8111-111111111115'::uuid),
    ('11111111-1111-4111-8111-111111111116'::uuid)
)
delete from public.user_completed_reading_texts
where user_id in (select id from dev_users);

with dev_users(id) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid),
    ('11111111-1111-4111-8111-111111111112'::uuid),
    ('11111111-1111-4111-8111-111111111113'::uuid),
    ('11111111-1111-4111-8111-111111111114'::uuid),
    ('11111111-1111-4111-8111-111111111115'::uuid),
    ('11111111-1111-4111-8111-111111111116'::uuid)
)
delete from public.user_subscriptions
where user_id in (select id from dev_users);

with dev_users(id) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid),
    ('11111111-1111-4111-8111-111111111112'::uuid),
    ('11111111-1111-4111-8111-111111111113'::uuid),
    ('11111111-1111-4111-8111-111111111114'::uuid),
    ('11111111-1111-4111-8111-111111111115'::uuid),
    ('11111111-1111-4111-8111-111111111116'::uuid)
)
delete from public.user_settings
where user_id in (select id from dev_users);

insert into public.user_settings (
  user_id,
  english_level,
  daily_exercise_minutes,
  daily_reading_minutes
)
values
  ('11111111-1111-4111-8111-111111111112', 'A1', 10, 3),
  ('11111111-1111-4111-8111-111111111113', 'A2', 15, 5),
  ('11111111-1111-4111-8111-111111111114', 'A2', 15, 5),
  ('11111111-1111-4111-8111-111111111115', 'B1', 20, 10),
  ('11111111-1111-4111-8111-111111111116', 'B1', 20, 5)
on conflict (user_id) do update
set
  english_level = excluded.english_level,
  daily_exercise_minutes = excluded.daily_exercise_minutes,
  daily_reading_minutes = excluded.daily_reading_minutes;

insert into public.user_active_reading_texts (
  user_id,
  title,
  body,
  level,
  estimated_minutes,
  provider,
  model,
  fallback_used,
  generated_at
)
values (
  '11111111-1111-4111-8111-111111111113',
  'A Walk After Work',
  'After work, Maya decided to walk home instead of taking the bus. The streets were quiet, and the evening air felt fresh. She listened to a short English podcast and repeated a few useful phrases. Near the river, she stopped to watch the lights reflected in the water. The walk helped her relax and gave her a small but real feeling of progress.',
  'A2',
  5,
  'seed',
  'dev-seed-active-text',
  false,
  now() - interval '30 minutes'
)
on conflict (user_id) do update
set
  title = excluded.title,
  body = excluded.body,
  level = excluded.level,
  estimated_minutes = excluded.estimated_minutes,
  provider = excluded.provider,
  model = excluded.model,
  fallback_used = excluded.fallback_used,
  generated_at = excluded.generated_at;

insert into public.reading_generation_attempts (
  user_id,
  attempt_date,
  status,
  provider,
  model
)
values
  (
    '11111111-1111-4111-8111-111111111113',
    (now() at time zone 'Europe/Moscow')::date,
    'succeeded',
    'seed',
    'dev-seed-active-text'
  ),
  (
    '11111111-1111-4111-8111-111111111114',
    (now() at time zone 'Europe/Moscow')::date,
    'succeeded',
    'seed',
    'dev-seed-completed-today'
  );

insert into public.user_daily_reading_completions (
  user_id,
  completed_date,
  completed_at
)
values (
  '11111111-1111-4111-8111-111111111114',
  (now() at time zone 'Europe/Moscow')::date,
  now() - interval '1 hour'
)
on conflict (user_id, completed_date) do update
set completed_at = excluded.completed_at;

insert into public.user_completed_reading_texts (
  id,
  user_id,
  completed_date,
  completed_at,
  title,
  body,
  level,
  estimated_minutes,
  provider,
  model,
  fallback_used
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    '11111111-1111-4111-8111-111111111114',
    (now() at time zone 'Europe/Moscow')::date,
    now() - interval '1 hour',
    'The First Good Habit',
    'Leo wanted to improve his English, but he often waited for the perfect moment. One day, he changed his plan. He read one short text every morning before checking messages. The habit was small, so it was easy to repeat. After a week, he noticed that familiar words appeared faster in his mind.',
    'A2',
    5,
    'seed',
    'dev-seed-completed-today',
    false
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    '11111111-1111-4111-8111-111111111116',
    ((now() at time zone 'Europe/Moscow')::date - 1),
    now() - interval '1 day',
    'A Better Meeting',
    'The team meeting became easier after Nora prepared three clear questions. She asked what was blocked, what was finished, and what needed a decision. People answered faster because the structure was simple. By the end, everyone understood the next step.',
    'B1',
    5,
    'seed',
    'dev-seed-history',
    false
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111116',
    ((now() at time zone 'Europe/Moscow')::date - 2),
    now() - interval '2 days',
    'The Train Delay',
    'When the train was delayed, Max used the extra time to read an article in English. He did not understand every word, but he understood the main idea. Instead of feeling annoyed, he turned the delay into a short study session.',
    'B1',
    5,
    'seed',
    'dev-seed-history',
    false
  ),
  (
    '33333333-3333-4333-8333-333333333334',
    '11111111-1111-4111-8111-111111111116',
    ((now() at time zone 'Europe/Moscow')::date - 5),
    now() - interval '5 days',
    'Small Notes',
    'Ira kept a small notebook near her laptop. During the day, she wrote useful English phrases from messages and videos. In the evening, she read the notes again and made one sentence with each phrase.',
    'B1',
    5,
    'seed',
    'dev-seed-history',
    false
  )
on conflict (id) do update
set
  completed_date = excluded.completed_date,
  completed_at = excluded.completed_at,
  title = excluded.title,
  body = excluded.body,
  level = excluded.level,
  estimated_minutes = excluded.estimated_minutes,
  provider = excluded.provider,
  model = excluded.model,
  fallback_used = excluded.fallback_used;

insert into public.user_subscriptions (
  id,
  user_id,
  plan_type,
  starts_at,
  ends_at,
  source
)
values (
  '44444444-4444-4444-8444-444444444441',
  '11111111-1111-4111-8111-111111111115',
  'yearly',
  now() - interval '1 day',
  now() + interval '6 days',
  'mvp_zero_price'
)
on conflict (id) do update
set
  plan_type = excluded.plan_type,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  source = excluded.source;

insert into public.reading_texts (
  id,
  code,
  title,
  level,
  tier,
  body,
  estimated_minutes,
  is_active
)
values
  (
    '22222222-2222-4222-8222-222222222221',
    'city-morning-a1',
    'A Morning in the City',
    'A1',
    'my_level',
    'Tom lives in a small flat near the city center. Every morning, he wakes up at seven. He makes tea, eats two eggs, and checks his messages. Then he walks to the metro station. On the train, he reads short news in English. At work, he writes simple emails and talks with his team. In the evening, he buys fruit and goes home. He is tired, but happy because his day was productive.',
    3,
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'weekend-park-a1',
    'A Quiet Weekend',
    'A1',
    'my_level',
    'On Saturday, Anna meets her friend in the park. They sit on a bench and drink coffee. The weather is warm, and many families are outside. Anna tells her friend about her new job and her English lessons. After one hour, they walk to a small market. Anna buys bread, cheese, and apples. In the evening, she cooks dinner at home and watches a short video in English before sleep.',
    3,
    true
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    'startup-meeting-a2',
    'The Team Meeting',
    'A2',
    'one_level_up',
    'On Monday, our team had a planning meeting for the new mobile app. First, we reviewed the tasks from last week and discussed what was completed on time. Then each person shared one risk that could slow down delivery. I presented a short update about user feedback and suggested two changes to the onboarding flow. After the meeting, we agreed on priorities for the next sprint and wrote a clear action list. Even though we had different opinions, the discussion was useful and respectful.',
    4,
    true
  )
on conflict (code) do update
set
  title = excluded.title,
  level = excluded.level,
  tier = excluded.tier,
  body = excluded.body,
  estimated_minutes = excluded.estimated_minutes,
  is_active = excluded.is_active;
