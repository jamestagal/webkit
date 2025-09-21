package consultation

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Input DTOs for creating consultations
type CreateConsultationInput struct {
	// Client Information
	BusinessName     string           `json:"business_name" validate:"required,min=1,max=255"`
	ContactName      string           `json:"contact_name" validate:"required,min=1,max=255"`
	ContactTitle     string           `json:"contact_title,omitempty" validate:"max=255"`
	Email            string           `json:"email" validate:"required,email,max=255"`
	Phone            string           `json:"phone,omitempty" validate:"max=50"`
	Website          string           `json:"website,omitempty" validate:"url,max=255"`
	PreferredContact PreferredContact `json:"preferred_contact,omitempty" validate:"omitempty,oneof=email phone both"`

	// Business Context
	Industry         string `json:"industry" validate:"required,min=1,max=255"`
	Location         string `json:"location" validate:"required,min=1,max=255"`
	YearsInBusiness  *int32 `json:"years_in_business,omitempty" validate:"omitempty,min=0,max=200"`
	TeamSize         *int32 `json:"team_size,omitempty" validate:"omitempty,min=1,max=100000"`
	MonthlyTraffic   *int32 `json:"monthly_traffic,omitempty" validate:"omitempty,min=0"`
	CurrentPlatform  string `json:"current_platform,omitempty" validate:"max=255"`

	// Consultation Data
	BusinessData *BusinessData `json:"business_data,omitempty"`
	Challenges   *Challenges   `json:"challenges,omitempty"`
	Goals        *Goals        `json:"goals,omitempty"`
	Budget       *Budget       `json:"budget,omitempty"`

	// Metadata
	ConsultationDate *time.Time         `json:"consultation_date,omitempty"`
	DurationMinutes  *int32             `json:"duration_minutes,omitempty" validate:"omitempty,min=15,max=480"`
	SalesRep         string             `json:"sales_rep,omitempty" validate:"max=255"`
	Notes            string             `json:"notes,omitempty"`
	NextSteps        *NextSteps         `json:"next_steps,omitempty"`
	CommitmentLevel  *int32             `json:"commitment_level,omitempty" validate:"omitempty,min=1,max=5"`
	Status           ConsultationStatus `json:"status,omitempty" validate:"omitempty,oneof=scheduled in_progress completed cancelled follow_up"`
}

// Input DTOs for updating consultations
type UpdateConsultationInput struct {
	// Client Information
	BusinessName     *string           `json:"business_name,omitempty" validate:"omitempty,min=1,max=255"`
	ContactName      *string           `json:"contact_name,omitempty" validate:"omitempty,min=1,max=255"`
	ContactTitle     *string           `json:"contact_title,omitempty" validate:"omitempty,max=255"`
	Email            *string           `json:"email,omitempty" validate:"omitempty,email,max=255"`
	Phone            *string           `json:"phone,omitempty" validate:"omitempty,max=50"`
	Website          *string           `json:"website,omitempty" validate:"omitempty,url,max=255"`
	PreferredContact *PreferredContact `json:"preferred_contact,omitempty" validate:"omitempty,oneof=email phone both"`

	// Business Context
	Industry         *string `json:"industry,omitempty" validate:"omitempty,min=1,max=255"`
	Location         *string `json:"location,omitempty" validate:"omitempty,min=1,max=255"`
	YearsInBusiness  *int32  `json:"years_in_business,omitempty" validate:"omitempty,min=0,max=200"`
	TeamSize         *int32  `json:"team_size,omitempty" validate:"omitempty,min=1,max=100000"`
	MonthlyTraffic   *int32  `json:"monthly_traffic,omitempty" validate:"omitempty,min=0"`
	CurrentPlatform  *string `json:"current_platform,omitempty" validate:"omitempty,max=255"`

	// Consultation Data
	BusinessData *BusinessData `json:"business_data,omitempty"`
	Challenges   *Challenges   `json:"challenges,omitempty"`
	Goals        *Goals        `json:"goals,omitempty"`
	Budget       *Budget       `json:"budget,omitempty"`

	// Metadata
	ConsultationDate *time.Time         `json:"consultation_date,omitempty"`
	DurationMinutes  *int32             `json:"duration_minutes,omitempty" validate:"omitempty,min=15,max=480"`
	SalesRep         *string            `json:"sales_rep,omitempty" validate:"omitempty,max=255"`
	Notes            *string            `json:"notes,omitempty"`
	NextSteps        *NextSteps         `json:"next_steps,omitempty"`
	CommitmentLevel  *int32             `json:"commitment_level,omitempty" validate:"omitempty,min=1,max=5"`
	Status           *ConsultationStatus `json:"status,omitempty" validate:"omitempty,oneof=scheduled in_progress completed cancelled follow_up"`
}

