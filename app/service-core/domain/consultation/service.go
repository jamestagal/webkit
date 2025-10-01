package consultation

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"service-core/storage/query"
)

// ConsultationService defines the business logic interface for consultation operations
type ConsultationService interface {
	// Core CRUD operations
	CreateConsultation(ctx context.Context, input *CreateConsultationInput) (*Consultation, error)
	GetConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error)
	GetConsultationWithValidation(ctx context.Context, id uuid.UUID) (*Consultation, error)
	UpdateConsultation(ctx context.Context, id uuid.UUID, input *UpdateConsultationInput) (*Consultation, error)
	DeleteConsultation(ctx context.Context, id uuid.UUID) error

	// Listing and filtering
	ListConsultations(ctx context.Context, params *ListConsultationsParams) (*ConsultationsResponse, error)
	ListConsultationsByStatus(ctx context.Context, userID uuid.UUID, status ConsultationStatus, page, limit int32) (*ConsultationsResponse, error)
	SearchConsultations(ctx context.Context, userID uuid.UUID, query string, page, limit int32) (*ConsultationsResponse, error)

	// Validation methods
	ValidateContactInfo(contactInfo *ContactInfo) error
	ValidateBusinessContext(businessContext *BusinessContext) error
	ValidatePainPoints(painPoints *PainPoints) error
	ValidateGoalsObjectives(goalsObjectives *GoalsObjectives) error
	ValidateStatusTransition(from, to ConsultationStatus) error
	ValidateConsultationCompletion(consultation *Consultation) error

	// Consultation lifecycle management
	CompleteConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error)
	ArchiveConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error)
	RestoreConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error)

	// Draft management
	AutoSaveDraft(ctx context.Context, consultationID, userID uuid.UUID, draftData map[string]interface{}) error
	GetDraft(ctx context.Context, consultationID, userID uuid.UUID) (*ConsultationDraft, error)
	PromoteDraftToConsultation(ctx context.Context, consultationID, userID uuid.UUID) (*Consultation, error)
	DeleteDraft(ctx context.Context, consultationID, userID uuid.UUID) error

	// Version management
	CreateVersion(ctx context.Context, consultationID uuid.UUID, changeSummary string, changedFields []string) (*ConsultationVersion, error)
	GetVersionHistory(ctx context.Context, consultationID uuid.UUID, page, limit int32) (*ConsultationVersionsResponse, error)
	RollbackToVersion(ctx context.Context, consultationID uuid.UUID, versionNumber int32, userID uuid.UUID) (*Consultation, error)

	// Business logic helpers
	CalculateCompletionPercentage(consultation *Consultation) int32
	GetConsultationProgress(ctx context.Context, id uuid.UUID) (*ConsultationProgress, error)
	DetectChangedFields(current, previous *Consultation) []string

	// Bulk operations
	BulkArchiveConsultations(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error
	BulkDeleteConsultations(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error

	// Analytics and reporting
	GetConsultationStats(ctx context.Context, userID uuid.UUID) (*ConsultationStats, error)
	GetCompletionRateByPeriod(ctx context.Context, userID uuid.UUID, period string) (*CompletionRateStats, error)
}

// consultationServiceImpl implements the ConsultationService interface
type consultationServiceImpl struct {
	repo    Repository
	draft   DraftRepository
	version VersionRepository
}

// NewConsultationService creates a new consultation service instance
func NewConsultationService(repo Repository, draft DraftRepository, version VersionRepository) ConsultationService {
	return &consultationServiceImpl{
		repo:    repo,
		draft:   draft,
		version: version,
	}
}

// Core CRUD operations

func (s *consultationServiceImpl) CreateConsultation(ctx context.Context, input *CreateConsultationInput) (*Consultation, error) {
	// Validate input
	if err := s.validateCreateInput(input); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Validate individual sections if provided
	if input.ContactInfo != nil {
		if err := s.ValidateContactInfo(input.ContactInfo); err != nil {
			return nil, fmt.Errorf("contact info validation failed: %w", err)
		}
	}

	if input.BusinessContext != nil {
		if err := s.ValidateBusinessContext(input.BusinessContext); err != nil {
			return nil, fmt.Errorf("business context validation failed: %w", err)
		}
	}

	if input.PainPoints != nil {
		if err := s.ValidatePainPoints(input.PainPoints); err != nil {
			return nil, fmt.Errorf("pain points validation failed: %w", err)
		}
	}

	if input.GoalsObjectives != nil {
		if err := s.ValidateGoalsObjectives(input.GoalsObjectives); err != nil {
			return nil, fmt.Errorf("goals objectives validation failed: %w", err)
		}
	}

	// Convert input to create parameters
	params, err := input.ToCreateParams()
	if err != nil {
		return nil, fmt.Errorf("convert input to params: %w", err)
	}

	// Create consultation in repository
	consultation, err := s.repo.InsertConsultation(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("create consultation: %w", err)
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: consultation,
	}

	// Parse JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	return domainConsultation, nil
}

func (s *consultationServiceImpl) GetConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error) {
	consultation, err := s.repo.SelectConsultation(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("consultation not found")
		}
		return nil, fmt.Errorf("get consultation: %w", err)
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: consultation,
	}

	// Parse JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	return domainConsultation, nil
}

