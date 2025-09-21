package consultation

import (
	"encoding/json"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
)

// Business-focused enums and constants
type ConsultationStatus string

const (
	StatusScheduled  ConsultationStatus = "scheduled"
	StatusInProgress ConsultationStatus = "in_progress"
	StatusCompleted  ConsultationStatus = "completed"
	StatusCancelled  ConsultationStatus = "cancelled"
	StatusFollowUp   ConsultationStatus = "follow_up"
)

type PreferredContact string

const (
	ContactEmail PreferredContact = "email"
	ContactPhone PreferredContact = "phone"
	ContactBoth  PreferredContact = "both"
)

// Business data structures for JSONB fields
type BusinessData struct {
	Revenue             *int64                 `json:"revenue,omitempty"`
	GrowthRate          *float64               `json:"growth_rate,omitempty"`
	MarketSegment       string                 `json:"market_segment,omitempty"`
	BusinessModel       string                 `json:"business_model,omitempty"`
	Technologies        []string               `json:"technologies,omitempty"`
	CompetitiveLandscape map[string]interface{} `json:"competitive_landscape,omitempty"`
	CustomFields        map[string]interface{} `json:"custom_fields,omitempty"`
}

type Challenge struct {
	Category     string `json:"category"`
	Description  string `json:"description"`
	Priority     int    `json:"priority"` // 1-5
	Impact       string `json:"impact"`
	CurrentState string `json:"current_state,omitempty"`
}

type Challenges []Challenge

type Goal struct {
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Priority    int       `json:"priority"` // 1-5
	Timeline    string    `json:"timeline"`
	Success     string    `json:"success_criteria"`
	Deadline    *time.Time `json:"deadline,omitempty"`
}

type Goals []Goal

type Budget struct {
	MinBudget    *int64 `json:"min_budget,omitempty"`
	MaxBudget    *int64 `json:"max_budget,omitempty"`
	PreferredBudget *int64 `json:"preferred_budget,omitempty"`
	Timeline     string `json:"timeline,omitempty"`
	Flexibility  string `json:"flexibility,omitempty"` // rigid, flexible, very_flexible
	Notes        string `json:"notes,omitempty"`
}

