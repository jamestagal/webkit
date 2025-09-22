package integration

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"service-core/domain/consultation"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
)

// TestFixtures provides realistic test data and helper functions for integration testing
type TestFixtures struct {
	db      *sql.DB
	queries *query.Queries
}

// NewTestFixtures creates a new test fixtures instance
func NewTestFixtures(db *sql.DB, queries *query.Queries) *TestFixtures {
	return &TestFixtures{
		db:      db,
		queries: queries,
	}
}

// BusinessType represents different business categories for test data
type BusinessType struct {
	Industry      string
	BusinessType  string
	TeamSizeRange []int
	CommonPains   []string
	TypicalGoals  []string
}

// GetBusinessTypes returns realistic business types for test data generation
func (f *TestFixtures) GetBusinessTypes() []BusinessType {
	return []BusinessType{
		{
			Industry:      "Technology",
			BusinessType:  "SaaS Startup",
			TeamSizeRange: []int{5, 25},
			CommonPains:   []string{"Manual processes", "Scaling challenges", "Technical debt", "User acquisition"},
			TypicalGoals:  []string{"Automate workflows", "Scale platform", "Improve user experience", "Increase revenue"},
		},
		{
			Industry:      "Healthcare",
			BusinessType:  "Medical Practice",
			TeamSizeRange: []int{10, 50},
			CommonPains:   []string{"Patient management", "Compliance issues", "Appointment scheduling", "Insurance processing"},
			TypicalGoals:  []string{"Improve patient care", "Streamline operations", "Ensure compliance", "Reduce costs"},
		},
		{
			Industry:      "E-commerce",
			BusinessType:  "Online Retailer",
			TeamSizeRange: []int{3, 30},
			CommonPains:   []string{"Inventory management", "Customer support", "Marketing ROI", "Order fulfillment"},
			TypicalGoals:  []string{"Increase sales", "Improve customer satisfaction", "Optimize inventory", "Expand market reach"},
		},
		{
			Industry:      "Professional Services",
			BusinessType:  "Consulting Firm",
			TeamSizeRange: []int{2, 15},
			CommonPains:   []string{"Time tracking", "Client communication", "Project management", "Resource allocation"},
			TypicalGoals:  []string{"Improve efficiency", "Enhance client satisfaction", "Increase billable hours", "Scale operations"},
		},
		{
			Industry:      "Education",
			BusinessType:  "Educational Institution",
			TeamSizeRange: []int{20, 200},
			CommonPains:   []string{"Student engagement", "Administrative burden", "Technology integration", "Budget constraints"},
			TypicalGoals:  []string{"Improve learning outcomes", "Streamline administration", "Enhance technology", "Reduce costs"},
		},
		{
			Industry:      "Manufacturing",
			BusinessType:  "Small Manufacturer",
			TeamSizeRange: []int{15, 100},
			CommonPains:   []string{"Production efficiency", "Quality control", "Supply chain issues", "Equipment maintenance"},
			TypicalGoals:  []string{"Increase productivity", "Improve quality", "Optimize supply chain", "Reduce downtime"},
		},
		{
			Industry:      "Financial Services",
			BusinessType:  "Financial Advisory",
			TeamSizeRange: []int{5, 40},
			CommonPains:   []string{"Compliance requirements", "Client reporting", "Market volatility", "Technology gaps"},
			TypicalGoals:  []string{"Ensure compliance", "Improve client service", "Optimize portfolios", "Modernize systems"},
		},
	}
}

// ContactTemplate represents a contact information template
type ContactTemplate struct {
	BusinessNameTemplate string
	ContactPersonFirst   []string
	ContactPersonLast    []string
	EmailDomains         []string
	PhoneFormats         []string
	WebsiteTemplates     []string
	SocialPlatforms      []string
}