// Input DTOs for consultation drafts
type CreateConsultationDraftInput struct {
	ConsultationID uuid.UUID              `json:"consultation_id" validate:"required"`
	DraftData      map[string]interface{} `json:"draft_data" validate:"required"`
}

type UpdateConsultationDraftInput struct {
	ConsultationID uuid.UUID              `json:"consultation_id" validate:"required"`
	DraftData      map[string]interface{} `json:"draft_data" validate:"required"`
}

// Input DTOs for consultation versions
type CreateConsultationVersionInput struct {
	ConsultationID    uuid.UUID              `json:"consultation_id" validate:"required"`
	VersionData       map[string]interface{} `json:"version_data" validate:"required"`
	ChangeDescription string                 `json:"change_description,omitempty" validate:"max=1000"`
}

// Query parameters for listing consultations
type ListConsultationsParams struct {
	UserID uuid.UUID          `json:"user_id" validate:"required"`
	Page   int32              `json:"page" validate:"min=1"`
	Limit  int32              `json:"limit" validate:"min=1,max=100"`
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

// Helper functions to convert input DTOs to database parameters
func (input *CreateConsultationInput) ToInsertParams(userID uuid.UUID) (*InsertConsultationParams, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}

	// Set defaults
	if input.PreferredContact == "" {
		input.PreferredContact = ContactEmail
	}
	if input.Status == "" {
		input.Status = StatusScheduled
	}

	// Marshal JSON fields
	businessData, err := MarshalBusinessData(input.BusinessData)
	if err != nil {
		return nil, err
	}

	challenges, err := MarshalChallenges(input.Challenges)
	if err != nil {
		return nil, err
	}

	goals, err := MarshalGoals(input.Goals)
	if err != nil {
		return nil, err
	}

	budget, err := MarshalBudget(input.Budget)
	if err != nil {
		return nil, err
	}

	nextSteps, err := MarshalNextSteps(input.NextSteps)
	if err != nil {
		return nil, err
	}

	params := &InsertConsultationParams{
		ID:               id,
		UserID:           userID,
		BusinessName:     input.BusinessName,
		ContactName:      input.ContactName,
		ContactTitle:     input.ContactTitle,
		Email:            input.Email,
		Phone:            input.Phone,
		Website:          input.Website,
		PreferredContact: string(input.PreferredContact),
		Industry:         input.Industry,
		Location:         input.Location,
		CurrentPlatform:  input.CurrentPlatform,
		BusinessData:     businessData,
		Challenges:       challenges,
		Goals:            goals,
		Budget:           budget,
		SalesRep:         input.SalesRep,
		Notes:            input.Notes,
		NextSteps:        nextSteps,
		Status:           string(input.Status),
	}

	// Handle nullable fields
	if input.YearsInBusiness != nil {
		params.YearsInBusiness = sql.NullInt32{Int32: *input.YearsInBusiness, Valid: true}
	}
	if input.TeamSize != nil {
		params.TeamSize = sql.NullInt32{Int32: *input.TeamSize, Valid: true}
	}
	if input.MonthlyTraffic != nil {
		params.MonthlyTraffic = sql.NullInt32{Int32: *input.MonthlyTraffic, Valid: true}
	}
	if input.ConsultationDate != nil {
		params.ConsultationDate = sql.NullTime{Time: *input.ConsultationDate, Valid: true}
	}
	if input.DurationMinutes != nil {
		params.DurationMinutes = sql.NullInt32{Int32: *input.DurationMinutes, Valid: true}
	}
	if input.CommitmentLevel != nil {
		params.CommitmentLevel = sql.NullInt32{Int32: *input.CommitmentLevel, Valid: true}
	}

	return params, nil
}

