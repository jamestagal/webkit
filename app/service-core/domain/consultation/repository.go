package consultation

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"service-core/storage/query"
)

// Repository interface defines all consultation-related data operations
type Repository interface {
	// Consultation CRUD operations
	CountConsultations(ctx context.Context, userID uuid.UUID) (int64, error)
	SelectConsultations(ctx context.Context, params query.ListConsultationsByUserParams) ([]query.Consultation, error)
	SelectConsultationsByStatus(ctx context.Context, params query.ListConsultationsByStatusParams) ([]query.Consultation, error)
	SelectConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error)
	InsertConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error)
	UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error)
	UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error)
	DeleteConsultation(ctx context.Context, id uuid.UUID) error

	// Consultation Draft operations
	SelectConsultationDraft(ctx context.Context, params query.GetConsultationDraftByUserParams) (query.ConsultationDraft, error)
	InsertConsultationDraft(ctx context.Context, params query.CreateConsultationDraftParams) (query.ConsultationDraft, error)
	UpdateConsultationDraft(ctx context.Context, params query.UpdateConsultationDraftParams) (query.ConsultationDraft, error)
	UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error)
	DeleteConsultationDraft(ctx context.Context, consultationID uuid.UUID) error
	DeleteConsultationDraftByUser(ctx context.Context, params query.DeleteConsultationDraftByUserParams) error
	CleanupOldDrafts(ctx context.Context, params CleanupOldDraftsParams) error

	// Consultation Version operations
	SelectConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error)
	SelectConsultationVersion(ctx context.Context, params query.GetConsultationVersionParams) (query.ConsultationVersion, error)
	GetLatestVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error)
	InsertConsultationVersion(ctx context.Context, params query.CreateConsultationVersionParams) (query.ConsultationVersion, error)
	DeleteConsultationVersions(ctx context.Context, consultationID uuid.UUID) error

	// Advanced filtering operations
	GetConsultationsByBusinessName(ctx context.Context, params query.GetConsultationsByBusinessNameParams) ([]query.Consultation, error)
	GetConsultationsByIndustry(ctx context.Context, params query.GetConsultationsByIndustryParams) ([]query.Consultation, error)
	GetConsultationsByUrgency(ctx context.Context, params query.GetConsultationsByUrgencyParams) ([]query.Consultation, error)
	SearchConsultations(ctx context.Context, params query.SearchConsultationsParams) ([]query.Consultation, error)
	ListConsultationsByCompletion(ctx context.Context, params query.ListConsultationsByCompletionParams) ([]query.Consultation, error)
	ListConsultationsByDateRange(ctx context.Context, params query.ListConsultationsByDateRangeParams) ([]query.Consultation, error)

	// User operations (for joining with consultation data)
	SelectUser(ctx context.Context, id uuid.UUID) (query.User, error)
}

// DraftRepository interface for draft-specific operations with business logic
type DraftRepository interface {
	// Auto-save functionality
	AutoSave(ctx context.Context, consultationID, userID uuid.UUID, draftData map[string]interface{}) error
	GetAutoSavedDraft(ctx context.Context, consultationID, userID uuid.UUID) (*ConsultationDraft, error)

	// Draft management
	PromoteDraftToConsultation(ctx context.Context, consultationID, userID uuid.UUID) (*Consultation, error)
	HasConflictingDraft(ctx context.Context, consultationID, userID uuid.UUID, lastModified time.Time) (bool, error)

	// Cleanup operations
	CleanupAbandonedDrafts(ctx context.Context, olderThan time.Time) error
	GetDraftsSummary(ctx context.Context, userID uuid.UUID) ([]DraftSummary, error)
}

// VersionRepository interface for version-specific operations with business logic
type VersionRepository interface {
	// Version tracking
	CreateVersionFromConsultation(ctx context.Context, consultation *Consultation, changeSummary string, changedFields []string) (*ConsultationVersion, error)
	GetVersionHistory(ctx context.Context, consultationID uuid.UUID, limit, offset int32) ([]ConsultationVersion, error)
	CompareVersions(ctx context.Context, consultationID uuid.UUID, version1, version2 int32) (*VersionComparison, error)

	// Rollback functionality
	RollbackToVersion(ctx context.Context, consultationID uuid.UUID, versionNumber int32, userID uuid.UUID) (*Consultation, error)
	DetectChanges(ctx context.Context, current, previous *Consultation) ([]string, error)
}

// repositoryImpl implements the Repository interface using sqlc generated queries
type repositoryImpl struct {
	querier query.Querier
}

