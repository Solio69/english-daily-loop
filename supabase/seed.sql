-- Local development seed data
-- Safe to run multiple times (idempotent via ON CONFLICT)

insert into public.users (
  id,
  telegram_user_id,
  username,
  first_name,
  last_name,
  language_code,
  is_active
)
values (
  '11111111-1111-4111-8111-111111111111',
  999000001,
  'dev_user',
  'Dev',
  'User',
  'ru',
  true
)
on conflict (telegram_user_id) do update
set
  username = excluded.username,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  language_code = excluded.language_code,
  is_active = excluded.is_active;

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