func (s *consultationServiceImpl) GetConsultationWithValidation(ctx context.Context, id uuid.UUID) (*Consultation, error) {
	consultation, err := s.GetConsultation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Validate data integrity
	if err := s.ValidateConsultationCompletion(consultation); err != nil {
		// Log warning but don't fail - data integrity issues should be flagged but not block access
		// In a real implementation, this would use structured logging
		// log.Warn("consultation data integrity issue", "id", id, "error", err)
	}

	return consultation, nil
}

func (s *consultationServiceImpl) UpdateConsultation(ctx context.Context, id uuid.UUID, input *UpdateConsultationInput) (*Consultation, error) {
	// Get existing consultation
	current, err := s.GetConsultation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Validate status transition if status is being updated
	if input.Status != nil {
		currentStatus := ConsultationStatus(current.Status)
		if err := s.ValidateStatusTransition(currentStatus, *input.Status); err != nil {
			return nil, fmt.Errorf("invalid status transition: %w", err)
		}
	}

	// Validate updated sections
	if input.ContactInfo != nil {
		if err := s.ValidateContactInfo(input.ContactInfo); err != nil {
			return nil, fmt.Errorf("contact info validation failed: %w", err)
		}
	}

	if input.BusinessContext != nil {
		if err := s.ValidateBusinessContext(input.BusinessContext); err != nil {
			return nil, fmt.Errorf("business context validation failed: %w", err)
		}
	}

	if input.PainPoints != nil {
		if err := s.ValidatePainPoints(input.PainPoints); err != nil {
			return nil, fmt.Errorf("pain points validation failed: %w", err)
		}
	}

	if input.GoalsObjectives != nil {
		if err := s.ValidateGoalsObjectives(input.GoalsObjectives); err != nil {
			return nil, fmt.Errorf("goals objectives validation failed: %w", err)
		}
	}

	// Convert input to update parameters
	params, err := input.ToUpdateParams(id, current)
	if err != nil {
		return nil, fmt.Errorf("convert input to params: %w", err)
	}

	// Update consultation in repository
	updated, err := s.repo.UpdateConsultation(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update consultation: %w", err)
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: updated,
	}

	// Parse JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	// Create version for the update
	changedFields := s.DetectChangedFields(domainConsultation, current)
	if len(changedFields) > 0 {
		changeSummary := fmt.Sprintf("Updated fields: %s", strings.Join(changedFields, ", "))
		_, err := s.version.CreateVersionFromConsultation(ctx, domainConsultation, changeSummary, changedFields)
		if err != nil {
			// Log error but don't fail the update
			// log.Error("failed to create version", "consultation_id", id, "error", err)
		}
	}

	return domainConsultation, nil
}