// GetContactTemplates returns realistic contact templates
func (f *TestFixtures) GetContactTemplates() ContactTemplate {
	return ContactTemplate{
		BusinessNameTemplate: "%s %s",
		ContactPersonFirst:   []string{"John", "Jane", "Michael", "Sarah", "David", "Lisa", "Robert", "Emma", "James", "Maria"},
		ContactPersonLast:    []string{"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"},
		EmailDomains:         []string{"gmail.com", "company.com", "business.org", "enterprise.net", "startup.io"},
		PhoneFormats:         []string{"+1-555-01%02d", "+1-444-02%02d", "+1-333-03%02d"},
		WebsiteTemplates:     []string{"https://%s.com", "https://www.%s.org", "https://%s.io", "https://%s.net"},
		SocialPlatforms:      []string{"linkedin", "twitter", "facebook", "instagram"},
	}
}

// ConsultationFixture represents a complete consultation fixture
type ConsultationFixture struct {
	ID                    uuid.UUID
	UserID               uuid.UUID
	ContactInfo          *consultation.ContactInfo
	BusinessContext      *consultation.BusinessContext
	PainPoints           *consultation.PainPoints
	GoalsObjectives      *consultation.GoalsObjectives
	Status               consultation.ConsultationStatus
	CompletionPercentage int32
	CreatedAt            time.Time
	UpdatedAt            time.Time
	CompletedAt          *time.Time
}

// GenerateRealisticConsultation creates a realistic consultation fixture
func (f *TestFixtures) GenerateRealisticConsultation(userID uuid.UUID, businessType BusinessType, status consultation.ConsultationStatus) *ConsultationFixture {
	contactTemplate := f.GetContactTemplates()

	// Generate realistic contact info
	businessName := fmt.Sprintf("%s Solutions", businessType.Industry)
	firstName := contactTemplate.ContactPersonFirst[len(businessName)%len(contactTemplate.ContactPersonFirst)]
	lastName := contactTemplate.ContactPersonLast[len(businessName)%len(contactTemplate.ContactPersonLast)]

	contactInfo := &consultation.ContactInfo{
		BusinessName:  businessName,
		ContactPerson: fmt.Sprintf("%s %s", firstName, lastName),
		Email:        fmt.Sprintf("%s.%s@%s", firstName, lastName, businessName+".com"),
		Phone:        fmt.Sprintf(contactTemplate.PhoneFormats[0], len(businessName)%100),
		Website:      fmt.Sprintf(contactTemplate.WebsiteTemplates[0], businessName),
		SocialMedia: map[string]interface{}{
			"linkedin": fmt.Sprintf("https://linkedin.com/company/%s", businessName),
			"twitter":  fmt.Sprintf("@%s", businessName),
		},
	}

	// Generate business context
	teamSize := businessType.TeamSizeRange[0] + (len(businessName) % (businessType.TeamSizeRange[1] - businessType.TeamSizeRange[0]))
	businessContext := &consultation.BusinessContext{
		Industry:        businessType.Industry,
		BusinessType:    businessType.BusinessType,
		TeamSize:        &teamSize,
		CurrentPlatform: "Legacy systems",
		DigitalPresence: []string{"Website", "Social Media", "Email Marketing"},
		MarketingChannels: []string{"SEO", "Social Media", "Content Marketing", "Email"},
	}

	// Generate pain points
	selectedPains := businessType.CommonPains[:2+len(businessName)%2] // Select 2-3 pain points
	painPoints := &consultation.PainPoints{
		PrimaryChallenges:     selectedPains,
		TechnicalIssues:       []string{"Outdated systems", "Poor integration"},
		UrgencyLevel:         consultation.UrgencyMedium,
		ImpactAssessment:     "Significant impact on daily operations and growth potential",
		CurrentSolutionGaps:  []string{"Lack of automation", "Poor data visibility", "Manual reporting"},
	}

	// Generate goals and objectives
	selectedGoals := businessType.TypicalGoals[:2+len(businessName)%2] // Select 2-3 goals
	timeline := &consultation.Timeline{
		DesiredStart:     "Q1 2024",
		TargetCompletion: "Q3 2024",
		Milestones:       []string{"Phase 1: Discovery", "Phase 2: Implementation", "Phase 3: Testing"},
	}

	goalsObjectives := &consultation.GoalsObjectives{
		PrimaryGoals:      selectedGoals,
		SecondaryGoals:    []string{"Improve team productivity", "Better reporting"},
		SuccessMetrics:    []string{"50% reduction in manual tasks", "Improved customer satisfaction"},
		KPIs:             []string{"Revenue growth", "Operational efficiency", "Customer retention"},
		Timeline:         timeline,
		BudgetRange:      "$25k-50k",
		BudgetConstraints: []string{"Phased implementation", "ROI within 12 months"},
	}

	// Calculate completion percentage based on status
	var completionPercentage int32
	var completedAt *time.Time
	now := time.Now()

	switch status {
	case consultation.StatusDraft:
		completionPercentage = 25 + int32(len(businessName)%50) // 25-75%
	case consultation.StatusCompleted:
		completionPercentage = 100
		completedAt = &now
	case consultation.StatusArchived:
		completionPercentage = 100
		past := now.AddDate(0, -1, 0) // Completed 1 month ago
		completedAt = &past
	}

	return &ConsultationFixture{
		ID:                   uuid.New(),
		UserID:              userID,
		ContactInfo:         contactInfo,
		BusinessContext:     businessContext,
		PainPoints:          painPoints,
		GoalsObjectives:     goalsObjectives,
		Status:              status,
		CompletionPercentage: completionPercentage,
		CreatedAt:           now.AddDate(0, 0, -len(businessName)%30), // Created 0-30 days ago
		UpdatedAt:           now.AddDate(0, 0, -len(businessName)%5),  // Updated 0-5 days ago
		CompletedAt:         completedAt,
	}
}

