begin;

create extension if not exists pgtap;
select plan(13);

select is(has_function_privilege(
  'anon',
  'public.claim_reading_generation_request(uuid,date,int,text,text)',
  'EXECUTE'
), false, 'anonymous callers cannot claim a reading generation');
select is(has_function_privilege(
  'authenticated',
  'public.finish_reading_generation_request(uuid,uuid,uuid,text,text,text,int,text,text,boolean,date,int,int)',
  'EXECUTE'
), false, 'client sessions cannot persist a reading generation');

create temporary table generation_fixture (
  user_id uuid not null,
  reading_text_id uuid not null,
  study_date date not null,
  daily_limit int not null,
  request_id text not null,
  next_request_id text not null
) on commit drop;

insert into generation_fixture values (
  gen_random_uuid(), gen_random_uuid(), date '2026-10-16',
  1, 'req_test_reading_generation_first', 'req_test_reading_generation_next'
);

insert into public.users (id, telegram_user_id, first_name)
select user_id, -9223372036854775807, 'Generation test'
from generation_fixture;

create temporary table generation_claim as
select public.claim_reading_generation_request(
  f.user_id, f.study_date, f.daily_limit, f.request_id
) as payload
from generation_fixture f;

create temporary table duplicate_claim as
select public.claim_reading_generation_request(
  f.user_id, f.study_date, f.daily_limit, f.request_id
) as payload
from generation_fixture f;

select is((payload->>'isDuplicate')::boolean, false, 'first request is new')
from generation_claim;
select is((payload->>'isDuplicate')::boolean, true, 'same request is duplicate')
from duplicate_claim;
select is((select count(*)::int from public.reading_generation_attempts a
  join generation_fixture f on f.user_id = a.user_id), 1,
  'duplicate request does not spend another attempt');
select is((select payload->>'attemptId' from generation_claim),
  (select payload->>'attemptId' from duplicate_claim),
  'duplicate request retains the attempt ID');

select public.finish_reading_generation_request(
  f.user_id,
  (c.payload->>'attemptId')::uuid,
  f.reading_text_id,
  'Fixture reading',
  'Fixture reading body.',
  'A2',
  5,
  'openrouter',
  'fixture/model',
  false,
  f.study_date,
  3,
  100
)
from generation_fixture f cross join generation_claim c;

create temporary table generation_saved_at as
select a.generated_at
from public.user_active_reading_texts a
join generation_fixture f on f.user_id = a.user_id;

select public.finish_reading_generation_request(
  f.user_id,
  (c.payload->>'attemptId')::uuid,
  f.reading_text_id,
  'Fixture reading',
  'Fixture reading body.',
  'A2',
  5,
  'openrouter',
  'fixture/model',
  false,
  f.study_date,
  3,
  100
)
from generation_fixture f cross join generation_claim c;

select is(
  (select a.generated_at from public.user_active_reading_texts a
   join generation_fixture f on f.user_id = a.user_id),
  (select generated_at from generation_saved_at),
  'same finish request does not replace the saved text'
);

select is((select status from public.reading_generation_attempts a
  join generation_fixture f on f.user_id = a.user_id), 'succeeded',
  'successful completion updates attempt');
select is((select a.reading_text_id from public.user_active_reading_texts a
  join generation_fixture f on f.user_id = a.user_id),
  (select reading_text_id from generation_fixture),
  'successful completion atomically saves active text');
select is((public.claim_reading_generation_request(
  f.user_id, f.study_date, f.daily_limit, f.request_id
)->>'isDuplicate')::boolean, true,
  'completed request stays idempotent')
from generation_fixture f;
select is((public.claim_reading_generation_request(
  f.user_id, f.study_date + 1, f.daily_limit, f.request_id
)->>'isDuplicate')::boolean, true,
  'same request across study-day boundary stays idempotent')
from generation_fixture f;
select is((public.claim_reading_generation_request(
  f.user_id, f.study_date, f.daily_limit, f.next_request_id
)->>'ok')::boolean, false,
  'new request respects daily limit')
from generation_fixture f;
select is((select count(*)::int from public.reading_generation_attempts a
  join generation_fixture f on f.user_id = a.user_id), 1,
  'limit rejection creates no attempt');

select * from finish();
rollback;
