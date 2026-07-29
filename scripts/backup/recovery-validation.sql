\set ON_ERROR_STOP on

with
protected_tables(table_name) as (
  values
    ('users'),
    ('user_settings'),
    ('reading_generation_attempts'),
    ('user_active_reading_texts'),
    ('user_daily_reading_completions'),
    ('user_subscriptions'),
    ('user_completed_reading_texts'),
    ('user_vocabulary_words'),
    ('user_vocabulary_word_sources'),
    ('vocabulary_card_generation_attempts'),
    ('user_daily_vocabulary_review_completions'),
    ('support_reports')
),
required_functions(function_name) as (
  values
    ('get_random_reading_text'),
    ('claim_reading_generation_attempt'),
    ('complete_daily_reading_text'),
    ('activate_mvp_subscription'),
    ('save_vocabulary_word_with_source'),
    ('save_pending_vocabulary_word_with_source'),
    ('claim_vocabulary_card_generation_attempt'),
    ('get_moscow_study_date'),
    ('get_or_create_vocabulary_review_state'),
    ('review_vocabulary_word'),
    ('dev_complete_vocabulary_reviews_at_step')
),
public_functions as (
  select p.oid, p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
validation as (
  select jsonb_build_object(
    'publicTableRowCounts',
    jsonb_build_object(
      'users', (select count(*) from public.users),
      'reading_texts', (select count(*) from public.reading_texts),
      'user_settings', (select count(*) from public.user_settings),
      'reading_generation_attempts',
        (select count(*) from public.reading_generation_attempts),
      'user_active_reading_texts',
        (select count(*) from public.user_active_reading_texts),
      'user_daily_reading_completions',
        (select count(*) from public.user_daily_reading_completions),
      'user_subscriptions',
        (select count(*) from public.user_subscriptions),
      'user_completed_reading_texts',
        (select count(*) from public.user_completed_reading_texts),
      'user_vocabulary_words',
        (select count(*) from public.user_vocabulary_words),
      'user_vocabulary_word_sources',
        (select count(*) from public.user_vocabulary_word_sources),
      'vocabulary_card_generation_attempts',
        (select count(*) from public.vocabulary_card_generation_attempts),
      'user_daily_vocabulary_review_completions',
        (
          select count(*)
          from public.user_daily_vocabulary_review_completions
        ),
      'support_reports', (select count(*) from public.support_reports)
    ),
    'publicTables',
    coalesce(
      (
        select jsonb_agg(tablename order by tablename)
        from pg_tables
        where schemaname = 'public'
      ),
      '[]'::jsonb
    ),
    'rlsEnabledTables',
    coalesce(
      (
        select jsonb_agg(tablename order by tablename)
        from pg_tables
        where schemaname = 'public'
          and rowsecurity
      ),
      '[]'::jsonb
    ),
    'protectedRolePrivileges',
    coalesce(
      (
        select jsonb_agg(
          table_name || ':' || role_name
          order by table_name, role_name
        )
        from protected_tables
        cross join (
          values ('anon'), ('authenticated')
        ) as roles(role_name)
        where to_regclass(format('public.%I', table_name)) is not null
          and (
            has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'SELECT'
            )
            or has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'INSERT'
            )
            or has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'UPDATE'
            )
            or has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'DELETE'
            )
            or has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'TRUNCATE'
            )
            or has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'REFERENCES'
            )
            or has_table_privilege(
              role_name,
              format('public.%I', table_name),
              'TRIGGER'
            )
          )
      ),
      '[]'::jsonb
    ),
    'serviceRoleMissingTablePrivileges',
    coalesce(
      (
        select jsonb_agg(table_name order by table_name)
        from protected_tables
        where to_regclass(format('public.%I', table_name)) is null
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'SELECT'
          )
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'INSERT'
          )
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'UPDATE'
          )
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'DELETE'
          )
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'TRUNCATE'
          )
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'REFERENCES'
          )
          or not has_table_privilege(
            'service_role',
            format('public.%I', table_name),
            'TRIGGER'
          )
      ),
      '[]'::jsonb
    ),
    'serverFunctions',
    coalesce(
      (
        select jsonb_agg(distinct proname order by proname)
        from public_functions
        where proname in (
          select function_name from required_functions
        )
      ),
      '[]'::jsonb
    ),
    'insecureServerFunctions',
    coalesce(
      (
        select jsonb_agg(distinct proname order by proname)
        from public_functions
        where has_function_privilege('anon', oid, 'EXECUTE')
          or has_function_privilege('authenticated', oid, 'EXECUTE')
      ),
      '[]'::jsonb
    ),
    'serviceRoleMissingFunctions',
    coalesce(
      (
        select jsonb_agg(function_name order by function_name)
        from required_functions required
        where not exists (
          select 1
          from public_functions actual
          where actual.proname = required.function_name
            and has_function_privilege(
              'service_role',
              actual.oid,
              'EXECUTE'
            )
        )
      ),
      '[]'::jsonb
    ),
    'extensions',
    coalesce(
      (
        select jsonb_agg(extname order by extname)
        from pg_extension
      ),
      '[]'::jsonb
    ),
    'cronJobs',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', jobname,
            'schedule', schedule,
            'active', active
          )
          order by jobname
        )
        from cron.job
        where jobname in (
          'cleanup_ai_generation_attempts',
          'cleanup_vocabulary_card_generation_attempts',
          'cleanup_support_reports'
        )
      ),
      '[]'::jsonb
    ),
    'indexes',
    coalesce(
      (
        select jsonb_agg(indexname order by indexname)
        from pg_indexes
        where schemaname = 'public'
      ),
      '[]'::jsonb
    ),
    'triggers',
    coalesce(
      (
        select jsonb_agg(t.tgname order by t.tgname)
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and not t.tgisinternal
      ),
      '[]'::jsonb
    ),
    'foreignKeyCount',
    (
      select count(*)
      from pg_constraint constraint_record
      join pg_class relation
        on relation.oid = constraint_record.conrelid
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and constraint_record.contype = 'f'
    ),
    'latestMigrationVersion',
    (
      select version
      from supabase_migrations.schema_migrations
      order by version desc
      limit 1
    )
  ) as result
)
select 'EDL_RECOVERY_VALIDATION=' || result::text
from validation;