type NextStep struct {
	Task        string     `json:"task"`
	Owner       string     `json:"owner"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	Status      string     `json:"status"` // pending, in_progress, completed
	Description string     `json:"description,omitempty"`
}

type NextSteps []NextStep

// Domain models that extend the generated query models
type Consultation struct {
	query.Consultation
	// Add computed fields and business logic helpers
	ParsedBusinessData *BusinessData `json:"parsed_business_data,omitempty"`
	ParsedChallenges   *Challenges   `json:"parsed_challenges,omitempty"`
	ParsedGoals        *Goals        `json:"parsed_goals,omitempty"`
	ParsedBudget       *Budget       `json:"parsed_budget,omitempty"`
	ParsedNextSteps    *NextSteps    `json:"parsed_next_steps,omitempty"`
}

type ConsultationDraft struct {
	query.ConsultationDraft
	ParsedDraftData map[string]interface{} `json:"parsed_draft_data,omitempty"`
}

type ConsultationVersion struct {
	query.ConsultationVersion
	ParsedVersionData map[string]interface{} `json:"parsed_version_data,omitempty"`
}

// Business-focused response models
type ConsultationSummary struct {
	ID               uuid.UUID          `json:"id"`
	BusinessName     string             `json:"business_name"`
	ContactName      string             `json:"contact_name"`
	Email            string             `json:"email"`
	Industry         string             `json:"industry"`
	Location         string             `json:"location"`
	Status           ConsultationStatus `json:"status"`
	ConsultationDate *time.Time         `json:"consultation_date,omitempty"`
	CommitmentLevel  *int32             `json:"commitment_level,omitempty"`
	Created          time.Time          `json:"created"`
	Updated          time.Time          `json:"updated"`
}

type ConsultationWithUser struct {
	Consultation *Consultation `json:"consultation"`
	User         *query.User   `json:"user"`
}

// Helper methods for parsing JSONB fields
func (c *Consultation) ParseBusinessData() error {
	if c.ParsedBusinessData != nil {
		return nil
	}

	if len(c.BusinessData) == 0 {
		c.ParsedBusinessData = &BusinessData{}
		return nil
	}

	var data BusinessData
	if err := json.Unmarshal(c.BusinessData, &data); err != nil {
		return err
	}
	c.ParsedBusinessData = &data
	return nil
}

func (c *Consultation) ParseChallenges() error {
	if c.ParsedChallenges != nil {
		return nil
	}

	if len(c.Challenges) == 0 {
		c.ParsedChallenges = &Challenges{}
		return nil
	}

	var challenges Challenges
	if err := json.Unmarshal(c.Challenges, &challenges); err != nil {
		return err
	}
	c.ParsedChallenges = &challenges
	return nil
}

func (c *Consultation) ParseGoals() error {
	if c.ParsedGoals != nil {
		return nil
	}

	if len(c.Goals) == 0 {
		c.ParsedGoals = &Goals{}
		return nil
	}

	var goals Goals
	if err := json.Unmarshal(c.Goals, &goals); err != nil {
		return err
	}
	c.ParsedGoals = &goals
	return nil
}

func (c *Consultation) ParseBudget() error {
	if c.ParsedBudget != nil {
		return nil
	}

	if len(c.Budget) == 0 {
		c.ParsedBudget = &Budget{}
		return nil
	}

	var budget Budget
	if err := json.Unmarshal(c.Budget, &budget); err != nil {
		return err
	}
	c.ParsedBudget = &budget
	return nil
}

func (c *Consultation) ParseNextSteps() error {
	if c.ParsedNextSteps != nil {
		return nil
	}

	if len(c.NextSteps) == 0 {
		c.ParsedNextSteps = &NextSteps{}
		return nil
	}

	var steps NextSteps
	if err := json.Unmarshal(c.NextSteps, &steps); err != nil {
		return err
	}
	c.ParsedNextSteps = &steps
	return nil
}

// Parse all JSONB fields at once
func (c *Consultation) ParseAllJSONFields() error {
	if err := c.ParseBusinessData(); err != nil {
		return err
	}
	if err := c.ParseChallenges(); err != nil {
		return err
	}
	if err := c.ParseGoals(); err != nil {
		return err
	}
	if err := c.ParseBudget(); err != nil {
		return err
	}
	if err := c.ParseNextSteps(); err != nil {
		return err
	}
	return nil
}

// Helper method to convert to summary
func (c *Consultation) ToSummary() *ConsultationSummary {
	var consultationDate *time.Time
	if c.ConsultationDate.Valid {
		consultationDate = &c.ConsultationDate.Time
	}

	var commitmentLevel *int32
	if c.CommitmentLevel.Valid {
		commitmentLevel = &c.CommitmentLevel.Int32
	}

	return &ConsultationSummary{
		ID:               c.ID,
		BusinessName:     c.BusinessName,
		ContactName:      c.ContactName,
		Email:            c.Email,
		Industry:         c.Industry,
		Location:         c.Location,
		Status:           ConsultationStatus(c.Status),
		ConsultationDate: consultationDate,
		CommitmentLevel:  commitmentLevel,
		Created:          c.Created,
		Updated:          c.Updated,
	}
}

// Validation helpers
func (s ConsultationStatus) IsValid() bool {
	switch s {
	case StatusScheduled, StatusInProgress, StatusCompleted, StatusCancelled, StatusFollowUp:
		return true
	default:
		return false
	}
}

func (p PreferredContact) IsValid() bool {
	switch p {
	case ContactEmail, ContactPhone, ContactBoth:
		return true
	default:
		return false
	}
}

// Helper functions for creating JSON data
func MarshalBusinessData(data *BusinessData) (json.RawMessage, error) {
	if data == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(data)
}

func MarshalChallenges(challenges *Challenges) (json.RawMessage, error) {
	if challenges == nil {
		return json.RawMessage("[]"), nil
	}
	return json.Marshal(challenges)
}

func MarshalGoals(goals *Goals) (json.RawMessage, error) {
	if goals == nil {
		return json.RawMessage("[]"), nil
	}
	return json.Marshal(goals)
}

func MarshalBudget(budget *Budget) (json.RawMessage, error) {
	if budget == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(budget)
}

func MarshalNextSteps(steps *NextSteps) (json.RawMessage, error) {
	if steps == nil {
		return json.RawMessage("[]"), nil
	}
	return json.Marshal(steps)
}