func (s *consultationServiceImpl) DeleteConsultation(ctx context.Context, id uuid.UUID) error {
	// Check if consultation exists
	_, err := s.GetConsultation(ctx, id)
	if err != nil {
		return err
	}

	// Delete consultation (this should cascade to versions and drafts)
	return s.repo.DeleteConsultation(ctx, id)
}

// Listing and filtering methods

func (s *consultationServiceImpl) ListConsultations(ctx context.Context, params *ListConsultationsParams) (*ConsultationsResponse, error) {
	if err := s.validateListParams(params); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Get total count
	count, err := s.repo.CountConsultations(ctx, params.UserID)
	if err != nil {
		return nil, fmt.Errorf("count consultations: %w", err)
	}

	// Get consultations based on status filter
	var consultations []query.Consultation
	if params.Status != nil {
		statusParams := params.ToStatusQueryParams()
		consultations, err = s.repo.SelectConsultationsByStatus(ctx, statusParams)
	} else {
		queryParams := params.ToQueryParams()
		consultations, err = s.repo.SelectConsultations(ctx, queryParams)
	}

	if err != nil {
		return nil, fmt.Errorf("list consultations: %w", err)
	}

	// Convert to summary format
	summaries := make([]*ConsultationSummary, len(consultations))
	for i, consultation := range consultations {
		domainConsultation := &Consultation{Consultation: consultation}
		_ = domainConsultation.ParseAllJSONFields() // Ignore errors for summary
		summaries[i] = domainConsultation.ToSummary()
	}

	return ConsultationsToResponse(summaries, count), nil
}

func (s *consultationServiceImpl) ListConsultationsByStatus(ctx context.Context, userID uuid.UUID, status ConsultationStatus, page, limit int32) (*ConsultationsResponse, error) {
	params := &ListConsultationsParams{
		UserID: userID,
		Page:   page,
		Limit:  limit,
		Status: &status,
	}

	return s.ListConsultations(ctx, params)
}

func (s *consultationServiceImpl) SearchConsultations(ctx context.Context, userID uuid.UUID, query string, page, limit int32) (*ConsultationsResponse, error) {
	if query == "" {
		return &ConsultationsResponse{Count: 0, Consultations: []*ConsultationSummary{}}, nil
	}

	// This would use the search functionality from the repository
	// For now, return empty result as the search queries would need to be implemented
	return &ConsultationsResponse{Count: 0, Consultations: []*ConsultationSummary{}}, nil
}

// Validation methods

func (s *consultationServiceImpl) ValidateContactInfo(contactInfo *ContactInfo) error {
	if contactInfo == nil {
		return nil
	}

	// Business name is required
	if strings.TrimSpace(contactInfo.BusinessName) == "" {
		return errors.New("business_name is required")
	}

	// Validate email format if provided
	if contactInfo.Email != "" {
		if _, err := mail.ParseAddress(contactInfo.Email); err != nil {
			return errors.New("invalid email format")
		}
	}

	// Validate website URL if provided
	if contactInfo.Website != "" {
		if _, err := url.ParseRequestURI(contactInfo.Website); err != nil {
			return errors.New("invalid website URL")
		}
	}

	// Validate phone format if provided (basic validation)
	// Allow international format (+) and local formats (including those starting with 0)
	if contactInfo.Phone != "" {
		phoneRegex := regexp.MustCompile(`^[\+]?[\d\-\s\(\)]{7,20}$`)
		if !phoneRegex.MatchString(contactInfo.Phone) {
			slog.Error("Phone validation failed", "phone", contactInfo.Phone, "length", len(contactInfo.Phone))
			return errors.New("invalid phone number format")
		}
	}

	return nil
}

func (s *consultationServiceImpl) ValidateBusinessContext(businessContext *BusinessContext) error {
	if businessContext == nil {
		return nil
	}

	// Industry is required
	if strings.TrimSpace(businessContext.Industry) == "" {
		return errors.New("industry is required")
	}

	// Team size must be positive if provided
	if businessContext.TeamSize != nil && *businessContext.TeamSize <= 0 {
		return errors.New("team_size must be positive")
	}

	// Validate current platform if provided
	if businessContext.CurrentPlatform != "" {
		validPlatforms := []string{"wordpress", "shopify", "wix", "squarespace", "drupal", "joomla", "custom", "other"}
		platform := strings.ToLower(businessContext.CurrentPlatform)
		valid := false
		for _, validPlatform := range validPlatforms {
			if platform == validPlatform {
				valid = true
				break
			}
		}
		if !valid {
			return errors.New("invalid current_platform")
		}
	}

	return nil
}