// CreateConsultationFromFixture inserts a consultation fixture into the database
func (f *TestFixtures) CreateConsultationFromFixture(fixture *ConsultationFixture) error {
	// Marshal JSON fields
	contactInfoJSON, err := json.Marshal(fixture.ContactInfo)
	if err != nil {
		return fmt.Errorf("failed to marshal contact info: %w", err)
	}

	businessContextJSON, err := json.Marshal(fixture.BusinessContext)
	if err != nil {
		return fmt.Errorf("failed to marshal business context: %w", err)
	}

	painPointsJSON, err := json.Marshal(fixture.PainPoints)
	if err != nil {
		return fmt.Errorf("failed to marshal pain points: %w", err)
	}

	goalsObjectivesJSON, err := json.Marshal(fixture.GoalsObjectives)
	if err != nil {
		return fmt.Errorf("failed to marshal goals objectives: %w", err)
	}

	// Create consultation record
	var completedAtStr *string
	if fixture.CompletedAt != nil {
		completedAtString := fixture.CompletedAt.Format(time.RFC3339)
		completedAtStr = &completedAtString
	}

	_, err = f.db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points,
			goals_objectives, status, completion_percentage,
			created_at, updated_at, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		fixture.ID.String(),
		fixture.UserID.String(),
		string(contactInfoJSON),
		string(businessContextJSON),
		string(painPointsJSON),
		string(goalsObjectivesJSON),
		string(fixture.Status),
		fixture.CompletionPercentage,
		fixture.CreatedAt.Format(time.RFC3339),
		fixture.UpdatedAt.Format(time.RFC3339),
		completedAtStr,
	)

	return err
}

// CreateBulkConsultations creates multiple consultations for testing
func (f *TestFixtures) CreateBulkConsultations(userID uuid.UUID, count int, statuses []consultation.ConsultationStatus) ([]uuid.UUID, error) {
	businessTypes := f.GetBusinessTypes()
	createdIDs := make([]uuid.UUID, 0, count)

	for i := 0; i < count; i++ {
		businessType := businessTypes[i%len(businessTypes)]
		status := statuses[i%len(statuses)]

		fixture := f.GenerateRealisticConsultation(userID, businessType, status)

		err := f.CreateConsultationFromFixture(fixture)
		if err != nil {
			return createdIDs, fmt.Errorf("failed to create consultation %d: %w", i, err)
		}

		createdIDs = append(createdIDs, fixture.ID)
	}

	return createdIDs, nil
}

