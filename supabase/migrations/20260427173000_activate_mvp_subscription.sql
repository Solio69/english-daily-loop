create or replace function public.activate_mvp_subscription(
  p_user_id uuid,
  p_plan_type text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.user_subscriptions%rowtype;
  v_scheduled public.user_subscriptions%rowtype;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_duration interval;
  v_created public.user_subscriptions%rowtype;
begin
  if p_plan_type not in ('monthly', 'yearly') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_PLAN_TYPE',
      'message', 'Subscription plan type is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('subscription:' || p_user_id::text));

  select *
  into v_active
  from public.user_subscriptions
  where user_id = p_user_id
    and starts_at <= p_now
    and ends_at > p_now
  order by ends_at desc
  limit 1
  for update;

  select *
  into v_scheduled
  from public.user_subscriptions
  where user_id = p_user_id
    and starts_at > p_now
  order by starts_at asc
  limit 1
  for update;

  if v_active.id is not null and v_active.plan_type = 'yearly' then
    return jsonb_build_object(
      'ok', false,
      'code', 'YEARLY_ALREADY_ACTIVE',
      'message', 'Yearly subscription is already active.'
    );
  end if;

  if v_active.id is not null and v_active.plan_type = 'monthly' and p_plan_type = 'monthly' then
    return jsonb_build_object(
      'ok', false,
      'code', 'MONTHLY_ALREADY_ACTIVE',
      'message', 'Monthly subscription is already active.'
    );
  end if;

  if v_active.id is not null
    and v_active.plan_type = 'monthly'
    and p_plan_type = 'yearly'
    and v_scheduled.id is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'YEARLY_ALREADY_SCHEDULED',
      'message', 'Yearly subscription is already scheduled.'
    );
  end if;

  v_starts_at :=
    case
      when v_active.id is not null and v_active.plan_type = 'monthly' and p_plan_type = 'yearly'
        then v_active.ends_at
      else p_now
    end;
  v_duration :=
    case
      when p_plan_type = 'monthly' then interval '1 day'
      else interval '7 days'
    end;
  v_ends_at := v_starts_at + v_duration;

  insert into public.user_subscriptions (
    user_id,
    plan_type,
    starts_at,
    ends_at,
    source
  )
  values (
    p_user_id,
    p_plan_type,
    v_starts_at,
    v_ends_at,
    'mvp_zero_price'
  )
  returning * into v_created;

  return jsonb_build_object(
    'ok', true,
    'subscriptionId', v_created.id,
    'planType', v_created.plan_type,
    'startsAt', v_created.starts_at,
    'endsAt', v_created.ends_at
  );
end;
$$;

revoke all on function public.activate_mvp_subscription(uuid, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.activate_mvp_subscription(uuid, text, timestamptz)
to service_role;
