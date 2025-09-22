package consultation

import (
	"database/sql"
	"github.com/google/uuid"
	"service-core/storage/query"
)

// Input DTOs for creating consultations using the new JSONB schema
type CreateConsultationInput struct {
	UserID            uuid.UUID         `json:"user_id" validate:"required"`
	ContactInfo       *ContactInfo      `json:"contact_info,omitempty"`
	BusinessContext   *BusinessContext  `json:"business_context,omitempty"`
	PainPoints        *PainPoints       `json:"pain_points,omitempty"`
	GoalsObjectives   *GoalsObjectives  `json:"goals_objectives,omitempty"`
	Status            ConsultationStatus `json:"status,omitempty" validate:"omitempty,oneof=draft completed archived"`
}

// Input DTOs for updating consultations
type UpdateConsultationInput struct {
	ContactInfo       *ContactInfo      `json:"contact_info,omitempty"`
	BusinessContext   *BusinessContext  `json:"business_context,omitempty"`
	PainPoints        *PainPoints       `json:"pain_points,omitempty"`
	GoalsObjectives   *GoalsObjectives  `json:"goals_objectives,omitempty"`
	Status            *ConsultationStatus `json:"status,omitempty" validate:"omitempty,oneof=draft completed archived"`
}

// Input DTOs for consultation drafts
type CreateConsultationDraftInput struct {
	ConsultationID  uuid.UUID                  `json:"consultation_id" validate:"required"`
	UserID          uuid.UUID                  `json:"user_id" validate:"required"`
	ContactInfo     *ContactInfo               `json:"contact_info,omitempty"`
	BusinessContext *BusinessContext           `json:"business_context,omitempty"`
	PainPoints      *PainPoints                `json:"pain_points,omitempty"`
	GoalsObjectives *GoalsObjectives           `json:"goals_objectives,omitempty"`
	AutoSaved       bool                       `json:"auto_saved,omitempty"`
	DraftNotes      string                     `json:"draft_notes,omitempty"`
}

type UpdateConsultationDraftInput struct {
	ContactInfo     *ContactInfo     `json:"contact_info,omitempty"`
	BusinessContext *BusinessContext `json:"business_context,omitempty"`
	PainPoints      *PainPoints      `json:"pain_points,omitempty"`
	GoalsObjectives *GoalsObjectives `json:"goals_objectives,omitempty"`
	AutoSaved       *bool            `json:"auto_saved,omitempty"`
	DraftNotes      *string          `json:"draft_notes,omitempty"`
}

// Input DTOs for consultation versions
type CreateConsultationVersionInput struct {
	ConsultationID    uuid.UUID    `json:"consultation_id" validate:"required"`
	UserID            uuid.UUID    `json:"user_id" validate:"required"`
	ChangeSummary     string       `json:"change_summary,omitempty" validate:"max=1000"`
	ChangedFields     []string     `json:"changed_fields,omitempty"`
}

// Query parameters for listing consultations
type ListConsultationsParams struct {
	UserID uuid.UUID           `json:"user_id" validate:"required"`
	Page   int32               `json:"page" validate:"min=1"`
	Limit  int32               `json:"limit" validate:"min=1,max=100"`
	Status *ConsultationStatus `json:"status,omitempty"`
}

// Response DTOs
type ConsultationResponse struct {
	Consultation *Consultation `json:"consultation"`
	User         *User         `json:"user,omitempty"`
}

type ConsultationsResponse struct {
	Count         int64                  `json:"count"`
	Consultations []*ConsultationSummary `json:"consultations"`
}

type ConsultationDraftResponse struct {
	Draft *ConsultationDraft `json:"draft"`
}

type ConsultationVersionsResponse struct {
	Versions []*ConsultationVersion `json:"versions"`
}

// User simplified for responses (to avoid circular imports)
type User struct {
	ID     uuid.UUID `json:"id"`
	Email  string    `json:"email"`
	Avatar string    `json:"avatar"`
}