func (s *consultationServiceImpl) ValidatePainPoints(painPoints *PainPoints) error {
	if painPoints == nil {
		return nil
	}

	// At least one primary challenge is required if pain points section is provided
	if len(painPoints.PrimaryChallenges) == 0 {
		return errors.New("at least one primary challenge is required")
	}

	// Validate urgency level
	if painPoints.UrgencyLevel != "" && !painPoints.UrgencyLevel.IsValid() {
		return errors.New("invalid urgency level")
	}

	// Validate that challenges are not empty strings
	for _, challenge := range painPoints.PrimaryChallenges {
		if strings.TrimSpace(challenge) == "" {
			return errors.New("primary challenges cannot be empty")
		}
	}

	return nil
}

func (s *consultationServiceImpl) ValidateGoalsObjectives(goalsObjectives *GoalsObjectives) error {
	if goalsObjectives == nil {
		return nil
	}

	// At least one primary goal is required if goals section is provided
	if len(goalsObjectives.PrimaryGoals) == 0 {
		return errors.New("at least one primary goal is required")
	}

	// Validate that goals are not empty strings
	for _, goal := range goalsObjectives.PrimaryGoals {
		if strings.TrimSpace(goal) == "" {
			return errors.New("primary goals cannot be empty")
		}
	}

	// Validate budget range format if provided
	// Accept both frontend value format (under-5k, 5k-10k, over-500k, tbd) and label format ($5,000 - $10,000)
	if goalsObjectives.BudgetRange != "" {
		budgetRegex := regexp.MustCompile(`^(under-\d+k|\d+k-\d+k|over-\d+k|tbd)$|^\$[\d,]+ - \$[\d,]+$|^Under \$[\d,]+$|^Over \$[\d,]+$|^To be determined$`)
		if !budgetRegex.MatchString(goalsObjectives.BudgetRange) {
			slog.Error("Budget validation failed", "budget", goalsObjectives.BudgetRange, "length", len(goalsObjectives.BudgetRange))
			return errors.New("invalid budget range format")
		}
	}

	return nil
}

func (s *consultationServiceImpl) ValidateStatusTransition(from, to ConsultationStatus) error {
	if from == to {
		return nil // No transition needed
	}

	// Define valid transitions
	validTransitions := map[ConsultationStatus][]ConsultationStatus{
		StatusDraft:     {StatusCompleted, StatusArchived},
		StatusCompleted: {StatusArchived},
		StatusArchived:  {}, // No transitions allowed from archived
	}

	allowedTransitions, exists := validTransitions[from]
	if !exists {
		return fmt.Errorf("unknown status: %s", from)
	}

	for _, allowed := range allowedTransitions {
		if to == allowed {
			return nil
		}
	}

	return fmt.Errorf("cannot transition from %s to %s", from, to)
}

func (s *consultationServiceImpl) ValidateConsultationCompletion(consultation *Consultation) error {
	if consultation == nil {
		return errors.New("consultation is nil")
	}

	// Parse all fields to ensure they're available
	if err := consultation.ParseAllJSONFields(); err != nil {
		return fmt.Errorf("parse JSON fields: %w", err)
	}

	var issues []string

	// Check contact info completeness
	if consultation.ParsedContactInfo == nil || consultation.ParsedContactInfo.BusinessName == "" {
		issues = append(issues, "contact information is incomplete")
	}

	// Check business context completeness
	if consultation.ParsedBusinessContext == nil || consultation.ParsedBusinessContext.Industry == "" {
		issues = append(issues, "business context is incomplete")
	}

	// Check pain points completeness
	if consultation.ParsedPainPoints == nil || len(consultation.ParsedPainPoints.PrimaryChallenges) == 0 {
		issues = append(issues, "pain points are incomplete")
	}

	// Check goals objectives completeness
	if consultation.ParsedGoalsObjectives == nil || len(consultation.ParsedGoalsObjectives.PrimaryGoals) == 0 {
		issues = append(issues, "goals and objectives are incomplete")
	}

	if len(issues) > 0 {
		return fmt.Errorf("consultation validation issues: %s", strings.Join(issues, "; "))
	}

	return nil
}