// CreateTestUser creates a test user in the database
func (f *TestFixtures) CreateTestUser(userID uuid.UUID, email, name string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := f.db.Exec(`
		INSERT INTO users (id, email, name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, userID.String(), email, name, now, now)
	return err
}

// CreateTestUsers creates multiple test users
func (f *TestFixtures) CreateTestUsers(count int) ([]uuid.UUID, error) {
	contactTemplate := f.GetContactTemplates()
	userIDs := make([]uuid.UUID, 0, count)

	for i := 0; i < count; i++ {
		userID := uuid.New()
		firstName := contactTemplate.ContactPersonFirst[i%len(contactTemplate.ContactPersonFirst)]
		lastName := contactTemplate.ContactPersonLast[i%len(contactTemplate.ContactPersonLast)]

		email := fmt.Sprintf("%s.%s@testuser%d.com", firstName, lastName, i+1)
		name := fmt.Sprintf("%s %s", firstName, lastName)

		err := f.CreateTestUser(userID, email, name)
		if err != nil {
			return userIDs, fmt.Errorf("failed to create user %d: %w", i, err)
		}

		userIDs = append(userIDs, userID)
	}

	return userIDs, nil
}

// CreateDraftFixture creates a consultation draft fixture
func (f *TestFixtures) CreateDraftFixture(consultationID, userID uuid.UUID) error {
	businessTypes := f.GetBusinessTypes()
	businessType := businessTypes[0] // Use first business type

	// Create partial data for draft
	contactInfo := &consultation.ContactInfo{
		BusinessName: "Draft Business",
		Email:       "draft@example.com",
	}

	businessContext := &consultation.BusinessContext{
		Industry: businessType.Industry,
		TeamSize: &[]int{10}[0],
	}

	contactInfoJSON, _ := json.Marshal(contactInfo)
	businessContextJSON, _ := json.Marshal(businessContext)

	now := time.Now().Format(time.RFC3339)

	_, err := f.db.Exec(`
		INSERT INTO consultation_drafts (
			id, consultation_id, user_id, contact_info, business_context,
			pain_points, goals_objectives, last_saved_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?, ?)
	`,
		uuid.New().String(),
		consultationID.String(),
		userID.String(),
		string(contactInfoJSON),
		string(businessContextJSON),
		now, now, now,
	)

	return err
}

// CreateVersionFixture creates a consultation version fixture
func (f *TestFixtures) CreateVersionFixture(consultationID, userID uuid.UUID, versionNumber int, changeSummary string, changedFields []string) error {
	fixture := f.GenerateRealisticConsultation(userID, f.GetBusinessTypes()[0], consultation.StatusDraft)

	contactInfoJSON, _ := json.Marshal(fixture.ContactInfo)
	businessContextJSON, _ := json.Marshal(fixture.BusinessContext)
	painPointsJSON, _ := json.Marshal(fixture.PainPoints)
	goalsObjectivesJSON, _ := json.Marshal(fixture.GoalsObjectives)
	changedFieldsJSON, _ := json.Marshal(changedFields)

	now := time.Now().Format(time.RFC3339)

	_, err := f.db.Exec(`
		INSERT INTO consultation_versions (
			id, consultation_id, user_id, version_number, contact_info,
			business_context, pain_points, goals_objectives, status,
			completion_percentage, change_summary, changed_fields, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		uuid.New().String(),
		consultationID.String(),
		userID.String(),
		versionNumber,
		string(contactInfoJSON),
		string(businessContextJSON),
		string(painPointsJSON),
		string(goalsObjectivesJSON),
		string(fixture.Status),
		fixture.CompletionPercentage,
		changeSummary,
		string(changedFieldsJSON),
		now,
	)

	return err
}

// CleanupTestData removes all test data for specific users
func (f *TestFixtures) CleanupTestData(userIDs []uuid.UUID) error {
	if len(userIDs) == 0 {
		return nil
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(userIDs))
	args := make([]interface{}, len(userIDs))
	for i, id := range userIDs {
		placeholders[i] = "?"
		args[i] = id.String()
	}

	inClause := fmt.Sprintf("(%s)", fmt.Sprintf("%s", placeholders))

	// Clean up in dependency order
	tables := []string{"consultation_versions", "consultation_drafts", "consultations", "users"}

	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM %s WHERE user_id IN %s", table, inClause)
		if table == "users" {
			query = fmt.Sprintf("DELETE FROM %s WHERE id IN %s", table, inClause)
		}

		_, err := f.db.Exec(query, args...)
		if err != nil {
			return fmt.Errorf("failed to cleanup %s: %w", table, err)
		}
	}

	return nil
}

