-- name: SelectToken :one
select * from tokens where id = $1;

-- name: InsertToken :one
insert into tokens (id, expires, target, callback) values ($1, $2, $3, $4) returning *;

-- name: UpdateToken :exec
update tokens set expires = $1 where id = $2 returning *;

-- name: DeleteTokens :exec
delete from tokens where expires < current_timestamp;

-- name: SelectUsers :many
select * from users;

-- name: SelectUser :one
select * from users where id = $1;

-- name: SelectUserByCustomerID :one
select * from users where customer_id = $1;

-- name: SelectUserByEmailAndSub :one
select * from users where email = $1 and sub = $2;

-- name: InsertUser :one
insert into users (id, email, access, sub, avatar, api_key) values ($1, $2, $3, $4, $5, $6) returning *;

-- name: UpdateUserPhone :exec
update users set phone = $2 where id = $1;

-- name: UpdateUserActivity :exec
update users set updated = current_timestamp where id = $1;

-- name: UpdateUserCustomerID :exec
update users set customer_id = $1 where id = $2;

-- name: UpdateUserSubscription :exec
update users set access = $1, subscription_id = $2, subscription_end = $3 where customer_id = $4;

-- name: UpdateUserAccess :one
update users set access = $1 where id = $2 returning *;

-- name: UpdateUser :one
update users set 
    email = $1, 
    phone = $2, 
    access = $3, 
    avatar = $4, 
    subscription_id = $5, 
    subscription_end = $6,
    api_key = $7,
    updated = current_timestamp
where id = $8 returning *;

-- name: SelectFiles :many
select * from files where user_id = $1;

-- name: SelectFile :one
select * from files where id = $1;

-- name: InsertFile :one
insert into files (id, user_id, file_key, file_name, file_size, content_type) values ($1, $2, $3, $4, $5, $6) returning *;

-- name: DeleteFile :exec
delete from files where id = $1;

-- name: SelectEmails :many
select * from emails where user_id = $1;

-- name: InsertEmail :one
insert into emails (id, user_id, email_to, email_from, email_subject, email_body) values ($1, $2, $3, $4, $5, $6) returning *;

-- name: SelectEmailAttachments :many
select * from email_attachments where email_id = $1;

-- name: InsertEmailAttachment :one
insert into email_attachments (id, email_id, file_name, content_type) values ($1, $2, $3, $4) returning *;

-- name: CountNotes :one
select count(*) from notes where user_id = $1;

-- name: SelectNotes :many
select * from notes where user_id = $1 order by created desc limit $2 offset $3;

-- name: SelectNote :one
select * from notes where id = $1;

-- name: InsertNote :one
insert into notes (id, user_id, title, category, content) values ($1, $2, $3, $4, $5) returning *;

-- name: UpdateNote :one
update notes set title = $1, category = $2, content = $3 where id = $4 returning *;

-- name: DeleteNote :exec
delete from notes where id = $1;

-- Consultation queries

-- name: CountConsultations :one
select count(*) from consultations where user_id = $1;

-- name: SelectConsultations :many
select * from consultations where user_id = $1 order by created desc limit $2 offset $3;

-- name: SelectConsultation :one
select * from consultations where id = $1;

-- name: SelectConsultationsByStatus :many
select * from consultations where user_id = $1 and status = $2 order by created desc limit $3 offset $4;

-- name: InsertConsultation :one
insert into consultations (
    id, user_id, business_name, contact_name, contact_title, email, phone, website,
    preferred_contact, industry, location, years_in_business, team_size, monthly_traffic,
    current_platform, business_data, challenges, goals, budget, consultation_date,
    duration_minutes, sales_rep, notes, next_steps, commitment_level, status
) values (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
) returning *;

-- name: UpdateConsultation :one
update consultations set
    business_name = $1,
    contact_name = $2,
    contact_title = $3,
    email = $4,
    phone = $5,
    website = $6,
    preferred_contact = $7,
    industry = $8,
    location = $9,
    years_in_business = $10,
    team_size = $11,
    monthly_traffic = $12,
    current_platform = $13,
    business_data = $14,
    challenges = $15,
    goals = $16,
    budget = $17,
    consultation_date = $18,
    duration_minutes = $19,
    sales_rep = $20,
    notes = $21,
    next_steps = $22,
    commitment_level = $23,
    status = $24,
    updated = current_timestamp
where id = $25 returning *;

-- name: UpdateConsultationStatus :one
update consultations set status = $1, updated = current_timestamp where id = $2 returning *;

-- name: DeleteConsultation :exec
delete from consultations where id = $1;

-- Consultation Draft queries

-- name: SelectConsultationDraft :one
select * from consultation_drafts where consultation_id = $1 and user_id = $2;

-- name: InsertConsultationDraft :one
insert into consultation_drafts (id, consultation_id, user_id, draft_data)
values ($1, $2, $3, $4) returning *;

-- name: UpdateConsultationDraft :one
update consultation_drafts set
    draft_data = $1,
    updated = current_timestamp
where consultation_id = $2 and user_id = $3 returning *;

-- name: UpsertConsultationDraft :one
insert into consultation_drafts (id, consultation_id, user_id, draft_data)
values ($1, $2, $3, $4)
on conflict (consultation_id, user_id)
do update set
    draft_data = excluded.draft_data,
    updated = current_timestamp
returning *;

-- name: DeleteConsultationDraft :exec
delete from consultation_drafts where consultation_id = $1 and user_id = $2;

-- Consultation Version queries

-- name: SelectConsultationVersions :many
select * from consultation_versions where consultation_id = $1 order by version_number desc;

-- name: SelectConsultationVersion :one
select * from consultation_versions where consultation_id = $1 and version_number = $2;

-- name: GetLatestVersionNumber :one
select coalesce(max(version_number), 0) from consultation_versions where consultation_id = $1;

-- name: InsertConsultationVersion :one
insert into consultation_versions (id, consultation_id, user_id, version_number, version_data, change_description)
values ($1, $2, $3, $4, $5, $6) returning *;

-- name: DeleteConsultationVersions :exec
delete from consultation_versions where consultation_id = $1;