// NewRepository creates a new consultation repository
func NewRepository(querier query.Querier) Repository {
	return &repositoryImpl{
		querier: querier,
	}
}

// Consultation CRUD operations
func (r *repositoryImpl) CountConsultations(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.querier.CountConsultationsByUser(ctx, userID)
}

func (r *repositoryImpl) SelectConsultations(ctx context.Context, params query.ListConsultationsByUserParams) ([]query.Consultation, error) {
	return r.querier.ListConsultationsByUser(ctx, params)
}

func (r *repositoryImpl) SelectConsultationsByStatus(ctx context.Context, params query.ListConsultationsByStatusParams) ([]query.Consultation, error) {
	return r.querier.ListConsultationsByStatus(ctx, params)
}

func (r *repositoryImpl) SelectConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error) {
	return r.querier.GetConsultation(ctx, id)
}

func (r *repositoryImpl) InsertConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error) {
	return r.querier.CreateConsultation(ctx, params)
}

func (r *repositoryImpl) UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error) {
	return r.querier.UpdateConsultation(ctx, params)
}

func (r *repositoryImpl) UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error) {
	return r.querier.UpdateConsultationStatus(ctx, params)
}

func (r *repositoryImpl) DeleteConsultation(ctx context.Context, id uuid.UUID) error {
	return r.querier.DeleteConsultation(ctx, id)
}

// Consultation Draft operations
func (r *repositoryImpl) SelectConsultationDraft(ctx context.Context, params query.GetConsultationDraftByUserParams) (query.ConsultationDraft, error) {
	return r.querier.GetConsultationDraftByUser(ctx, params)
}

func (r *repositoryImpl) InsertConsultationDraft(ctx context.Context, params query.CreateConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.CreateConsultationDraft(ctx, params)
}

func (r *repositoryImpl) UpdateConsultationDraft(ctx context.Context, params query.UpdateConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.UpdateConsultationDraft(ctx, params)
}

func (r *repositoryImpl) UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.UpsertConsultationDraft(ctx, params)
}

func (r *repositoryImpl) DeleteConsultationDraft(ctx context.Context, consultationID uuid.UUID) error {
	return r.querier.DeleteConsultationDraft(ctx, consultationID)
}

func (r *repositoryImpl) DeleteConsultationDraftByUser(ctx context.Context, params query.DeleteConsultationDraftByUserParams) error {
	return r.querier.DeleteConsultationDraftByUser(ctx, params)
}

func (r *repositoryImpl) CleanupOldDrafts(ctx context.Context, params CleanupOldDraftsParams) error {
	return r.querier.CleanupOldDrafts(ctx, params.UpdatedAt)
}

// Consultation Version operations
func (r *repositoryImpl) SelectConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error) {
	params := query.ListConsultationVersionsParams{
		ConsultationID: consultationID,
		Limit:          100, // Default limit
		Offset:         0,
	}
	return r.querier.ListConsultationVersions(ctx, params)
}

func (r *repositoryImpl) SelectConsultationVersion(ctx context.Context, params query.GetConsultationVersionParams) (query.ConsultationVersion, error) {
	return r.querier.GetConsultationVersion(ctx, params)
}

func (r *repositoryImpl) GetLatestVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error) {
	return r.querier.GetNextVersionNumber(ctx, consultationID)
}

func (r *repositoryImpl) InsertConsultationVersion(ctx context.Context, params query.CreateConsultationVersionParams) (query.ConsultationVersion, error) {
	return r.querier.CreateConsultationVersion(ctx, params)
}

func (r *repositoryImpl) DeleteConsultationVersions(ctx context.Context, consultationID uuid.UUID) error {
	return r.querier.DeleteConsultationVersions(ctx, consultationID)
}

// Advanced filtering operations
func (r *repositoryImpl) GetConsultationsByBusinessName(ctx context.Context, params query.GetConsultationsByBusinessNameParams) ([]query.Consultation, error) {
	return r.querier.GetConsultationsByBusinessName(ctx, params)
}

func (r *repositoryImpl) GetConsultationsByIndustry(ctx context.Context, params query.GetConsultationsByIndustryParams) ([]query.Consultation, error) {
	return r.querier.GetConsultationsByIndustry(ctx, params)
}

func (r *repositoryImpl) GetConsultationsByUrgency(ctx context.Context, params query.GetConsultationsByUrgencyParams) ([]query.Consultation, error) {
	return r.querier.GetConsultationsByUrgency(ctx, params)
}

func (r *repositoryImpl) SearchConsultations(ctx context.Context, params query.SearchConsultationsParams) ([]query.Consultation, error) {
	return r.querier.SearchConsultations(ctx, params)
}

