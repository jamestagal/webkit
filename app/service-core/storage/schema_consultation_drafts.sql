-- Consultation Drafts Schema Extension
-- This file contains additional draft-specific functionality and constraints

-- Add trigger to automatically update updated_at timestamp for consultation_drafts
create or replace function update_consultation_draft_updated_at()
returns trigger as $$
begin
    new.updated_at = current_timestamp;
    return new;
end;
$$ language plpgsql;

create trigger consultation_drafts_updated_at
    before update on consultation_drafts
    for each row execute function update_consultation_draft_updated_at();

-- Add trigger to automatically update updated_at timestamp for consultations
create or replace function update_consultation_updated_at()
returns trigger as $$
begin
    new.updated_at = current_timestamp;
    return new;
end;
$$ language plpgsql;

create trigger consultations_updated_at
    before update on consultations
    for each row execute function update_consultation_updated_at();

-- Add function to calculate completion percentage based on filled fields
create or replace function calculate_completion_percentage(
    contact_info_param jsonb,
    business_context_param jsonb,
    pain_points_param jsonb,
    goals_objectives_param jsonb
) returns integer as $$
declare
    total_fields integer := 4;
    completed_fields integer := 0;
    completion_pct integer;
begin
    -- Check if contact_info has meaningful data
    if jsonb_typeof(contact_info_param) = 'object' and
       jsonb_array_length(jsonb_object_keys(contact_info_param)) > 0 then
        completed_fields := completed_fields + 1;
    end if;

    -- Check if business_context has meaningful data
    if jsonb_typeof(business_context_param) = 'object' and
       jsonb_array_length(jsonb_object_keys(business_context_param)) > 0 then
        completed_fields := completed_fields + 1;
    end if;

    -- Check if pain_points has meaningful data
    if jsonb_typeof(pain_points_param) = 'object' and
       jsonb_array_length(jsonb_object_keys(pain_points_param)) > 0 then
        completed_fields := completed_fields + 1;
    end if;

    -- Check if goals_objectives has meaningful data
    if jsonb_typeof(goals_objectives_param) = 'object' and
       jsonb_array_length(jsonb_object_keys(goals_objectives_param)) > 0 then
        completed_fields := completed_fields + 1;
    end if;

    completion_pct := (completed_fields * 100) / total_fields;
    return completion_pct;
end;
$$ language plpgsql;

-- Add function to clean up old drafts (called by background job)
create or replace function cleanup_old_drafts(older_than_days integer default 30)
returns integer as $$
declare
    deleted_count integer;
begin
    delete from consultation_drafts
    where updated_at < current_timestamp - (older_than_days || ' days')::interval
    and auto_saved = true; -- Only delete auto-saved drafts, not manually saved ones

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$ language plpgsql;