func (input *UpdateConsultationInput) ToUpdateParams(id uuid.UUID, current *Consultation) (*UpdateConsultationParams, error) {
	// Start with current values
	params := &UpdateConsultationParams{
		ID:               id,
		BusinessName:     current.BusinessName,
		ContactName:      current.ContactName,
		ContactTitle:     current.ContactTitle,
		Email:            current.Email,
		Phone:            current.Phone,
		Website:          current.Website,
		PreferredContact: current.PreferredContact,
		Industry:         current.Industry,
		Location:         current.Location,
		YearsInBusiness:  current.YearsInBusiness,
		TeamSize:         current.TeamSize,
		MonthlyTraffic:   current.MonthlyTraffic,
		CurrentPlatform:  current.CurrentPlatform,
		BusinessData:     current.BusinessData,
		Challenges:       current.Challenges,
		Goals:            current.Goals,
		Budget:           current.Budget,
		ConsultationDate: current.ConsultationDate,
		DurationMinutes:  current.DurationMinutes,
		SalesRep:         current.SalesRep,
		Notes:            current.Notes,
		NextSteps:        current.NextSteps,
		CommitmentLevel:  current.CommitmentLevel,
		Status:           current.Status,
	}

	// Update only provided fields
	if input.BusinessName != nil {
		params.BusinessName = *input.BusinessName
	}
	if input.ContactName != nil {
		params.ContactName = *input.ContactName
	}
	if input.ContactTitle != nil {
		params.ContactTitle = *input.ContactTitle
	}
	if input.Email != nil {
		params.Email = *input.Email
	}
	if input.Phone != nil {
		params.Phone = *input.Phone
	}
	if input.Website != nil {
		params.Website = *input.Website
	}
	if input.PreferredContact != nil {
		params.PreferredContact = string(*input.PreferredContact)
	}
	if input.Industry != nil {
		params.Industry = *input.Industry
	}
	if input.Location != nil {
		params.Location = *input.Location
	}
	if input.CurrentPlatform != nil {
		params.CurrentPlatform = *input.CurrentPlatform
	}
	if input.SalesRep != nil {
		params.SalesRep = *input.SalesRep
	}
	if input.Notes != nil {
		params.Notes = *input.Notes
	}
	if input.Status != nil {
		params.Status = string(*input.Status)
	}

	// Handle nullable fields
	if input.YearsInBusiness != nil {
		params.YearsInBusiness = sql.NullInt32{Int32: *input.YearsInBusiness, Valid: true}
	}
	if input.TeamSize != nil {
		params.TeamSize = sql.NullInt32{Int32: *input.TeamSize, Valid: true}
	}
	if input.MonthlyTraffic != nil {
		params.MonthlyTraffic = sql.NullInt32{Int32: *input.MonthlyTraffic, Valid: true}
	}
	if input.ConsultationDate != nil {
		params.ConsultationDate = sql.NullTime{Time: *input.ConsultationDate, Valid: true}
	}
	if input.DurationMinutes != nil {
		params.DurationMinutes = sql.NullInt32{Int32: *input.DurationMinutes, Valid: true}
	}
	if input.CommitmentLevel != nil {
		params.CommitmentLevel = sql.NullInt32{Int32: *input.CommitmentLevel, Valid: true}
	}

	// Handle JSON fields
	if input.BusinessData != nil {
		businessData, err := MarshalBusinessData(input.BusinessData)
		if err != nil {
			return nil, err
		}
		params.BusinessData = businessData
	}
	if input.Challenges != nil {
		challenges, err := MarshalChallenges(input.Challenges)
		if err != nil {
			return nil, err
		}
		params.Challenges = challenges
	}
	if input.Goals != nil {
		goals, err := MarshalGoals(input.Goals)
		if err != nil {
			return nil, err
		}
		params.Goals = goals
	}
	if input.Budget != nil {
		budget, err := MarshalBudget(input.Budget)
		if err != nil {
			return nil, err
		}
		params.Budget = budget
	}
	if input.NextSteps != nil {
		nextSteps, err := MarshalNextSteps(input.NextSteps)
		if err != nil {
			return nil, err
		}
		params.NextSteps = nextSteps
	}

	return params, nil
}

