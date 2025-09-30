package consultation

import (
	"time"

	"github.com/google/uuid"
)

// ConsultationDTO represents the data transfer object for Consultation
// This removes sql.Null* types for clean JSON serialization
type ConsultationDTO struct {
	ID                    uuid.UUID         `json:"id"`
	UserID                uuid.UUID         `json:"user_id"`
	ContactInfo           []byte            `json:"contact_info"`
	BusinessContext       []byte            `json:"business_context"`
	PainPoints            []byte            `json:"pain_points"`
	GoalsObjectives       []byte            `json:"goals_objectives"`
	Status                string            `json:"status"`
	CompletionPercentage  int32             `json:"completion_percentage"`
	CreatedAt             time.Time         `json:"created_at"`
	UpdatedAt             time.Time         `json:"updated_at"`
	CompletedAt           *time.Time        `json:"completed_at,omitempty"`
	ParsedContactInfo     *ContactInfo      `json:"parsed_contact_info,omitempty"`
	ParsedBusinessContext *BusinessContext  `json:"parsed_business_context,omitempty"`
	ParsedPainPoints      *PainPoints       `json:"parsed_pain_points,omitempty"`
	ParsedGoalsObjectives *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
}

// ConsultationDraftDTO represents the data transfer object for ConsultationDraft
type ConsultationDraftDTO struct {
	ID                    uuid.UUID         `json:"id"`
	ConsultationID        uuid.UUID         `json:"consultation_id"`
	UserID                uuid.UUID         `json:"user_id"`
	ContactInfo           []byte            `json:"contact_info"`
	BusinessContext       []byte            `json:"business_context"`
	PainPoints            []byte            `json:"pain_points"`
	GoalsObjectives       []byte            `json:"goals_objectives"`
	AutoSaved             bool              `json:"auto_saved"`
	DraftNotes            string            `json:"draft_notes,omitempty"`
	CreatedAt             time.Time         `json:"created_at"`
	UpdatedAt             time.Time         `json:"updated_at"`
	ParsedContactInfo     *ContactInfo      `json:"parsed_contact_info,omitempty"`
	ParsedBusinessContext *BusinessContext  `json:"parsed_business_context,omitempty"`
	ParsedPainPoints      *PainPoints       `json:"parsed_pain_points,omitempty"`
	ParsedGoalsObjectives *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
}

// ConsultationVersionDTO represents the data transfer object for ConsultationVersion
type ConsultationVersionDTO struct {
	ID                    uuid.UUID         `json:"id"`
	ConsultationID        uuid.UUID         `json:"consultation_id"`
	UserID                uuid.UUID         `json:"user_id"`
	VersionNumber         int32             `json:"version_number"`
	ContactInfo           []byte            `json:"contact_info"`
	BusinessContext       []byte            `json:"business_context"`
	PainPoints            []byte            `json:"pain_points"`
	GoalsObjectives       []byte            `json:"goals_objectives"`
	Status                string            `json:"status"`
	CompletionPercentage  int32             `json:"completion_percentage"`
	ChangeSummary         string            `json:"change_summary,omitempty"`
	ChangedFields         []byte            `json:"changed_fields"`
	CreatedAt             time.Time         `json:"created_at"`
	ParsedContactInfo     *ContactInfo      `json:"parsed_contact_info,omitempty"`
	ParsedBusinessContext *BusinessContext  `json:"parsed_business_context,omitempty"`
	ParsedPainPoints      *PainPoints       `json:"parsed_pain_points,omitempty"`
	ParsedGoalsObjectives *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
	ParsedChangedFields   []string          `json:"parsed_changed_fields,omitempty"`
}

// ConsultationsResponseDTO wraps the list response with DTOs
type ConsultationsResponseDTO struct {
	Consultations []*ConsultationDTO   `json:"consultations"`
	Summaries     []*ConsultationSummary `json:"summaries"`
	Total         int32                  `json:"total"`
	Page          int32                  `json:"page"`
	Limit         int32                  `json:"limit"`
	TotalPages    int32                  `json:"total_pages"`
}

// ConsultationVersionsResponseDTO wraps the version history response with DTOs
type ConsultationVersionsResponseDTO struct {
	Versions   []*ConsultationVersionDTO `json:"versions"`
	Total      int32                     `json:"total"`
	Page       int32                     `json:"page"`
	Limit      int32                     `json:"limit"`
	TotalPages int32                     `json:"total_pages"`
}