func (r *repositoryImpl) ListConsultationsByCompletion(ctx context.Context, params query.ListConsultationsByCompletionParams) ([]query.Consultation, error) {
	return r.querier.ListConsultationsByCompletion(ctx, params)
}

func (r *repositoryImpl) ListConsultationsByDateRange(ctx context.Context, params query.ListConsultationsByDateRangeParams) ([]query.Consultation, error) {
	return r.querier.ListConsultationsByDateRange(ctx, params)
}

// User operations
func (r *repositoryImpl) SelectUser(ctx context.Context, id uuid.UUID) (query.User, error) {
	return r.querier.SelectUser(ctx, id)
}

// Draft management repository implementation
type draftRepositoryImpl struct {
	querier query.Querier
}

// NewDraftRepository creates a new draft repository with business logic
func NewDraftRepository(querier query.Querier) DraftRepository {
	return &draftRepositoryImpl{
		querier: querier,
	}
}

func (d *draftRepositoryImpl) AutoSave(ctx context.Context, consultationID, userID uuid.UUID, draftData map[string]interface{}) error {
	// Marshal the draft data to appropriate JSONB fields
	var contactInfo, businessContext, painPoints, goalsObjectives json.RawMessage
	var err error

	if ci, ok := draftData["contact_info"]; ok {
		contactInfo, err = json.Marshal(ci)
		if err != nil {
			return fmt.Errorf("marshal contact_info: %w", err)
		}
	} else {
		contactInfo = json.RawMessage("{}")
	}

	if bc, ok := draftData["business_context"]; ok {
		businessContext, err = json.Marshal(bc)
		if err != nil {
			return fmt.Errorf("marshal business_context: %w", err)
		}
	} else {
		businessContext = json.RawMessage("{}")
	}

	if pp, ok := draftData["pain_points"]; ok {
		painPoints, err = json.Marshal(pp)
		if err != nil {
			return fmt.Errorf("marshal pain_points: %w", err)
		}
	} else {
		painPoints = json.RawMessage("{}")
	}

	if go_obj, ok := draftData["goals_objectives"]; ok {
		goalsObjectives, err = json.Marshal(go_obj)
		if err != nil {
			return fmt.Errorf("marshal goals_objectives: %w", err)
		}
	} else {
		goalsObjectives = json.RawMessage("{}")
	}

	params := query.UpsertConsultationDraftParams{
		ID:              uuid.New(),
		ConsultationID:  consultationID,
		UserID:          userID,
		ContactInfo:     contactInfo,
		BusinessContext: businessContext,
		PainPoints:      painPoints,
		GoalsObjectives: goalsObjectives,
		AutoSaved:       true,
		DraftNotes:      sql.NullString{String: fmt.Sprintf("Auto-saved at %s", time.Now().Format("15:04:05")), Valid: true},
	}

	_, err = d.querier.UpsertConsultationDraft(ctx, params)
	return err
}

func (d *draftRepositoryImpl) GetAutoSavedDraft(ctx context.Context, consultationID, userID uuid.UUID) (*ConsultationDraft, error) {
	params := query.GetConsultationDraftByUserParams{
		ConsultationID: consultationID,
		UserID:         userID,
	}

	draft, err := d.querier.GetConsultationDraftByUser(ctx, params)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No draft found
		}
		return nil, err
	}

	// Convert to domain model
	domainDraft := &ConsultationDraft{
		ConsultationDraft: draft,
	}

	// Parse the JSON fields
	if err := domainDraft.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse draft JSON fields: %w", err)
	}

	return domainDraft, nil
}

func (d *draftRepositoryImpl) PromoteDraftToConsultation(ctx context.Context, consultationID, userID uuid.UUID) (*Consultation, error) {
	// Get the draft first
	draft, err := d.GetAutoSavedDraft(ctx, consultationID, userID)
	if err != nil {
		return nil, fmt.Errorf("get draft: %w", err)
	}
	if draft == nil {
		return nil, fmt.Errorf("no draft found for consultation %s", consultationID)
	}

	// Check if consultation already exists
	_, err = d.querier.GetConsultation(ctx, consultationID)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("check existing consultation: %w", err)
	}

	var consultation query.Consultation
	if err == sql.ErrNoRows {
		// Create new consultation from draft
		params := query.CreateConsultationParams{
			ID:                   consultationID,
			UserID:               userID,
			ContactInfo:          draft.ContactInfo,
			BusinessContext:      draft.BusinessContext,
			PainPoints:           draft.PainPoints,
			GoalsObjectives:      draft.GoalsObjectives,
			Status:               string(StatusDraft),
			CompletionPercentage: 0,
		}
		consultation, err = d.querier.CreateConsultation(ctx, params)
		if err != nil {
			return nil, fmt.Errorf("create consultation from draft: %w", err)
		}
	} else {
		// Update existing consultation with draft data
		params := query.UpdateConsultationParams{
			ID:              consultationID,
			ContactInfo:     draft.ContactInfo,
			BusinessContext: draft.BusinessContext,
			PainPoints:      draft.PainPoints,
			GoalsObjectives: draft.GoalsObjectives,
		}
		consultation, err = d.querier.UpdateConsultation(ctx, params)
		if err != nil {
			return nil, fmt.Errorf("update consultation from draft: %w", err)
		}
	}

	// Delete the draft after successful promotion
	err = d.querier.DeleteConsultationDraft(ctx, consultationID)
	if err != nil {
		// Log error but don't fail the operation
		// The consultation was successfully created/updated
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: consultation,
	}

	// Parse the JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	return domainConsultation, nil
}

