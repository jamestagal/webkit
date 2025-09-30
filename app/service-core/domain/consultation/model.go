package consultation

import (
	"database/sql"
	"encoding/json"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
)

// Business-focused enums and constants
type ConsultationStatus string

const (
	StatusDraft     ConsultationStatus = "draft"
	StatusCompleted ConsultationStatus = "completed"
	StatusArchived  ConsultationStatus = "archived"
)

type UrgencyLevel string

const (
	UrgencyLow      UrgencyLevel = "low"
	UrgencyMedium   UrgencyLevel = "medium"
	UrgencyHigh     UrgencyLevel = "high"
	UrgencyCritical UrgencyLevel = "critical"
)

// Business data structures for JSONB fields according to new specification

// ContactInfo represents the contact information section
type ContactInfo struct {
	BusinessName  string                 `json:"business_name,omitempty"`
	ContactPerson string                 `json:"contact_person,omitempty"`
	Email         string                 `json:"email,omitempty"`
	Phone         string                 `json:"phone,omitempty"`
	Website       string                 `json:"website,omitempty"`
	SocialMedia   map[string]interface{} `json:"social_media,omitempty"`
}

// BusinessContext represents the business context section
type BusinessContext struct {
	Industry          string   `json:"industry,omitempty"`
	BusinessType      string   `json:"business_type,omitempty"`
	TeamSize          *int     `json:"team_size,omitempty"`
	CurrentPlatform   string   `json:"current_platform,omitempty"`
	DigitalPresence   []string `json:"digital_presence,omitempty"`
	MarketingChannels []string `json:"marketing_channels,omitempty"`
}

// PainPoints represents the pain points and challenges section
type PainPoints struct {
	PrimaryChallenges      []string     `json:"primary_challenges,omitempty"`
	TechnicalIssues        []string     `json:"technical_issues,omitempty"`
	UrgencyLevel          UrgencyLevel `json:"urgency_level,omitempty"`
	ImpactAssessment      string       `json:"impact_assessment,omitempty"`
	CurrentSolutionGaps   []string     `json:"current_solution_gaps,omitempty"`
}

// Timeline represents project timeline information
type Timeline struct {
	DesiredStart      string   `json:"desired_start,omitempty"`
	TargetCompletion  string   `json:"target_completion,omitempty"`
	Milestones        []string `json:"milestones,omitempty"`
}

// GoalsObjectives represents the goals and objectives section
type GoalsObjectives struct {
	PrimaryGoals       []string  `json:"primary_goals,omitempty"`
	SecondaryGoals     []string  `json:"secondary_goals,omitempty"`
	SuccessMetrics     []string  `json:"success_metrics,omitempty"`
	KPIs               []string  `json:"kpis,omitempty"`
	Timeline           *Timeline `json:"timeline,omitempty"`
	BudgetRange        string    `json:"budget_range,omitempty"`
	BudgetConstraints  []string  `json:"budget_constraints,omitempty"`
}

// Domain models that extend the generated query models
type Consultation struct {
	query.Consultation
	// Add computed fields and business logic helpers
	ParsedContactInfo      *ContactInfo      `json:"parsed_contact_info,omitempty"`
	ParsedBusinessContext  *BusinessContext  `json:"parsed_business_context,omitempty"`
	ParsedPainPoints       *PainPoints       `json:"parsed_pain_points,omitempty"`
	ParsedGoalsObjectives  *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
}

type ConsultationDraft struct {
	query.ConsultationDraft
	ParsedContactInfo      *ContactInfo      `json:"parsed_contact_info,omitempty"`
	ParsedBusinessContext  *BusinessContext  `json:"parsed_business_context,omitempty"`
	ParsedPainPoints       *PainPoints       `json:"parsed_pain_points,omitempty"`
	ParsedGoalsObjectives  *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
}

type ConsultationVersion struct {
	query.ConsultationVersion
	ParsedContactInfo      *ContactInfo      `json:"parsed_contact_info,omitempty"`
	ParsedBusinessContext  *BusinessContext  `json:"parsed_business_context,omitempty"`
	ParsedPainPoints       *PainPoints       `json:"parsed_pain_points,omitempty"`
	ParsedGoalsObjectives  *GoalsObjectives  `json:"parsed_goals_objectives,omitempty"`
	ParsedChangedFields    []string          `json:"parsed_changed_fields,omitempty"`
}