// Consultation lifecycle management

func (s *consultationServiceImpl) CompleteConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error) {
	// Get existing consultation
	consultation, err := s.GetConsultation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check if already completed
	if ConsultationStatus(consultation.Status) == StatusCompleted {
		return nil, errors.New("consultation is already completed")
	}

	// Check if consultation is 100% complete
	completionPercentage := s.CalculateCompletionPercentage(consultation)
	if completionPercentage < 100 {
		return nil, errors.New("consultation must be 100% complete before marking as completed")
	}

	// Update status to completed (completed_at is set automatically by SQL)
	params := query.UpdateConsultationStatusParams{
		ID:     id,
		Status: string(StatusCompleted),
	}

	updated, err := s.repo.UpdateConsultationStatus(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update consultation status: %w", err)
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: updated,
	}

	// Parse JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	// Create version for completion
	changeSummary := "Consultation completed"
	changedFields := []string{"status", "completed_at"}
	_, err = s.version.CreateVersionFromConsultation(ctx, domainConsultation, changeSummary, changedFields)
	if err != nil {
		// Log error but don't fail the completion
		// log.Error("failed to create completion version", "consultation_id", id, "error", err)
	}

	return domainConsultation, nil
}

func (s *consultationServiceImpl) ArchiveConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error) {
	// Get existing consultation
	consultation, err := s.GetConsultation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check if already archived
	if ConsultationStatus(consultation.Status) == StatusArchived {
		return nil, errors.New("consultation is already archived")
	}

	// Update status to archived
	params := query.UpdateConsultationStatusParams{
		ID:     id,
		Status: string(StatusArchived),
	}

	updated, err := s.repo.UpdateConsultationStatus(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update consultation status: %w", err)
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: updated,
	}

	// Parse JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	// Create version for archival
	changeSummary := "Consultation archived"
	changedFields := []string{"status"}
	_, err = s.version.CreateVersionFromConsultation(ctx, domainConsultation, changeSummary, changedFields)
	if err != nil {
		// Log error but don't fail the archival
		// log.Error("failed to create archival version", "consultation_id", id, "error", err)
	}

	return domainConsultation, nil
}

func (s *consultationServiceImpl) RestoreConsultation(ctx context.Context, id uuid.UUID) (*Consultation, error) {
	// Get existing consultation
	consultation, err := s.GetConsultation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Can only restore from archived status
	if ConsultationStatus(consultation.Status) != StatusArchived {
		return nil, errors.New("can only restore archived consultations")
	}

	// Determine appropriate status based on completion
	newStatus := StatusDraft
	if consultation.CompletionPercentage == 100 {
		newStatus = StatusCompleted
	}

	// Update status
	params := query.UpdateConsultationStatusParams{
		ID:     id,
		Status: string(newStatus),
	}

	updated, err := s.repo.UpdateConsultationStatus(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("update consultation status: %w", err)
	}

	// Convert to domain model
	domainConsultation := &Consultation{
		Consultation: updated,
	}

	// Parse JSON fields
	if err := domainConsultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	// Create version for restoration
	changeSummary := fmt.Sprintf("Consultation restored to %s", newStatus)
	changedFields := []string{"status"}
	_, err = s.version.CreateVersionFromConsultation(ctx, domainConsultation, changeSummary, changedFields)
	if err != nil {
		// Log error but don't fail the restoration
		// log.Error("failed to create restoration version", "consultation_id", id, "error", err)
	}

	return domainConsultation, nil
}

// Draft management