func (d *draftRepositoryImpl) HasConflictingDraft(ctx context.Context, consultationID, userID uuid.UUID, lastModified time.Time) (bool, error) {
	draft, err := d.GetAutoSavedDraft(ctx, consultationID, userID)
	if err != nil {
		return false, err
	}
	if draft == nil {
		return false, nil
	}

	// Check if draft was modified after the given time
	if draft.UpdatedAt.After(lastModified) {
		return true, nil
	}

	return false, nil
}

func (d *draftRepositoryImpl) CleanupAbandonedDrafts(ctx context.Context, olderThan time.Time) error {
	return d.querier.CleanupOldDrafts(ctx, olderThan)
}

func (d *draftRepositoryImpl) GetDraftsSummary(ctx context.Context, userID uuid.UUID) ([]DraftSummary, error) {
	// This would need a custom query in SQLC to get draft summaries
	// For now, return empty slice as this is a business-level operation
	return []DraftSummary{}, nil
}

// Version management repository implementation
type versionRepositoryImpl struct {
	querier query.Querier
}

// NewVersionRepository creates a new version repository with business logic
func NewVersionRepository(querier query.Querier) VersionRepository {
	return &versionRepositoryImpl{
		querier: querier,
	}
}

func (v *versionRepositoryImpl) CreateVersionFromConsultation(ctx context.Context, consultation *Consultation, changeSummary string, changedFields []string) (*ConsultationVersion, error) {
	// Get next version number
	nextVersion, err := v.querier.GetNextVersionNumber(ctx, consultation.ID)
	if err != nil {
		return nil, fmt.Errorf("get next version number: %w", err)
	}

	// Marshal changed fields
	changedFieldsJSON, err := json.Marshal(changedFields)
	if err != nil {
		return nil, fmt.Errorf("marshal changed fields: %w", err)
	}

	params := query.CreateConsultationVersionParams{
		ID:                   uuid.New(),
		ConsultationID:       consultation.ID,
		UserID:               consultation.UserID,
		VersionNumber:        nextVersion,
		ContactInfo:          consultation.ContactInfo,
		BusinessContext:      consultation.BusinessContext,
		PainPoints:           consultation.PainPoints,
		GoalsObjectives:      consultation.GoalsObjectives,
		Status:               consultation.Status,
		CompletionPercentage: consultation.CompletionPercentage,
		ChangeSummary:        sql.NullString{String: changeSummary, Valid: changeSummary != ""},
	}

	// Set changed fields if provided
	if len(changedFields) > 0 {
		params.ChangedFields = changedFieldsJSON
	}

	version, err := v.querier.CreateConsultationVersion(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create consultation version: %w", err)
	}

	// Convert to domain model
	domainVersion := &ConsultationVersion{
		ConsultationVersion: version,
	}

	// Parse the JSON fields
	if err := domainVersion.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse version JSON fields: %w", err)
	}

	return domainVersion, nil
}

func (v *versionRepositoryImpl) GetVersionHistory(ctx context.Context, consultationID uuid.UUID, limit, offset int32) ([]ConsultationVersion, error) {
	params := query.ListConsultationVersionsParams{
		ConsultationID: consultationID,
		Limit:          limit,
		Offset:         offset,
	}

	versions, err := v.querier.ListConsultationVersions(ctx, params)
	if err != nil {
		return nil, err
	}

	// Convert to domain models
	domainVersions := make([]ConsultationVersion, len(versions))
	for i, version := range versions {
		domainVersions[i] = ConsultationVersion{
			ConsultationVersion: version,
		}
		// Parse JSON fields
		if err := domainVersions[i].ParseAllJSONFields(); err != nil {
			return nil, fmt.Errorf("parse version %d JSON fields: %w", version.VersionNumber, err)
		}
	}

	return domainVersions, nil
}