// Business-focused response models
type ConsultationSummary struct {
	ID                    uuid.UUID          `json:"id"`
	UserID                uuid.UUID          `json:"user_id"`
	BusinessName          string             `json:"business_name,omitempty"`
	ContactPerson         string             `json:"contact_person,omitempty"`
	Email                 string             `json:"email,omitempty"`
	Industry              string             `json:"industry,omitempty"`
	Status                ConsultationStatus `json:"status"`
	CompletionPercentage  int32              `json:"completion_percentage"`
	CreatedAt             time.Time          `json:"created_at"`
	UpdatedAt             time.Time          `json:"updated_at"`
	CompletedAt           *time.Time         `json:"completed_at,omitempty"`
}

type ConsultationWithUser struct {
	Consultation *Consultation `json:"consultation"`
	User         *query.User   `json:"user"`
}

// Helper methods for parsing JSONB fields
func (c *Consultation) ParseContactInfo() error {
	if c.ParsedContactInfo != nil {
		return nil
	}

	if len(c.ContactInfo) == 0 {
		c.ParsedContactInfo = &ContactInfo{}
		return nil
	}

	var data ContactInfo
	if err := json.Unmarshal(c.ContactInfo, &data); err != nil {
		return err
	}
	c.ParsedContactInfo = &data
	return nil
}

func (c *Consultation) ParseBusinessContext() error {
	if c.ParsedBusinessContext != nil {
		return nil
	}

	if len(c.BusinessContext) == 0 {
		c.ParsedBusinessContext = &BusinessContext{}
		return nil
	}

	var data BusinessContext
	if err := json.Unmarshal(c.BusinessContext, &data); err != nil {
		return err
	}
	c.ParsedBusinessContext = &data
	return nil
}

func (c *Consultation) ParsePainPoints() error {
	if c.ParsedPainPoints != nil {
		return nil
	}

	if len(c.PainPoints) == 0 {
		c.ParsedPainPoints = &PainPoints{}
		return nil
	}

	var data PainPoints
	if err := json.Unmarshal(c.PainPoints, &data); err != nil {
		return err
	}
	c.ParsedPainPoints = &data
	return nil
}

func (c *Consultation) ParseGoalsObjectives() error {
	if c.ParsedGoalsObjectives != nil {
		return nil
	}

	if len(c.GoalsObjectives) == 0 {
		c.ParsedGoalsObjectives = &GoalsObjectives{}
		return nil
	}

	var data GoalsObjectives
	if err := json.Unmarshal(c.GoalsObjectives, &data); err != nil {
		return err
	}
	c.ParsedGoalsObjectives = &data
	return nil
}

// Parse all JSONB fields at once
func (c *Consultation) ParseAllJSONFields() error {
	if err := c.ParseContactInfo(); err != nil {
		return err
	}
	if err := c.ParseBusinessContext(); err != nil {
		return err
	}
	if err := c.ParsePainPoints(); err != nil {
		return err
	}
	if err := c.ParseGoalsObjectives(); err != nil {
		return err
	}
	return nil
}

// CalculateCompletionPercentage calculates completion percentage based on filled sections
func (c *Consultation) CalculateCompletionPercentage() int32 {
	totalSections := int32(4)
	completedSections := int32(0)

	// Parse fields first
	_ = c.ParseAllJSONFields()

	// Check if contact_info has meaningful data
	if c.ParsedContactInfo != nil && c.ParsedContactInfo.BusinessName != "" {
		completedSections++
	}

	// Check if business_context has meaningful data
	if c.ParsedBusinessContext != nil && c.ParsedBusinessContext.Industry != "" {
		completedSections++
	}

	// Check if pain_points has meaningful data
	if c.ParsedPainPoints != nil && len(c.ParsedPainPoints.PrimaryChallenges) > 0 {
		completedSections++
	}

	// Check if goals_objectives has meaningful data
	if c.ParsedGoalsObjectives != nil && len(c.ParsedGoalsObjectives.PrimaryGoals) > 0 {
		completedSections++
	}

	return (completedSections * 100) / totalSections
}