// Helper functions to convert input DTOs to SQLC parameters

func (input *CreateConsultationInput) ToCreateParams() (query.CreateConsultationParams, error) {
	id := uuid.New()

	// Set defaults
	if input.Status == "" {
		input.Status = StatusDraft
	}

	// Marshal JSON fields
	contactInfoJSON, err := MarshalContactInfo(input.ContactInfo)
	if err != nil {
		return query.CreateConsultationParams{}, err
	}

	businessContextJSON, err := MarshalBusinessContext(input.BusinessContext)
	if err != nil {
		return query.CreateConsultationParams{}, err
	}

	painPointsJSON, err := MarshalPainPoints(input.PainPoints)
	if err != nil {
		return query.CreateConsultationParams{}, err
	}

	goalsObjectivesJSON, err := MarshalGoalsObjectives(input.GoalsObjectives)
	if err != nil {
		return query.CreateConsultationParams{}, err
	}

	// Calculate completion percentage
	consultation := &Consultation{
		Consultation: query.Consultation{
			ID:              id,
			UserID:          input.UserID,
			ContactInfo:     contactInfoJSON,
			BusinessContext: businessContextJSON,
			PainPoints:      painPointsJSON,
			GoalsObjectives: goalsObjectivesJSON,
			Status:          string(input.Status),
		},
	}

	// Parse fields to calculate completion
	_ = consultation.ParseAllJSONFields()
	completionPercentage := consultation.CalculateCompletionPercentage()

	return query.CreateConsultationParams{
		ID:                   id,
		UserID:               input.UserID,
		ContactInfo:          contactInfoJSON,
		BusinessContext:      businessContextJSON,
		PainPoints:           painPointsJSON,
		GoalsObjectives:      goalsObjectivesJSON,
		Status:               string(input.Status),
		CompletionPercentage: sql.NullInt32{Int32: completionPercentage, Valid: true},
	}, nil
}

func (input *UpdateConsultationInput) ToUpdateParams(id uuid.UUID, current *Consultation) (query.UpdateConsultationParams, error) {
	// Start with current values
	params := query.UpdateConsultationParams{
		ID:              id,
		ContactInfo:     current.ContactInfo,
		BusinessContext: current.BusinessContext,
		PainPoints:      current.PainPoints,
		GoalsObjectives: current.GoalsObjectives,
		Status:          current.Status,
	}

	// Update only provided fields
	if input.ContactInfo != nil {
		contactInfoJSON, err := MarshalContactInfo(input.ContactInfo)
		if err != nil {
			return query.UpdateConsultationParams{}, err
		}
		params.ContactInfo = contactInfoJSON
	}

	if input.BusinessContext != nil {
		businessContextJSON, err := MarshalBusinessContext(input.BusinessContext)
		if err != nil {
			return query.UpdateConsultationParams{}, err
		}
		params.BusinessContext = businessContextJSON
	}

	if input.PainPoints != nil {
		painPointsJSON, err := MarshalPainPoints(input.PainPoints)
		if err != nil {
			return query.UpdateConsultationParams{}, err
		}
		params.PainPoints = painPointsJSON
	}

	if input.GoalsObjectives != nil {
		goalsObjectivesJSON, err := MarshalGoalsObjectives(input.GoalsObjectives)
		if err != nil {
			return query.UpdateConsultationParams{}, err
		}
		params.GoalsObjectives = goalsObjectivesJSON
	}

	if input.Status != nil {
		params.Status = string(*input.Status)
	}

	return params, nil
}