func (v *versionRepositoryImpl) CompareVersions(ctx context.Context, consultationID uuid.UUID, version1, version2 int32) (*VersionComparison, error) {
	// Get both versions
	params1 := query.GetConsultationVersionParams{
		ConsultationID: consultationID,
		VersionNumber:  version1,
	}
	params2 := query.GetConsultationVersionParams{
		ConsultationID: consultationID,
		VersionNumber:  version2,
	}

	v1, err := v.querier.GetConsultationVersion(ctx, params1)
	if err != nil {
		return nil, fmt.Errorf("get version %d: %w", version1, err)
	}

	v2, err := v.querier.GetConsultationVersion(ctx, params2)
	if err != nil {
		return nil, fmt.Errorf("get version %d: %w", version2, err)
	}

	// Create comparison - would implement detailed comparison logic
	comparison := &VersionComparison{
		ConsultationID: consultationID,
		Version1:       version1,
		Version2:       version2,
		Changes:        make(map[string]interface{}),
	}

	// For now, just note that both versions exist
	if v1.ID != uuid.Nil && v2.ID != uuid.Nil {
		comparison.Changes["status"] = "comparison_available"
	}

	return comparison, nil
}

func (v *versionRepositoryImpl) RollbackToVersion(ctx context.Context, consultationID uuid.UUID, versionNumber int32, userID uuid.UUID) (*Consultation, error) {
	// Get the target version
	params := query.GetConsultationVersionParams{
		ConsultationID: consultationID,
		VersionNumber:  versionNumber,
	}

	version, err := v.querier.GetConsultationVersion(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("get version %d: %w", versionNumber, err)
	}

	// Update consultation with version data
	updateParams := query.UpdateConsultationParams{
		ID:              consultationID,
		ContactInfo:     version.ContactInfo,
		BusinessContext: version.BusinessContext,
		PainPoints:      version.PainPoints,
		GoalsObjectives: version.GoalsObjectives,
		Status:          version.Status,
	}

	consultation, err := v.querier.UpdateConsultation(ctx, updateParams)
	if err != nil {
		return nil, fmt.Errorf("update consultation from version: %w", err)
	}

	// Create a new version documenting the rollback
	rollbackSummary := fmt.Sprintf("Rolled back to version %d", versionNumber)
	changedFields := []string{"contact_info", "business_context", "pain_points", "goals_objectives", "status"}

	domainConsultation := &Consultation{Consultation: consultation}
	_, err = v.CreateVersionFromConsultation(ctx, domainConsultation, rollbackSummary, changedFields)
	if err != nil {
		// Log error but don't fail the rollback
	}

	// Parse JSON fields before returning
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	return domainConsultation, nil
}

func (v *versionRepositoryImpl) DetectChanges(ctx context.Context, current, previous *Consultation) ([]string, error) {
	var changedFields []string

	// Compare contact info
	if string(current.ContactInfo) != string(previous.ContactInfo) {
		changedFields = append(changedFields, "contact_info")
	}

	// Compare business context
	if string(current.BusinessContext) != string(previous.BusinessContext) {
		changedFields = append(changedFields, "business_context")
	}

	// Compare pain points
	if string(current.PainPoints) != string(previous.PainPoints) {
		changedFields = append(changedFields, "pain_points")
	}

	// Compare goals objectives
	if string(current.GoalsObjectives) != string(previous.GoalsObjectives) {
		changedFields = append(changedFields, "goals_objectives")
	}

	// Compare status
	if current.Status != previous.Status {
		changedFields = append(changedFields, "status")
	}

	// Compare completion percentage
	if current.CompletionPercentage != previous.CompletionPercentage {
		changedFields = append(changedFields, "completion_percentage")
	}

	return changedFields, nil
}

// Additional types for business operations
type DraftSummary struct {
	ConsultationID uuid.UUID `json:"consultation_id"`
	LastModified   time.Time `json:"last_modified"`
	BusinessName   string    `json:"business_name"`
	StepCompleted  int       `json:"step_completed"`
}

type VersionComparison struct {
	ConsultationID uuid.UUID              `json:"consultation_id"`
	Version1       int32                  `json:"version1"`
	Version2       int32                  `json:"version2"`
	Changes        map[string]interface{} `json:"changes"`
}

// CleanupOldDraftsParams represents parameters for cleaning up old drafts
type CleanupOldDraftsParams struct {
	UpdatedAt time.Time `json:"updated_at"`
}