// Helper method to convert to summary
func (c *Consultation) ToSummary() *ConsultationSummary {
	// Parse contact info to get business name and contact person
	_ = c.ParseContactInfo()

	var businessName, contactPerson, email string
	if c.ParsedContactInfo != nil {
		businessName = c.ParsedContactInfo.BusinessName
		contactPerson = c.ParsedContactInfo.ContactPerson
		email = c.ParsedContactInfo.Email
	}

	// Parse business context to get industry
	_ = c.ParseBusinessContext()
	var industry string
	if c.ParsedBusinessContext != nil {
		industry = c.ParsedBusinessContext.Industry
	}

	var completedAt *time.Time
	if c.CompletedAt.Valid {
		completedAt = &c.CompletedAt.Time
	}

	return &ConsultationSummary{
		ID:                   c.ID,
		UserID:              c.UserID,
		BusinessName:         businessName,
		ContactPerson:        contactPerson,
		Email:               email,
		Industry:            industry,
		Status:              ConsultationStatus(c.Status),
		CompletionPercentage: c.CompletionPercentage,
		CreatedAt:           c.CreatedAt,
		UpdatedAt:           c.UpdatedAt,
		CompletedAt:         completedAt,
	}
}

// ToDTO converts Consultation to ConsultationDTO for clean JSON serialization
func (c *Consultation) ToDTO() *ConsultationDTO {
	// Parse all JSON fields
	_ = c.ParseAllJSONFields()

	var completedAt *time.Time
	if c.CompletedAt.Valid {
		completedAt = &c.CompletedAt.Time
	}

	return &ConsultationDTO{
		ID:                    c.ID,
		UserID:                c.UserID,
		ContactInfo:           c.ContactInfo,
		BusinessContext:       c.BusinessContext,
		PainPoints:            c.PainPoints,
		GoalsObjectives:       c.GoalsObjectives,
		Status:                c.Status,
		CompletionPercentage:  c.CompletionPercentage,
		CreatedAt:             c.CreatedAt,
		UpdatedAt:             c.UpdatedAt,
		CompletedAt:           completedAt,
		ParsedContactInfo:     c.ParsedContactInfo,
		ParsedBusinessContext: c.ParsedBusinessContext,
		ParsedPainPoints:      c.ParsedPainPoints,
		ParsedGoalsObjectives: c.ParsedGoalsObjectives,
	}
}

// Validation helpers
func (s ConsultationStatus) IsValid() bool {
	switch s {
	case StatusDraft, StatusCompleted, StatusArchived:
		return true
	default:
		return false
	}
}

func (u UrgencyLevel) IsValid() bool {
	switch u {
	case UrgencyLow, UrgencyMedium, UrgencyHigh, UrgencyCritical:
		return true
	default:
		return false
	}
}

// Helper functions for creating JSON data
func MarshalContactInfo(data *ContactInfo) (json.RawMessage, error) {
	if data == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(data)
}

func MarshalBusinessContext(data *BusinessContext) (json.RawMessage, error) {
	if data == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(data)
}

func MarshalPainPoints(data *PainPoints) (json.RawMessage, error) {
	if data == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(data)
}

func MarshalGoalsObjectives(data *GoalsObjectives) (json.RawMessage, error) {
	if data == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(data)
}

// Draft-specific helpers
func (d *ConsultationDraft) ParseContactInfo() error {
	if d.ParsedContactInfo != nil {
		return nil
	}

	if len(d.ContactInfo) == 0 {
		d.ParsedContactInfo = &ContactInfo{}
		return nil
	}

	var data ContactInfo
	if err := json.Unmarshal(d.ContactInfo, &data); err != nil {
		return err
	}
	d.ParsedContactInfo = &data
	return nil
}

func (d *ConsultationDraft) ParseBusinessContext() error {
	if d.ParsedBusinessContext != nil {
		return nil
	}

	if len(d.BusinessContext) == 0 {
		d.ParsedBusinessContext = &BusinessContext{}
		return nil
	}

	var data BusinessContext
	if err := json.Unmarshal(d.BusinessContext, &data); err != nil {
		return err
	}
	d.ParsedBusinessContext = &data
	return nil
}