func (s *consultationServiceImpl) AutoSaveDraft(ctx context.Context, consultationID, userID uuid.UUID, draftData map[string]interface{}) error {
	return s.draft.AutoSave(ctx, consultationID, userID, draftData)
}

func (s *consultationServiceImpl) GetDraft(ctx context.Context, consultationID, userID uuid.UUID) (*ConsultationDraft, error) {
	return s.draft.GetAutoSavedDraft(ctx, consultationID, userID)
}

func (s *consultationServiceImpl) PromoteDraftToConsultation(ctx context.Context, consultationID, userID uuid.UUID) (*Consultation, error) {
	return s.draft.PromoteDraftToConsultation(ctx, consultationID, userID)
}

func (s *consultationServiceImpl) DeleteDraft(ctx context.Context, consultationID, userID uuid.UUID) error {
	return s.repo.DeleteConsultationDraft(ctx, consultationID)
}

// Version management

func (s *consultationServiceImpl) CreateVersion(ctx context.Context, consultationID uuid.UUID, changeSummary string, changedFields []string) (*ConsultationVersion, error) {
	// Get the consultation
	consultation, err := s.GetConsultation(ctx, consultationID)
	if err != nil {
		return nil, err
	}

	return s.version.CreateVersionFromConsultation(ctx, consultation, changeSummary, changedFields)
}

func (s *consultationServiceImpl) GetVersionHistory(ctx context.Context, consultationID uuid.UUID, page, limit int32) (*ConsultationVersionsResponse, error) {
	offset := (page - 1) * limit
	versions, err := s.version.GetVersionHistory(ctx, consultationID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("get version history: %w", err)
	}

	// Convert to pointer slice
	versionPtrs := make([]*ConsultationVersion, len(versions))
	for i := range versions {
		versionPtrs[i] = &versions[i]
	}

	return VersionsToResponse(versionPtrs), nil
}

func (s *consultationServiceImpl) RollbackToVersion(ctx context.Context, consultationID uuid.UUID, versionNumber int32, userID uuid.UUID) (*Consultation, error) {
	return s.version.RollbackToVersion(ctx, consultationID, versionNumber, userID)
}

// Business logic helpers

func (s *consultationServiceImpl) CalculateCompletionPercentage(consultation *Consultation) int32 {
	return consultation.CalculateCompletionPercentage()
}

func (s *consultationServiceImpl) GetConsultationProgress(ctx context.Context, id uuid.UUID) (*ConsultationProgress, error) {
	consultation, err := s.GetConsultation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Parse all JSON fields
	if err := consultation.ParseAllJSONFields(); err != nil {
		return nil, fmt.Errorf("parse consultation JSON fields: %w", err)
	}

	progress := &ConsultationProgress{
		ConsultationID:       id,
		CompletionPercentage: s.CalculateCompletionPercentage(consultation),
		CompletedSections:    make(map[string]bool),
		LastUpdated:          consultation.UpdatedAt,
	}

	// Check section completion
	progress.CompletedSections["contact_info"] = consultation.ParsedContactInfo != nil && consultation.ParsedContactInfo.BusinessName != ""
	progress.CompletedSections["business_context"] = consultation.ParsedBusinessContext != nil && consultation.ParsedBusinessContext.Industry != ""
	progress.CompletedSections["pain_points"] = consultation.ParsedPainPoints != nil && len(consultation.ParsedPainPoints.PrimaryChallenges) > 0
	progress.CompletedSections["goals_objectives"] = consultation.ParsedGoalsObjectives != nil && len(consultation.ParsedGoalsObjectives.PrimaryGoals) > 0

	return progress, nil
}

func (s *consultationServiceImpl) DetectChangedFields(current, previous *Consultation) []string {
	changedFields, _ := s.version.DetectChanges(context.Background(), current, previous)
	return changedFields
}

// Bulk operations

func (s *consultationServiceImpl) BulkArchiveConsultations(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	for _, id := range ids {
		_, err := s.ArchiveConsultation(ctx, id)
		if err != nil {
			return fmt.Errorf("archive consultation %s: %w", id, err)
		}
	}
	return nil
}