func (input *CreateConsultationDraftInput) ToCreateParams() (query.CreateConsultationDraftParams, error) {
	id := uuid.New()

	// Marshal JSON fields
	contactInfoJSON, err := MarshalContactInfo(input.ContactInfo)
	if err != nil {
		return query.CreateConsultationDraftParams{}, err
	}

	businessContextJSON, err := MarshalBusinessContext(input.BusinessContext)
	if err != nil {
		return query.CreateConsultationDraftParams{}, err
	}

	painPointsJSON, err := MarshalPainPoints(input.PainPoints)
	if err != nil {
		return query.CreateConsultationDraftParams{}, err
	}

	goalsObjectivesJSON, err := MarshalGoalsObjectives(input.GoalsObjectives)
	if err != nil {
		return query.CreateConsultationDraftParams{}, err
	}

	return query.CreateConsultationDraftParams{
		ID:              id,
		ConsultationID:  input.ConsultationID,
		UserID:          input.UserID,
		ContactInfo:     contactInfoJSON,
		BusinessContext: businessContextJSON,
		PainPoints:      painPointsJSON,
		GoalsObjectives: goalsObjectivesJSON,
		AutoSaved:       sql.NullBool{Bool: input.AutoSaved, Valid: true},
		DraftNotes:      sql.NullString{String: input.DraftNotes, Valid: input.DraftNotes != ""},
	}, nil
}

func (input *CreateConsultationDraftInput) ToUpsertParams() (query.UpsertConsultationDraftParams, error) {
	id := uuid.New()

	// Marshal JSON fields
	contactInfoJSON, err := MarshalContactInfo(input.ContactInfo)
	if err != nil {
		return query.UpsertConsultationDraftParams{}, err
	}

	businessContextJSON, err := MarshalBusinessContext(input.BusinessContext)
	if err != nil {
		return query.UpsertConsultationDraftParams{}, err
	}

	painPointsJSON, err := MarshalPainPoints(input.PainPoints)
	if err != nil {
		return query.UpsertConsultationDraftParams{}, err
	}

	goalsObjectivesJSON, err := MarshalGoalsObjectives(input.GoalsObjectives)
	if err != nil {
		return query.UpsertConsultationDraftParams{}, err
	}

	return query.UpsertConsultationDraftParams{
		ID:              id,
		ConsultationID:  input.ConsultationID,
		UserID:          input.UserID,
		ContactInfo:     contactInfoJSON,
		BusinessContext: businessContextJSON,
		PainPoints:      painPointsJSON,
		GoalsObjectives: goalsObjectivesJSON,
		AutoSaved:       sql.NullBool{Bool: input.AutoSaved, Valid: true},
		DraftNotes:      sql.NullString{String: input.DraftNotes, Valid: input.DraftNotes != ""},
	}, nil
}

func (params *ListConsultationsParams) ToQueryParams() query.ListConsultationsByUserParams {
	offset := (params.Page - 1) * params.Limit

	return query.ListConsultationsByUserParams{
		UserID: params.UserID,
		Limit:  params.Limit,
		Offset: offset,
	}
}

func (params *ListConsultationsParams) ToStatusQueryParams() query.ListConsultationsByStatusParams {
	offset := (params.Page - 1) * params.Limit

	return query.ListConsultationsByStatusParams{
		UserID: params.UserID,
		Status: string(*params.Status),
		Limit:  params.Limit,
		Offset: offset,
	}
}

// Conversion helpers for responses
func ConsultationToResponse(consultation *Consultation, user *query.User) *ConsultationResponse {
	var userDto *User
	if user != nil {
		userDto = &User{
			ID:     user.ID,
			Email:  user.Email,
			Avatar: user.Avatar,
		}
	}

	return &ConsultationResponse{
		Consultation: consultation,
		User:         userDto,
	}
}

func ConsultationsToResponse(consultations []*ConsultationSummary, count int64) *ConsultationsResponse {
	return &ConsultationsResponse{
		Count:         count,
		Consultations: consultations,
	}
}

func DraftToResponse(draft *ConsultationDraft) *ConsultationDraftResponse {
	return &ConsultationDraftResponse{
		Draft: draft,
	}
}

func VersionsToResponse(versions []*ConsultationVersion) *ConsultationVersionsResponse {
	return &ConsultationVersionsResponse{
		Versions: versions,
	}
}