func (d *ConsultationDraft) ParsePainPoints() error {
	if d.ParsedPainPoints != nil {
		return nil
	}

	if len(d.PainPoints) == 0 {
		d.ParsedPainPoints = &PainPoints{}
		return nil
	}

	var data PainPoints
	if err := json.Unmarshal(d.PainPoints, &data); err != nil {
		return err
	}
	d.ParsedPainPoints = &data
	return nil
}

func (d *ConsultationDraft) ParseGoalsObjectives() error {
	if d.ParsedGoalsObjectives != nil {
		return nil
	}

	if len(d.GoalsObjectives) == 0 {
		d.ParsedGoalsObjectives = &GoalsObjectives{}
		return nil
	}

	var data GoalsObjectives
	if err := json.Unmarshal(d.GoalsObjectives, &data); err != nil {
		return err
	}
	d.ParsedGoalsObjectives = &data
	return nil
}

func (d *ConsultationDraft) ParseAllJSONFields() error {
	if err := d.ParseContactInfo(); err != nil {
		return err
	}
	if err := d.ParseBusinessContext(); err != nil {
		return err
	}
	if err := d.ParsePainPoints(); err != nil {
		return err
	}
	if err := d.ParseGoalsObjectives(); err != nil {
		return err
	}
	return nil
}

// ToDTO converts ConsultationDraft to ConsultationDraftDTO for clean JSON serialization
func (d *ConsultationDraft) ToDTO() *ConsultationDraftDTO {
	// Parse all JSON fields
	_ = d.ParseAllJSONFields()

	draftNotes := ""
	if d.DraftNotes.Valid {
		draftNotes = d.DraftNotes.String
	}

	return &ConsultationDraftDTO{
		ID:                    d.ID,
		ConsultationID:        d.ConsultationID,
		UserID:                d.UserID,
		ContactInfo:           d.ContactInfo,
		BusinessContext:       d.BusinessContext,
		PainPoints:            d.PainPoints,
		GoalsObjectives:       d.GoalsObjectives,
		AutoSaved:             d.AutoSaved,
		DraftNotes:            draftNotes,
		CreatedAt:             d.CreatedAt,
		UpdatedAt:             d.UpdatedAt,
		ParsedContactInfo:     d.ParsedContactInfo,
		ParsedBusinessContext: d.ParsedBusinessContext,
		ParsedPainPoints:      d.ParsedPainPoints,
		ParsedGoalsObjectives: d.ParsedGoalsObjectives,
	}
}

// Version-specific helpers
func (v *ConsultationVersion) ParseContactInfo() error {
	if v.ParsedContactInfo != nil {
		return nil
	}

	if len(v.ContactInfo) == 0 {
		v.ParsedContactInfo = &ContactInfo{}
		return nil
	}

	var data ContactInfo
	if err := json.Unmarshal(v.ContactInfo, &data); err != nil {
		return err
	}
	v.ParsedContactInfo = &data
	return nil
}

func (v *ConsultationVersion) ParseBusinessContext() error {
	if v.ParsedBusinessContext != nil {
		return nil
	}

	if len(v.BusinessContext) == 0 {
		v.ParsedBusinessContext = &BusinessContext{}
		return nil
	}

	var data BusinessContext
	if err := json.Unmarshal(v.BusinessContext, &data); err != nil {
		return err
	}
	v.ParsedBusinessContext = &data
	return nil
}

func (v *ConsultationVersion) ParsePainPoints() error {
	if v.ParsedPainPoints != nil {
		return nil
	}

	if len(v.PainPoints) == 0 {
		v.ParsedPainPoints = &PainPoints{}
		return nil
	}

	var data PainPoints
	if err := json.Unmarshal(v.PainPoints, &data); err != nil {
		return err
	}
	v.ParsedPainPoints = &data
	return nil
}

func (v *ConsultationVersion) ParseGoalsObjectives() error {
	if v.ParsedGoalsObjectives != nil {
		return nil
	}

	if len(v.GoalsObjectives) == 0 {
		v.ParsedGoalsObjectives = &GoalsObjectives{}
		return nil
	}

	var data GoalsObjectives
	if err := json.Unmarshal(v.GoalsObjectives, &data); err != nil {
		return err
	}
	v.ParsedGoalsObjectives = &data
	return nil
}

