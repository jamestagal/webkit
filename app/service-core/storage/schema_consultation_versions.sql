-- Consultation Versions Schema Extension
-- This file contains version tracking functionality and triggers

-- Add function to automatically create version on consultation update
create or replace function create_consultation_version()
returns trigger as $$
declare
    next_version_number integer;
    changed_fields_array jsonb := '[]'::jsonb;
begin
    -- Only create version if this is an update (not insert)
    if tg_op = 'UPDATE' then
        -- Get the next version number
        select coalesce(max(version_number), 0) + 1
        into next_version_number
        from consultation_versions
        where consultation_id = new.id;

        -- Build array of changed fields
        if old.contact_info != new.contact_info then
            changed_fields_array := changed_fields_array || '"contact_info"'::jsonb;
        end if;
        if old.business_context != new.business_context then
            changed_fields_array := changed_fields_array || '"business_context"'::jsonb;
        end if;
        if old.pain_points != new.pain_points then
            changed_fields_array := changed_fields_array || '"pain_points"'::jsonb;
        end if;
        if old.goals_objectives != new.goals_objectives then
            changed_fields_array := changed_fields_array || '"goals_objectives"'::jsonb;
        end if;
        if old.status != new.status then
            changed_fields_array := changed_fields_array || '"status"'::jsonb;
        end if;
        if old.completion_percentage != new.completion_percentage then
            changed_fields_array := changed_fields_array || '"completion_percentage"'::jsonb;
        end if;

        -- Only create version if there are actual changes
        if jsonb_array_length(changed_fields_array) > 0 then
            insert into consultation_versions (
                consultation_id,
                user_id,
                version_number,
                contact_info,
                business_context,
                pain_points,
                goals_objectives,
                status,
                completion_percentage,
                change_summary,
                changed_fields
            ) values (
                old.id,
                old.user_id,
                next_version_number,
                old.contact_info,
                old.business_context,
                old.pain_points,
                old.goals_objectives,
                old.status,
                old.completion_percentage,
                'Automatic version created on update',
                changed_fields_array
            );
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

-- Add trigger to automatically create versions
create trigger consultation_version_trigger
    after update on consultations
    for each row execute function create_consultation_version();

-- Add function to rollback to a specific version
create or replace function rollback_consultation_to_version(
    consultation_id_param uuid,
    target_version_number integer
) returns boolean as $$
declare
    version_record consultation_versions%rowtype;
    rollback_successful boolean := false;
begin
    -- Get the version data
    select * into version_record
    from consultation_versions
    where consultation_id = consultation_id_param
    and version_number = target_version_number;

    if found then
        -- Update the consultation with the version data
        update consultations set
            contact_info = version_record.contact_info,
            business_context = version_record.business_context,
            pain_points = version_record.pain_points,
            goals_objectives = version_record.goals_objectives,
            status = version_record.status,
            completion_percentage = version_record.completion_percentage,
            updated_at = current_timestamp
        where id = consultation_id_param;

        rollback_successful := true;
    end if;

    return rollback_successful;
end;
$$ language plpgsql;

-- Add function to get version differences
create or replace function get_version_differences(
    consultation_id_param uuid,
    version1 integer,
    version2 integer
) returns table(
    field_name text,
    version1_value jsonb,
    version2_value jsonb,
    has_changes boolean
) as $$
begin
    return query
    with version_data as (
        select
            v1.contact_info as v1_contact,
            v1.business_context as v1_business,
            v1.pain_points as v1_pain,
            v1.goals_objectives as v1_goals,
            v1.status as v1_status,
            v1.completion_percentage as v1_completion,
            v2.contact_info as v2_contact,
            v2.business_context as v2_business,
            v2.pain_points as v2_pain,
            v2.goals_objectives as v2_goals,
            v2.status as v2_status,
            v2.completion_percentage as v2_completion
        from consultation_versions v1
        cross join consultation_versions v2
        where v1.consultation_id = consultation_id_param
        and v1.version_number = version1
        and v2.consultation_id = consultation_id_param
        and v2.version_number = version2
    )
    select 'contact_info'::text, to_jsonb(v1_contact), to_jsonb(v2_contact), (v1_contact != v2_contact)
    from version_data
    union all
    select 'business_context'::text, to_jsonb(v1_business), to_jsonb(v2_business), (v1_business != v2_business)
    from version_data
    union all
    select 'pain_points'::text, to_jsonb(v1_pain), to_jsonb(v2_pain), (v1_pain != v2_pain)
    from version_data
    union all
    select 'goals_objectives'::text, to_jsonb(v1_goals), to_jsonb(v2_goals), (v1_goals != v2_goals)
    from version_data
    union all
    select 'status'::text, to_jsonb(v1_status), to_jsonb(v2_status), (v1_status != v2_status)
    from version_data
    union all
    select 'completion_percentage'::text, to_jsonb(v1_completion), to_jsonb(v2_completion), (v1_completion != v2_completion)
    from version_data;
end;
$$ language plpgsql;

-- Add function to purge old versions (keep only last N versions)
create or replace function purge_old_versions(
    consultation_id_param uuid,
    keep_versions integer default 10
) returns integer as $$
declare
    deleted_count integer;
begin
    delete from consultation_versions
    where consultation_id = consultation_id_param
    and version_number not in (
        select version_number
        from consultation_versions
        where consultation_id = consultation_id_param
        order by version_number desc
        limit keep_versions
    );

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$ language plpgsql;