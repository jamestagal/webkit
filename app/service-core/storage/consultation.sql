-- SQLC query file for consultation domain operations
-- New schema with structured JSONB fields

-- Basic CRUD operations for consultations

-- name: CreateConsultation :one
INSERT INTO consultations (
    id, user_id, contact_info, business_context, pain_points, goals_objectives, status, completion_percentage
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetConsultation :one
SELECT * FROM consultations WHERE id = $1;

-- name: GetConsultationByUser :one
SELECT * FROM consultations WHERE id = $1 AND user_id = $2;

-- name: UpdateConsultation :one
UPDATE consultations SET
    contact_info = $2,
    business_context = $3,
    pain_points = $4,
    goals_objectives = $5,
    status = $6,
    completion_percentage = $7,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: UpdateConsultationStatus :one
UPDATE consultations SET
    status = $2,
    completed_at = CASE WHEN $2 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: DeleteConsultation :exec
DELETE FROM consultations WHERE id = $1;

-- Consultation listing and filtering

-- name: ListConsultationsByUser :many
SELECT * FROM consultations
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountConsultationsByUser :one
SELECT COUNT(*) FROM consultations WHERE user_id = $1;

-- name: ListConsultationsByStatus :many
SELECT * FROM consultations
WHERE user_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountConsultationsByStatus :one
SELECT COUNT(*) FROM consultations WHERE user_id = $1 AND status = $2;

-- name: ListConsultationsByDateRange :many
SELECT * FROM consultations
WHERE user_id = $1
AND created_at BETWEEN $2 AND $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListConsultationsByCompletion :many
SELECT * FROM consultations
WHERE user_id = $1
AND completion_percentage BETWEEN $2 AND $3
ORDER BY completion_percentage DESC, created_at DESC
LIMIT $4 OFFSET $5;

-- JSONB field queries for advanced filtering

-- name: GetConsultationsByBusinessName :many
SELECT * FROM consultations
WHERE user_id = $1
AND contact_info->>'business_name' ILIKE $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetConsultationsByIndustry :many
SELECT * FROM consultations
WHERE user_id = $1
AND business_context->>'industry' = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetConsultationsByUrgency :many
SELECT * FROM consultations
WHERE user_id = $1
AND pain_points->>'urgency_level' = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: SearchConsultations :many
SELECT * FROM consultations
WHERE user_id = $1
AND (
    contact_info->>'business_name' ILIKE $2 OR
    contact_info->>'contact_person' ILIKE $2 OR
    business_context->>'industry' ILIKE $2
)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- Draft management queries

-- name: CreateConsultationDraft :one
INSERT INTO consultation_drafts (
    id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives, auto_saved, draft_notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetConsultationDraft :one
SELECT * FROM consultation_drafts WHERE consultation_id = $1;

-- name: GetConsultationDraftByUser :one
SELECT * FROM consultation_drafts WHERE consultation_id = $1 AND user_id = $2;

-- name: UpdateConsultationDraft :one
UPDATE consultation_drafts SET
    contact_info = $2,
    business_context = $3,
    pain_points = $4,
    goals_objectives = $5,
    auto_saved = $6,
    draft_notes = $7,
    updated_at = CURRENT_TIMESTAMP
WHERE consultation_id = $1
RETURNING *;

-- name: UpsertConsultationDraft :one
INSERT INTO consultation_drafts (
    id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives, auto_saved, draft_notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
ON CONFLICT (consultation_id)
DO UPDATE SET
    contact_info = EXCLUDED.contact_info,
    business_context = EXCLUDED.business_context,
    pain_points = EXCLUDED.pain_points,
    goals_objectives = EXCLUDED.goals_objectives,
    auto_saved = EXCLUDED.auto_saved,
    draft_notes = EXCLUDED.draft_notes,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteConsultationDraft :exec
DELETE FROM consultation_drafts WHERE consultation_id = $1;

-- name: DeleteConsultationDraftByUser :exec
DELETE FROM consultation_drafts WHERE consultation_id = $1 AND user_id = $2;

-- name: ListOldDrafts :many
SELECT * FROM consultation_drafts
WHERE auto_saved = true
AND updated_at < $1
ORDER BY updated_at ASC
LIMIT $2;

-- name: CleanupOldDrafts :exec
DELETE FROM consultation_drafts
WHERE auto_saved = true
AND updated_at < $1;

-- Version tracking queries

-- name: CreateConsultationVersion :one
INSERT INTO consultation_versions (
    id, consultation_id, user_id, version_number, contact_info, business_context, pain_points, goals_objectives,
    status, completion_percentage, change_summary, changed_fields
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING *;

-- name: GetConsultationVersion :one
SELECT * FROM consultation_versions
WHERE consultation_id = $1 AND version_number = $2;

-- name: GetLatestConsultationVersion :one
SELECT * FROM consultation_versions
WHERE consultation_id = $1
ORDER BY version_number DESC
LIMIT 1;

-- name: ListConsultationVersions :many
SELECT * FROM consultation_versions
WHERE consultation_id = $1
ORDER BY version_number DESC
LIMIT $2 OFFSET $3;

-- name: CountConsultationVersions :one
SELECT COUNT(*) FROM consultation_versions WHERE consultation_id = $1;

-- name: GetNextVersionNumber :one
SELECT COALESCE(MAX(version_number), 0) + 1
FROM consultation_versions
WHERE consultation_id = $1;

-- name: DeleteConsultationVersions :exec
DELETE FROM consultation_versions WHERE consultation_id = $1;

-- name: DeleteOldConsultationVersions :exec
DELETE FROM consultation_versions
WHERE consultation_id = $1
AND version_number NOT IN (
    SELECT version_number
    FROM consultation_versions
    WHERE consultation_id = $1
    ORDER BY version_number DESC
    LIMIT $2
);

-- Complex queries for analytics and reporting

-- name: GetConsultationStats :one
SELECT
    COUNT(*) as total_consultations,
    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_count,
    AVG(completion_percentage) as avg_completion,
    MAX(completion_percentage) as max_completion,
    MIN(completion_percentage) as min_completion
FROM consultations
WHERE user_id = $1;

-- name: GetConsultationsByPainPointsUrgency :many
SELECT
    pain_points->>'urgency_level' as urgency,
    COUNT(*) as count
FROM consultations
WHERE user_id = $1
AND pain_points->>'urgency_level' IS NOT NULL
GROUP BY pain_points->>'urgency_level'
ORDER BY count DESC;

-- name: GetConsultationsByIndustry :many
SELECT
    business_context->>'industry' as industry,
    COUNT(*) as count
FROM consultations
WHERE user_id = $1
AND business_context->>'industry' IS NOT NULL
GROUP BY business_context->>'industry'
ORDER BY count DESC;

-- name: GetRecentConsultationActivity :many
SELECT
    id,
    contact_info->>'business_name' as business_name,
    status,
    completion_percentage,
    created_at,
    updated_at
FROM consultations
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT $2;

-- name: GetConsultationsNeedingAttention :many
SELECT * FROM consultations
WHERE user_id = $1
AND status = 'draft'
AND completion_percentage < 50
AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY created_at ASC;

-- Batch operations

-- name: UpdateMultipleConsultationStatus :exec
UPDATE consultations
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = ANY($1::uuid[]);

-- name: GetConsultationsByIds :many
SELECT * FROM consultations
WHERE id = ANY($1::uuid[])
ORDER BY created_at DESC;