func (v *ConsultationVersion) ParseChangedFields() error {
	if v.ParsedChangedFields != nil {
		return nil
	}

	// ChangedFields is now json.RawMessage (not nullable)
	if len(v.ChangedFields) == 0 {
		v.ParsedChangedFields = []string{}
		return nil
	}

	var fields []string
	if err := json.Unmarshal(v.ChangedFields, &fields); err != nil {
		return err
	}
	v.ParsedChangedFields = fields
	return nil
}

func (v *ConsultationVersion) ParseAllJSONFields() error {
	if err := v.ParseContactInfo(); err != nil {
		return err
	}
	if err := v.ParseBusinessContext(); err != nil {
		return err
	}
	if err := v.ParsePainPoints(); err != nil {
		return err
	}
	if err := v.ParseGoalsObjectives(); err != nil {
		return err
	}
	if err := v.ParseChangedFields(); err != nil {
		return err
	}
	return nil
}

// ToDTO converts ConsultationVersion to ConsultationVersionDTO for clean JSON serialization
func (v *ConsultationVersion) ToDTO() *ConsultationVersionDTO {
	// Parse all JSON fields
	_ = v.ParseAllJSONFields()

	changeSummary := ""
	if v.ChangeSummary.Valid {
		changeSummary = v.ChangeSummary.String
	}

	return &ConsultationVersionDTO{
		ID:                    v.ID,
		ConsultationID:        v.ConsultationID,
		UserID:                v.UserID,
		VersionNumber:         v.VersionNumber,
		ContactInfo:           v.ContactInfo,
		BusinessContext:       v.BusinessContext,
		PainPoints:            v.PainPoints,
		GoalsObjectives:       v.GoalsObjectives,
		Status:                v.Status,
		CompletionPercentage:  v.CompletionPercentage,
		ChangeSummary:         changeSummary,
		ChangedFields:         v.ChangedFields,
		CreatedAt:             v.CreatedAt,
		ParsedContactInfo:     v.ParsedContactInfo,
		ParsedBusinessContext: v.ParsedBusinessContext,
		ParsedPainPoints:      v.ParsedPainPoints,
		ParsedGoalsObjectives: v.ParsedGoalsObjectives,
		ParsedChangedFields:   v.ParsedChangedFields,
	}
}

// MockConsultation creates a mock consultation for testing
func MockConsultation(id, userID uuid.UUID) query.Consultation {
	now := time.Now()
	return query.Consultation{
		ID:                   id,
		UserID:              userID,
		ContactInfo:          []byte(`{"business_name":"Test Business","contact_person":"John Doe","email":"john@test.com"}`),
		BusinessContext:      []byte(`{"industry":"Technology","team_size":10}`),
		PainPoints:           []byte(`{"primary_challenges":["Challenge 1"],"urgency_level":"medium"}`),
		GoalsObjectives:      []byte(`{"primary_goals":["Goal 1"],"budget_range":"$10k-25k"}`),
		Status:               "draft",
		CompletionPercentage: 75,
		CreatedAt:            now,
		UpdatedAt:            now,
	}
}

// MockConsultationVersion creates a mock consultation version for testing
func MockConsultationVersion(id, consultationID, userID uuid.UUID) query.ConsultationVersion {
	now := time.Now()
	changedFields, _ := json.Marshal([]string{"contactInfo", "businessContext"})
	return query.ConsultationVersion{
		ID:                   id,
		ConsultationID:       consultationID,
		UserID:              userID,
		VersionNumber:        1,
		ContactInfo:          []byte(`{"business_name":"Test Business","contact_person":"John Doe","email":"john@test.com"}`),
		BusinessContext:      []byte(`{"industry":"Technology","team_size":10}`),
		PainPoints:           []byte(`{"primary_challenges":["Challenge 1"],"urgency_level":"medium"}`),
		GoalsObjectives:      []byte(`{"primary_goals":["Goal 1"],"budget_range":"$10k-25k"}`),
		Status:               "draft",
		CompletionPercentage: 75,
		ChangeSummary:        sql.NullString{String: "Test version", Valid: true},
		ChangedFields:        changedFields,
		CreatedAt:            now,
	}
}