// Helper type aliases for parameter structs (avoiding direct import of query package in this file)
type InsertConsultationParams struct {
	ID               uuid.UUID       `json:"id"`
	UserID           uuid.UUID       `json:"user_id"`
	BusinessName     string          `json:"business_name"`
	ContactName      string          `json:"contact_name"`
	ContactTitle     string          `json:"contact_title"`
	Email            string          `json:"email"`
	Phone            string          `json:"phone"`
	Website          string          `json:"website"`
	PreferredContact string          `json:"preferred_contact"`
	Industry         string          `json:"industry"`
	Location         string          `json:"location"`
	YearsInBusiness  sql.NullInt32   `json:"years_in_business"`
	TeamSize         sql.NullInt32   `json:"team_size"`
	MonthlyTraffic   sql.NullInt32   `json:"monthly_traffic"`
	CurrentPlatform  string          `json:"current_platform"`
	BusinessData     json.RawMessage `json:"business_data"`
	Challenges       json.RawMessage `json:"challenges"`
	Goals            json.RawMessage `json:"goals"`
	Budget           json.RawMessage `json:"budget"`
	ConsultationDate sql.NullTime    `json:"consultation_date"`
	DurationMinutes  sql.NullInt32   `json:"duration_minutes"`
	SalesRep         string          `json:"sales_rep"`
	Notes            string          `json:"notes"`
	NextSteps        json.RawMessage `json:"next_steps"`
	CommitmentLevel  sql.NullInt32   `json:"commitment_level"`
	Status           string          `json:"status"`
}

type UpdateConsultationParams struct {
	BusinessName     string          `json:"business_name"`
	ContactName      string          `json:"contact_name"`
	ContactTitle     string          `json:"contact_title"`
	Email            string          `json:"email"`
	Phone            string          `json:"phone"`
	Website          string          `json:"website"`
	PreferredContact string          `json:"preferred_contact"`
	Industry         string          `json:"industry"`
	Location         string          `json:"location"`
	YearsInBusiness  sql.NullInt32   `json:"years_in_business"`
	TeamSize         sql.NullInt32   `json:"team_size"`
	MonthlyTraffic   sql.NullInt32   `json:"monthly_traffic"`
	CurrentPlatform  string          `json:"current_platform"`
	BusinessData     json.RawMessage `json:"business_data"`
	Challenges       json.RawMessage `json:"challenges"`
	Goals            json.RawMessage `json:"goals"`
	Budget           json.RawMessage `json:"budget"`
	ConsultationDate sql.NullTime    `json:"consultation_date"`
	DurationMinutes  sql.NullInt32   `json:"duration_minutes"`
	SalesRep         string          `json:"sales_rep"`
	Notes            string          `json:"notes"`
	NextSteps        json.RawMessage `json:"next_steps"`
	CommitmentLevel  sql.NullInt32   `json:"commitment_level"`
	Status           string          `json:"status"`
	ID               uuid.UUID       `json:"id"`
}