func (s *consultationServiceImpl) BulkDeleteConsultations(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	for _, id := range ids {
		err := s.DeleteConsultation(ctx, id)
		if err != nil {
			return fmt.Errorf("delete consultation %s: %w", id, err)
		}
	}
	return nil
}

// Analytics and reporting

func (s *consultationServiceImpl) GetConsultationStats(ctx context.Context, userID uuid.UUID) (*ConsultationStats, error) {
	// Get counts by status
	draftCount, err := s.countConsultationsByStatus(ctx, userID, StatusDraft)
	if err != nil {
		return nil, fmt.Errorf("count draft consultations: %w", err)
	}

	completedCount, err := s.countConsultationsByStatus(ctx, userID, StatusCompleted)
	if err != nil {
		return nil, fmt.Errorf("count completed consultations: %w", err)
	}

	archivedCount, err := s.countConsultationsByStatus(ctx, userID, StatusArchived)
	if err != nil {
		return nil, fmt.Errorf("count archived consultations: %w", err)
	}

	totalCount, err := s.repo.CountConsultations(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("count total consultations: %w", err)
	}

	stats := &ConsultationStats{
		UserID:       userID,
		TotalCount:   totalCount,
		DraftCount:   draftCount,
		CompletedCount: completedCount,
		ArchivedCount: archivedCount,
		CompletionRate: 0,
	}

	if totalCount > 0 {
		stats.CompletionRate = float64(completedCount) / float64(totalCount) * 100
	}

	return stats, nil
}

func (s *consultationServiceImpl) GetCompletionRateByPeriod(ctx context.Context, userID uuid.UUID, period string) (*CompletionRateStats, error) {
	// This would require date-based queries that aren't implemented yet
	// Return empty stats for now
	return &CompletionRateStats{
		UserID: userID,
		Period: period,
		Rate:   0,
	}, nil
}

// Helper functions

func (s *consultationServiceImpl) validateCreateInput(input *CreateConsultationInput) error {
	if input == nil {
		return errors.New("input is required")
	}

	if input.UserID == uuid.Nil {
		return errors.New("user_id is required")
	}

	if input.Status != "" && !input.Status.IsValid() {
		return errors.New("invalid status")
	}

	return nil
}

func (s *consultationServiceImpl) validateListParams(params *ListConsultationsParams) error {
	if params == nil {
		return errors.New("params are required")
	}

	if params.UserID == uuid.Nil {
		return errors.New("user_id is required")
	}

	if params.Page < 1 {
		return errors.New("page must be >= 1")
	}

	if params.Limit < 1 || params.Limit > 100 {
		return errors.New("limit must be between 1 and 100")
	}

	if params.Status != nil && !params.Status.IsValid() {
		return errors.New("invalid status")
	}

	return nil
}

func (s *consultationServiceImpl) countConsultationsByStatus(ctx context.Context, userID uuid.UUID, status ConsultationStatus) (int64, error) {
	params := query.ListConsultationsByStatusParams{
		UserID: userID,
		Status: string(status),
		Limit:  1,
		Offset: 0,
	}

	consultations, err := s.repo.SelectConsultationsByStatus(ctx, params)
	if err != nil {
		return 0, err
	}

	return int64(len(consultations)), nil
}

// Additional types for service responses

type ConsultationProgress struct {
	ConsultationID       uuid.UUID         `json:"consultation_id"`
	CompletionPercentage int32             `json:"completion_percentage"`
	CompletedSections    map[string]bool   `json:"completed_sections"`
	LastUpdated          time.Time         `json:"last_updated"`
}

type ConsultationStats struct {
	UserID         uuid.UUID `json:"user_id"`
	TotalCount     int64     `json:"total_count"`
	DraftCount     int64     `json:"draft_count"`
	CompletedCount int64     `json:"completed_count"`
	ArchivedCount  int64     `json:"archived_count"`
	CompletionRate float64   `json:"completion_rate"`
}

type CompletionRateStats struct {
	UserID uuid.UUID `json:"user_id"`
	Period string    `json:"period"`
	Rate   float64   `json:"rate"`
}