// CleanupAllTestData removes all test data (use with caution!)
func (f *TestFixtures) CleanupAllTestData() error {
	tables := []string{"consultation_versions", "consultation_drafts", "consultations", "users"}

	for _, table := range tables {
		_, err := f.db.Exec(fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			return fmt.Errorf("failed to cleanup %s: %w", table, err)
		}
	}

	return nil
}

// GetRandomBusinessType returns a random business type for testing
func (f *TestFixtures) GetRandomBusinessType(seed int) BusinessType {
	businessTypes := f.GetBusinessTypes()
	return businessTypes[seed%len(businessTypes)]
}

// ValidationScenarios provides test scenarios for validation testing
type ValidationScenario struct {
	Name        string
	RequestData map[string]interface{}
	ShouldPass  bool
	ErrorFields []string
}

// GetValidationScenarios returns comprehensive validation test scenarios
func (f *TestFixtures) GetValidationScenarios() []ValidationScenario {
	return []ValidationScenario{
		{
			Name: "Valid complete consultation",
			RequestData: map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name":  "Valid Corp",
					"contact_person": "John Doe",
					"email":         "john@valid.com",
					"phone":         "+1-555-0123",
					"website":       "https://valid.com",
				},
				"business_context": map[string]interface{}{
					"industry":     "Technology",
					"team_size":    15,
					"business_type": "SaaS",
				},
				"pain_points": map[string]interface{}{
					"primary_challenges": []string{"Manual processes"},
					"urgency_level":     "medium",
				},
				"goals_objectives": map[string]interface{}{
					"primary_goals": []string{"Automation"},
					"budget_range":  "$10k-25k",
				},
			},
			ShouldPass: true,
		},
		{
			Name: "Invalid email format",
			RequestData: map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name": "Test Corp",
					"email":        "invalid-email",
				},
			},
			ShouldPass:  false,
			ErrorFields: []string{"email"},
		},
		{
			Name: "Invalid website URL",
			RequestData: map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name": "Test Corp",
					"website":      "not-a-url",
				},
			},
			ShouldPass:  false,
			ErrorFields: []string{"website"},
		},
		{
			Name: "Invalid urgency level",
			RequestData: map[string]interface{}{
				"pain_points": map[string]interface{}{
					"urgency_level": "invalid_urgency",
				},
			},
			ShouldPass:  false,
			ErrorFields: []string{"urgency_level"},
		},
		{
			Name: "Negative team size",
			RequestData: map[string]interface{}{
				"business_context": map[string]interface{}{
					"team_size": -5,
				},
			},
			ShouldPass:  false,
			ErrorFields: []string{"team_size"},
		},
		{
			Name: "Empty required fields",
			RequestData: map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name": "",
				},
			},
			ShouldPass:  false,
			ErrorFields: []string{"business_name"},
		},
	}
}

// PerformanceTestData represents data for performance testing
type PerformanceTestData struct {
	UserCount          int
	ConsultationsPerUser int
	ConcurrentRequests  int
	ExpectedMaxLatency  time.Duration
	ExpectedMinTPS      float64
}

// GetPerformanceTestScenarios returns performance test scenarios
func (f *TestFixtures) GetPerformanceTestScenarios() []PerformanceTestData {
	return []PerformanceTestData{
		{
			UserCount:           5,
			ConsultationsPerUser: 10,
			ConcurrentRequests:  10,
			ExpectedMaxLatency:  500 * time.Millisecond,
			ExpectedMinTPS:      50.0,
		},
		{
			UserCount:           10,
			ConsultationsPerUser: 20,
			ConcurrentRequests:  20,
			ExpectedMaxLatency:  1 * time.Second,
			ExpectedMinTPS:      25.0,
		},
		{
			UserCount:           20,
			ConsultationsPerUser: 50,
			ConcurrentRequests:  50,
			ExpectedMaxLatency:  2 * time.Second,
			ExpectedMinTPS:      10.0,
		},
	}
}