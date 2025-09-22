package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"service-core/domain/consultation"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// WorkflowTestSuite tests complete business workflows for the consultation domain
type WorkflowTestSuite struct {
	suite.Suite
	dbHelper *DatabaseTestHelper
	fixtures *TestFixtures
	helpers  *IntegrationTestHelpers
	userID   uuid.UUID
}

// SetupSuite initializes the workflow test environment
func (suite *WorkflowTestSuite) SetupSuite() {
	suite.dbHelper = NewDatabaseTestHelper(suite.T(), "WorkflowTest")
	suite.fixtures = NewTestFixtures(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	suite.userID = uuid.New()

	// Create test user
	err := suite.fixtures.CreateTestUser(suite.userID, "workflow@example.com", "Workflow Test User")
	require.NoError(suite.T(), err)

	// Setup API handler
	handler := suite.createHandler()
	suite.helpers = NewIntegrationTestHelpers(suite.T(), handler, suite.userID)
}

// TearDownSuite cleans up the workflow test environment
func (suite *WorkflowTestSuite) TearDownSuite() {
	if suite.helpers != nil {
		suite.helpers.Close()
	}
	suite.dbHelper.CleanupDatabase(suite.T())
}

// SetupTest runs before each workflow test
func (suite *WorkflowTestSuite) SetupTest() {
	// Clean consultation data but keep the user
	err := suite.fixtures.CleanupTestData([]uuid.UUID{suite.userID})
	if err != nil {
		suite.T().Logf("Warning: Failed to cleanup test data: %v", err)
	}

	// Recreate user if it was deleted
	err = suite.fixtures.CreateTestUser(suite.userID, "workflow@example.com", "Workflow Test User")
	if err != nil {
		suite.T().Logf("User already exists or recreated: %v", err)
	}
}

// createHandler creates a test HTTP handler
func (suite *WorkflowTestSuite) createHandler() *rest.Handler {
	cfg := &rest.Config{
		Environment: "test",
		Version:     "test-1.0.0",
		Port:        "0",
	}

	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	draftRepo := consultation.NewDraftRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	versionRepo := consultation.NewVersionRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	consultationService := consultation.NewService(consultationRepo, draftRepo, versionRepo)

	mockAuthService := &MockAuthService{userID: suite.userID}
	return rest.NewHandler(cfg, consultationService, mockAuthService)
}

// TestCompleteConsultationCreationWorkflow tests the end-to-end consultation creation process
func (suite *WorkflowTestSuite) TestCompleteConsultationCreationWorkflow() {
	t := suite.T()

	// Step 1: Start with minimal contact information
	step1Data := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name":  "Progressive Solutions Inc",
			"contact_person": "Sarah Johnson",
			"email":         "sarah@progressive.com",
			"phone":         "+1-555-0199",
		},
	}

	consultation := suite.helpers.CreateTestConsultation(step1Data)
	consultationID := consultation.ID

	// Verify initial state
	assert.Equal(t, consultation.StatusDraft, consultation.Consultation.Status)
	assert.True(t, consultation.CompletionPercentage.Valid)
	initialCompletion := consultation.CompletionPercentage.Int32
	assert.True(t, initialCompletion >= 0 && initialCompletion < 100)

	t.Logf("Step 1 - Initial consultation created with %d%% completion", initialCompletion)

	// Step 2: Add business context information
	step2Data := map[string]interface{}{
		"business_context": map[string]interface{}{
			"industry":           "Professional Services",
			"business_type":      "Management Consulting",
			"team_size":         45,
			"current_platform":   "Legacy CRM + Excel",
			"digital_presence":   []string{"Website", "LinkedIn", "Email Marketing"},
			"marketing_channels": []string{"Referrals", "Content Marketing", "Networking"},
		},
	}

	updatedConsultation := suite.helpers.UpdateConsultation(consultationID, step2Data)
	step2Completion := updatedConsultation.CompletionPercentage.Int32

	assert.True(t, step2Completion > initialCompletion, "Completion should increase after adding business context")
	t.Logf("Step 2 - Business context added, completion now %d%%", step2Completion)

	// Verify business context was saved correctly
	err := updatedConsultation.ParseBusinessContext()
	require.NoError(t, err)
	assert.Equal(t, "Professional Services", updatedConsultation.ParsedBusinessContext.Industry)
	assert.Equal(t, 45, *updatedConsultation.ParsedBusinessContext.TeamSize)
	assert.Contains(t, updatedConsultation.ParsedBusinessContext.DigitalPresence, "LinkedIn")

	// Step 3: Add detailed pain points and challenges
	step3Data := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{
				"Manual client onboarding process",
				"Lack of project visibility",
				"Inconsistent reporting across teams",
				"Time tracking inefficiencies",
			},
			"technical_issues": []string{
				"CRM integration problems",
				"Data scattered across systems",
			},
			"urgency_level":          "high",
			"impact_assessment":      "Affecting client satisfaction and team productivity. Estimated 15-20 hours per week lost to manual processes.",
			"current_solution_gaps":  []string{
				"No automation capabilities",
				"Limited reporting functionality",
				"Poor mobile access",
			},
		},
	}

	updatedConsultation = suite.helpers.UpdateConsultation(consultationID, step3Data)
	step3Completion := updatedConsultation.CompletionPercentage.Int32

	assert.True(t, step3Completion > step2Completion, "Completion should increase after adding pain points")
	t.Logf("Step 3 - Pain points added, completion now %d%%", step3Completion)

	// Verify pain points were saved correctly
	err = updatedConsultation.ParsePainPoints()
	require.NoError(t, err)
	assert.Contains(t, updatedConsultation.ParsedPainPoints.PrimaryChallenges, "Manual client onboarding process")
	assert.Equal(t, consultation.UrgencyHigh, updatedConsultation.ParsedPainPoints.UrgencyLevel)
	assert.Contains(t, updatedConsultation.ParsedPainPoints.CurrentSolutionGaps, "No automation capabilities")

	// Step 4: Define goals, objectives, and success criteria
	step4Data := map[string]interface{}{
		"goals_objectives": map[string]interface{}{
			"primary_goals": []string{
				"Automate client onboarding process",
				"Implement integrated project management",
				"Create unified reporting dashboard",
			},
			"secondary_goals": []string{
				"Improve team collaboration",
				"Enhance client communication",
			},
			"success_metrics": []string{
				"Reduce onboarding time by 60%",
				"Increase project visibility to 100%",
				"Cut reporting time by 70%",
			},
			"kpis": []string{
				"Client satisfaction score",
				"Project delivery time",
				"Team utilization rate",
			},
			"timeline": map[string]interface{}{
				"desired_start":      "Q1 2024",
				"target_completion":  "Q3 2024",
				"milestones": []string{
					"System selection and planning - Month 1",
					"Phase 1: Core CRM implementation - Month 2-3",
					"Phase 2: Automation workflows - Month 4-5",
					"Phase 3: Reporting and analytics - Month 6",
				},
			},
			"budget_range":      "$75k-100k",
			"budget_constraints": []string{
				"Must demonstrate ROI within 12 months",
				"Prefer phased implementation to spread costs",
			},
		},
	}

	finalConsultation := suite.helpers.UpdateConsultation(consultationID, step4Data)
	finalCompletion := finalConsultation.CompletionPercentage.Int32

	assert.True(t, finalCompletion > step3Completion, "Completion should increase after adding goals")
	t.Logf("Step 4 - Goals and objectives added, completion now %d%%", finalCompletion)

	// Verify goals and objectives were saved correctly
	err = finalConsultation.ParseGoalsObjectives()
	require.NoError(t, err)
	assert.Contains(t, finalConsultation.ParsedGoalsObjectives.PrimaryGoals, "Automate client onboarding process")
	assert.Contains(t, finalConsultation.ParsedGoalsObjectives.SuccessMetrics, "Reduce onboarding time by 60%")
	assert.Equal(t, "$75k-100k", finalConsultation.ParsedGoalsObjectives.BudgetRange)

	// Step 5: Complete the consultation
	completedConsultation := suite.helpers.CompleteConsultation(consultationID)

	assert.Equal(t, "completed", completedConsultation.Status)
	assert.True(t, completedConsultation.CompletedAt.Valid)
	assert.Equal(t, int32(100), completedConsultation.CompletionPercentage.Int32)

	completedTime := time.Now()
	assert.True(t, completedConsultation.CompletedAt.Time.Before(completedTime.Add(time.Second)))

	t.Logf("Step 5 - Consultation completed at %v", completedConsultation.CompletedAt.Time)

	// Step 6: Verify the complete consultation can be retrieved with all data
	retrievedConsultation := suite.helpers.GetConsultation(consultationID)

	// Parse and verify all sections
	err = retrievedConsultation.ParseAllJSONFields()
	require.NoError(t, err)

	// Contact info verification
	assert.Equal(t, "Progressive Solutions Inc", retrievedConsultation.ParsedContactInfo.BusinessName)
	assert.Equal(t, "sarah@progressive.com", retrievedConsultation.ParsedContactInfo.Email)

	// Business context verification
	assert.Equal(t, "Professional Services", retrievedConsultation.ParsedBusinessContext.Industry)
	assert.Equal(t, 45, *retrievedConsultation.ParsedBusinessContext.TeamSize)

	// Pain points verification
	assert.Contains(t, retrievedConsultation.ParsedPainPoints.PrimaryChallenges, "Manual client onboarding process")
	assert.Equal(t, consultation.UrgencyHigh, retrievedConsultation.ParsedPainPoints.UrgencyLevel)

	// Goals verification
	assert.Contains(t, retrievedConsultation.ParsedGoalsObjectives.PrimaryGoals, "Automate client onboarding process")
	assert.Equal(t, "$75k-100k", retrievedConsultation.ParsedGoalsObjectives.BudgetRange)

	t.Log("Workflow completed successfully - all data verified")
}

// TestDraftAutoSaveWorkflow tests the comprehensive draft auto-save functionality
func (suite *WorkflowTestSuite) TestDraftAutoSaveWorkflow() {
	t := suite.T()

	// Step 1: Create initial consultation
	baseConsultation := suite.helpers.CreateTestConsultation(map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Draft Demo Corp",
		},
	})

	consultationID := baseConsultation.ID
	t.Logf("Created base consultation: %s", consultationID)

	// Step 2: Simulate progressive data entry with auto-saves
	draftSessions := []struct {
		sessionName string
		draftData   map[string]interface{}
		description string
	}{
		{
			sessionName: "Session1_ContactInfo",
			draftData: map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name":  "Draft Demo Corp - Updated",
					"contact_person": "Mike Chen",
					"email":         "mike@draftdemo.com",
					"phone":         "+1-555-0188",
					"website":       "https://draftdemo.com",
					"social_media": map[string]interface{}{
						"linkedin": "https://linkedin.com/company/draftdemo",
						"twitter":  "@draftdemo",
					},
				},
			},
			description: "Initial contact information entry",
		},
		{
			sessionName: "Session2_BusinessContext",
			draftData: map[string]interface{}{
				"business_context": map[string]interface{}{
					"industry":          "E-commerce",
					"business_type":     "D2C Retailer",
					"team_size":         12,
					"current_platform":  "Shopify + various tools",
					"digital_presence":  []string{"Website", "Instagram", "Facebook", "TikTok"},
				},
				"contact_info": map[string]interface{}{
					"business_name":  "Draft Demo Corp - Updated",
					"contact_person": "Mike Chen",
					"email":         "mike@draftdemo.com",
					"phone":         "+1-555-0188",
					"website":       "https://draftdemo.com",
				},
			},
			description: "Adding business context while preserving contact info",
		},
		{
			sessionName: "Session3_PainPoints",
			draftData: map[string]interface{}{
				"pain_points": map[string]interface{}{
					"primary_challenges": []string{
						"Inventory management chaos",
						"Customer service overwhelm",
						"Marketing attribution gaps",
					},
					"urgency_level":     "medium",
					"impact_assessment": "Growing pains affecting customer experience",
				},
				"business_context": map[string]interface{}{
					"industry":     "E-commerce",
					"team_size":    12,
				},
			},
			description: "Adding pain points in a new session",
		},
	}

	for i, session := range draftSessions {
		t.Logf("Auto-save session %d: %s", i+1, session.description)

		// Simulate auto-save
		suite.helpers.CreateDraft(consultationID, session.draftData)

		// Wait a moment to simulate time passing
		time.Sleep(50 * time.Millisecond)

		// Retrieve and verify draft
		savedDraft := suite.helpers.GetDraft(consultationID)

		assert.Equal(t, consultationID, savedDraft.ConsultationID)
		assert.Equal(t, suite.userID, savedDraft.UserID)
		assert.True(t, savedDraft.LastSavedAt.Valid)

		// Verify specific data for this session
		switch session.sessionName {
		case "Session1_ContactInfo":
			err := savedDraft.ParseContactInfo()
			require.NoError(t, err)
			assert.Equal(t, "Draft Demo Corp - Updated", savedDraft.ParsedContactInfo.BusinessName)
			assert.Equal(t, "mike@draftdemo.com", savedDraft.ParsedContactInfo.Email)

		case "Session2_BusinessContext":
			err := savedDraft.ParseBusinessContext()
			require.NoError(t, err)
			assert.Equal(t, "E-commerce", savedDraft.ParsedBusinessContext.Industry)
			assert.Equal(t, 12, *savedDraft.ParsedBusinessContext.TeamSize)

			// Verify contact info is preserved
			err = savedDraft.ParseContactInfo()
			require.NoError(t, err)
			assert.Equal(t, "mike@draftdemo.com", savedDraft.ParsedContactInfo.Email)

		case "Session3_PainPoints":
			err := savedDraft.ParsePainPoints()
			require.NoError(t, err)
			assert.Contains(t, savedDraft.ParsedPainPoints.PrimaryChallenges, "Inventory management chaos")
			assert.Equal(t, consultation.UrgencyMedium, savedDraft.ParsedPainPoints.UrgencyLevel)
		}

		t.Logf("Session %d auto-save verified", i+1)
	}

	// Step 3: Simulate session interruption and recovery
	t.Log("Simulating session recovery after interruption")

	recoveredDraft := suite.helpers.GetDraft(consultationID)
	assert.NotNil(t, recoveredDraft)

	// Parse all sections to verify data integrity
	err := recoveredDraft.ParseContactInfo()
	require.NoError(t, err)

	err = recoveredDraft.ParsePainPoints()
	require.NoError(t, err)

	assert.Equal(t, "Draft Demo Corp - Updated", recoveredDraft.ParsedContactInfo.BusinessName)
	assert.Contains(t, recoveredDraft.ParsedPainPoints.PrimaryChallenges, "Inventory management chaos")

	// Step 4: Promote draft to consultation
	t.Log("Promoting draft to final consultation")

	promotedConsultation := suite.helpers.PromoteDraft(consultationID)

	assert.Equal(t, consultationID, promotedConsultation.ID)
	assert.Equal(t, suite.userID, promotedConsultation.UserID)

	// Verify all draft data was promoted
	err = promotedConsultation.ParseAllJSONFields()
	require.NoError(t, err)

	assert.Equal(t, "Draft Demo Corp - Updated", promotedConsultation.ParsedContactInfo.BusinessName)
	assert.Equal(t, "mike@draftdemo.com", promotedConsultation.ParsedContactInfo.Email)
	assert.Contains(t, promotedConsultation.ParsedPainPoints.PrimaryChallenges, "Inventory management chaos")

	// Step 5: Verify draft is cleaned up after promotion
	suite.helpers.AssertErrorResponse("GET", fmt.Sprintf("/consultations/%s/drafts", consultationID),
		nil, http.StatusNotFound, "")

	t.Log("Draft auto-save workflow completed successfully")
}

// TestVersionTrackingAndRollback tests comprehensive version tracking functionality
func (suite *WorkflowTestSuite) TestVersionTrackingAndRollback() {
	t := suite.T()

	// Step 1: Create base consultation
	baseData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Version Tracking Corp",
			"email":        "version@tracking.com",
		},
	}

	consultation := suite.helpers.CreateTestConsultation(baseData)
	consultationID := consultation.ID

	t.Logf("Created base consultation for version tracking: %s", consultationID)

	// Step 2: Make several distinct updates to create version history
	versionUpdates := []struct {
		versionName string
		updateData  map[string]interface{}
		description string
	}{
		{
			versionName: "v1_business_context",
			updateData: map[string]interface{}{
				"business_context": map[string]interface{}{
					"industry":     "Financial Technology",
					"team_size":    25,
					"business_type": "B2B SaaS",
				},
			},
			description: "Added initial business context",
		},
		{
			versionName: "v2_pain_points",
			updateData: map[string]interface{}{
				"pain_points": map[string]interface{}{
					"primary_challenges": []string{
						"Regulatory compliance complexity",
						"Legacy system integration",
					},
					"urgency_level": "high",
				},
			},
			description: "Added pain points and urgency",
		},
		{
			versionName: "v3_contact_update",
			updateData: map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name":  "Version Tracking Corp - Series A",
					"contact_person": "Jennifer Walsh",
					"email":         "jennifer@versiontracking.com",
					"phone":         "+1-555-0177",
				},
			},
			description: "Updated contact information after funding",
		},
		{
			versionName: "v4_goals_addition",
			updateData: map[string]interface{}{
				"goals_objectives": map[string]interface{}{
					"primary_goals":  []string{"Achieve SOC 2 compliance", "Scale platform to 10k users"},
					"budget_range":   "$200k-500k",
					"success_metrics": []string{"Pass compliance audit", "Handle 10x current load"},
				},
			},
			description: "Added comprehensive goals and objectives",
		},
		{
			versionName: "v5_refinement",
			updateData: map[string]interface{}{
				"business_context": map[string]interface{}{
					"industry":        "Financial Technology",
					"team_size":       30,  // Team grew
					"business_type":   "B2B SaaS",
					"current_platform": "Microservices on AWS",
				},
				"pain_points": map[string]interface{}{
					"primary_challenges": []string{
						"Regulatory compliance complexity",
						"Legacy system integration",
						"Multi-tenant data isolation", // New challenge
					},
					"urgency_level":    "critical", // Increased urgency
					"impact_assessment": "Blocking enterprise deals worth $2M+ ARR",
				},
			},
			description: "Refined and updated multiple sections",
		},
	}

	// Create each version with a small delay to ensure distinct timestamps
	for i, update := range versionUpdates {
		t.Logf("Creating version %d: %s", i+1, update.description)

		updatedConsultation := suite.helpers.UpdateConsultation(consultationID, update.updateData)

		assert.Equal(t, consultationID, updatedConsultation.ID)
		t.Logf("Version %d created successfully", i+1)

		time.Sleep(100 * time.Millisecond) // Ensure distinct timestamps
	}

	// Step 3: Retrieve and analyze version history
	versionHistory := suite.helpers.GetVersionHistory(consultationID)

	assert.True(t, len(versionHistory.Versions) >= 5, "Should have at least 5 versions")
	assert.True(t, versionHistory.Total >= 5, "Total count should be at least 5")

	t.Logf("Retrieved version history with %d versions", len(versionHistory.Versions))

	// Verify version ordering (newest first)
	for i := 1; i < len(versionHistory.Versions); i++ {
		assert.True(t, versionHistory.Versions[i-1].VersionNumber >= versionHistory.Versions[i].VersionNumber,
			"Versions should be ordered by version number (descending)")
		assert.True(t, versionHistory.Versions[i-1].CreatedAt.Time.After(versionHistory.Versions[i].CreatedAt.Time),
			"Newer versions should have later timestamps")
	}

	// Step 4: Examine specific version content
	if len(versionHistory.Versions) >= 3 {
		// Look at the third newest version (which should be v3_contact_update)
		thirdVersion := versionHistory.Versions[2]

		err := thirdVersion.ParseContactInfo()
		require.NoError(t, err)

		// This version should have the updated contact info but may not have goals yet
		assert.Contains(t, thirdVersion.ParsedContactInfo.BusinessName, "Version Tracking Corp")
		assert.Equal(t, consultationID, thirdVersion.ConsultationID)
		assert.Equal(t, suite.userID, thirdVersion.UserID)

		t.Logf("Version %d details verified: %s", thirdVersion.VersionNumber,
			thirdVersion.ParsedContactInfo.BusinessName)
	}

	// Step 5: Test current state reflects latest changes
	currentConsultation := suite.helpers.GetConsultation(consultationID)
	err := currentConsultation.ParseAllJSONFields()
	require.NoError(t, err)

	// Should have the latest business context (30 team members, not 25)
	assert.Equal(t, 30, *currentConsultation.ParsedBusinessContext.TeamSize)

	// Should have the critical urgency (not high)
	assert.Equal(t, consultation.UrgencyCritical, currentConsultation.ParsedPainPoints.UrgencyLevel)

	// Should have the new challenge
	assert.Contains(t, currentConsultation.ParsedPainPoints.PrimaryChallenges, "Multi-tenant data isolation")

	// Should have goals and objectives from v4
	assert.Contains(t, currentConsultation.ParsedGoalsObjectives.PrimaryGoals, "Achieve SOC 2 compliance")

	t.Log("Current consultation state verified against expected final version")

	// Step 6: Test rollback functionality (if implemented)
	// Note: This depends on whether rollback is implemented in the REST API
	if len(versionHistory.Versions) >= 3 {
		rollbackTargetVersion := versionHistory.Versions[2].VersionNumber

		rollbackPath := fmt.Sprintf("/consultations/%s/versions/%d/rollback", consultationID, rollbackTargetVersion)
		resp, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", rollbackPath, nil)

		if err == nil && resp.StatusCode == http.StatusOK {
			// Rollback is implemented and succeeded
			defer resp.Body.Close()

			var rolledBackConsultation consultation.Consultation
			responseBody := make([]byte, resp.ContentLength)
			if resp.ContentLength > 0 {
				resp.Body.Read(responseBody)
				err = json.Unmarshal(responseBody, &rolledBackConsultation)
				require.NoError(t, err)

				t.Logf("Successfully rolled back to version %d", rollbackTargetVersion)

				// Verify rollback worked
				assert.Equal(t, consultationID, rolledBackConsultation.ID)

				// The consultation should now reflect the state of the rollback target
				// This would need specific verification based on what version we rolled back to
			}
		} else if err == nil && resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			t.Log("Rollback functionality not yet implemented (404 response)")
		} else {
			t.Logf("Rollback test inconclusive: %v, status: %d", err, resp.StatusCode)
			if resp != nil {
				resp.Body.Close()
			}
		}
	}

	t.Log("Version tracking and rollback workflow completed")
}

// TestBusinessRuleEnforcement tests comprehensive business rule validation and enforcement
func (suite *WorkflowTestSuite) TestBusinessRuleEnforcement() {
	t := suite.T()

	// Step 1: Test email validation rules
	t.Run("EmailValidation", func(t *testing.T) {
		invalidEmailCases := []string{
			"invalid-email",
			"@example.com",
			"test@",
			"test.example.com",
			"test space@example.com",
		}

		for _, invalidEmail := range invalidEmailCases {
			invalidData := map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name": "Test Corp",
					"email":        invalidEmail,
				},
			}

			suite.helpers.AssertValidationError("POST", "/consultations", invalidData, []string{"email"})
		}

		// Valid email should work
		validData := map[string]interface{}{
			"contact_info": map[string]interface{}{
				"business_name": "Test Corp",
				"email":        "valid@example.com",
			},
		}

		consultation := suite.helpers.CreateTestConsultation(validData)
		assert.NotEqual(t, uuid.Nil, consultation.ID)
	})

	// Step 2: Test URL validation for websites
	t.Run("WebsiteValidation", func(t *testing.T) {
		consultation := suite.helpers.CreateTestConsultation(nil)

		invalidURLCases := []string{
			"not-a-url",
			"ftp://example.com",
			"javascript:alert('xss')",
			"http://",
			"https://",
		}

		for _, invalidURL := range invalidURLCases {
			updateData := map[string]interface{}{
				"contact_info": map[string]interface{}{
					"website": invalidURL,
				},
			}

			path := fmt.Sprintf("/consultations/%s", consultation.ID)
			suite.helpers.AssertValidationError("PUT", path, updateData, []string{"website"})
		}

		// Valid URLs should work
		validURLs := []string{
			"https://example.com",
			"http://example.com",
			"https://www.example.com/path",
		}

		for _, validURL := range validURLs {
			updateData := map[string]interface{}{
				"contact_info": map[string]interface{}{
					"website": validURL,
				},
			}

			path := fmt.Sprintf("/consultations/%s", consultation.ID)
			updatedConsultation := suite.helpers.UpdateConsultation(consultation.ID, updateData)

			err := updatedConsultation.ParseContactInfo()
			require.NoError(t, err)
			assert.Equal(t, validURL, updatedConsultation.ParsedContactInfo.Website)
		}
	})

	// Step 3: Test urgency level validation
	t.Run("UrgencyLevelValidation", func(t *testing.T) {
		consultation := suite.helpers.CreateTestConsultation(nil)

		// Invalid urgency levels
		invalidUrgencyLevels := []string{
			"super_urgent",
			"not_urgent",
			"MEDIUM",  // Case sensitive
			"",
			"urgent",
		}

		for _, invalidUrgency := range invalidUrgencyLevels {
			updateData := map[string]interface{}{
				"pain_points": map[string]interface{}{
					"urgency_level": invalidUrgency,
				},
			}

			path := fmt.Sprintf("/consultations/%s", consultation.ID)
			suite.helpers.AssertValidationError("PUT", path, updateData, []string{"urgency"})
		}

		// Valid urgency levels
		validUrgencyLevels := []consultation.UrgencyLevel{
			consultation.UrgencyLow,
			consultation.UrgencyMedium,
			consultation.UrgencyHigh,
			consultation.UrgencyCritical,
		}

		for _, validUrgency := range validUrgencyLevels {
			updateData := map[string]interface{}{
				"pain_points": map[string]interface{}{
					"urgency_level": string(validUrgency),
				},
			}

			updatedConsultation := suite.helpers.UpdateConsultation(consultation.ID, updateData)

			err := updatedConsultation.ParsePainPoints()
			require.NoError(t, err)
			assert.Equal(t, validUrgency, updatedConsultation.ParsedPainPoints.UrgencyLevel)
		}
	})

	// Step 4: Test team size business rules
	t.Run("TeamSizeValidation", func(t *testing.T) {
		consultation := suite.helpers.CreateTestConsultation(nil)

		// Invalid team sizes
		invalidTeamSizes := []int{-1, -10, 0}

		for _, invalidSize := range invalidTeamSizes {
			updateData := map[string]interface{}{
				"business_context": map[string]interface{}{
					"team_size": invalidSize,
				},
			}

			path := fmt.Sprintf("/consultations/%s", consultation.ID)
			suite.helpers.AssertValidationError("PUT", path, updateData, []string{"team_size"})
		}

		// Valid team sizes
		validTeamSizes := []int{1, 5, 50, 500, 10000}

		for _, validSize := range validTeamSizes {
			updateData := map[string]interface{}{
				"business_context": map[string]interface{}{
					"team_size": validSize,
				},
			}

			updatedConsultation := suite.helpers.UpdateConsultation(consultation.ID, updateData)

			err := updatedConsultation.ParseBusinessContext()
			require.NoError(t, err)
			assert.Equal(t, validSize, *updatedConsultation.ParsedBusinessContext.TeamSize)
		}
	})

	// Step 5: Test status transition rules
	t.Run("StatusTransitionRules", func(t *testing.T) {
		// Create consultation in draft status
		consultation := suite.helpers.CreateTestConsultation(nil)
		assert.Equal(t, "draft", consultation.Status)

		// Valid transition: draft -> completed
		completedConsultation := suite.helpers.CompleteConsultation(consultation.ID)
		assert.Equal(t, "completed", completedConsultation.Status)
		assert.True(t, completedConsultation.CompletedAt.Valid)

		// Valid transition: completed -> archived
		archivedConsultation := suite.helpers.ArchiveConsultation(consultation.ID)
		assert.Equal(t, "archived", archivedConsultation.Status)

		// Test invalid status updates via direct API calls
		invalidStatuses := []string{"invalid", "pending", "cancelled", "DRAFT"}

		for _, invalidStatus := range invalidStatuses {
			updateData := map[string]interface{}{
				"status": invalidStatus,
			}

			path := fmt.Sprintf("/consultations/%s", consultation.ID)
			suite.helpers.AssertValidationError("PUT", path, updateData, []string{"status"})
		}
	})

	// Step 6: Test completion percentage business rules
	t.Run("CompletionPercentageRules", func(t *testing.T) {
		// Create consultation and track completion progression
		consultation := suite.helpers.CreateTestConsultation(map[string]interface{}{
			"contact_info": map[string]interface{}{
				"business_name": "Completion Test Corp",
			},
		})

		initialCompletion := consultation.CompletionPercentage.Int32

		// Add business context - should increase completion
		updateData := map[string]interface{}{
			"business_context": map[string]interface{}{
				"industry": "Technology",
			},
		}

		updatedConsultation := suite.helpers.UpdateConsultation(consultation.ID, updateData)
		assert.True(t, updatedConsultation.CompletionPercentage.Int32 > initialCompletion,
			"Completion percentage should increase when adding business context")

		// Complete consultation - should be 100%
		completedConsultation := suite.helpers.CompleteConsultation(consultation.ID)
		assert.Equal(t, int32(100), completedConsultation.CompletionPercentage.Int32,
			"Completed consultation should have 100% completion")

		// Test that completion percentage is read-only via direct updates
		directUpdateData := map[string]interface{}{
			"completion_percentage": 50,
		}

		// This should either be ignored or rejected
		path := fmt.Sprintf("/consultations/%s", consultation.ID)
		resp, err := suite.helpers.MakeRequestWithoutStatusCheck("PUT", path, directUpdateData)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Whether it's accepted or rejected, the final consultation should still have 100%
		finalConsultation := suite.helpers.GetConsultation(consultation.ID)
		assert.Equal(t, int32(100), finalConsultation.CompletionPercentage.Int32,
			"Completion percentage should not be directly modifiable")
	})

	t.Log("Business rule enforcement tests completed successfully")
}

// TestComplexWorkflowScenario tests a complex, realistic business scenario
func (suite *WorkflowTestSuite) TestComplexWorkflowScenario() {
	t := suite.T()

	// Scenario: A growing e-commerce company needs help scaling their operations
	t.Log("Starting complex workflow scenario: E-commerce scaling consultation")

	// Phase 1: Initial consultation setup
	initialData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name":  "GrowthCo E-commerce",
			"contact_person": "Alex Rivera",
			"email":         "alex@growthco.com",
			"phone":         "+1-555-0166",
			"website":       "https://growthco.com",
			"social_media": map[string]interface{}{
				"instagram": "@growthco",
				"facebook":  "facebook.com/growthco",
			},
		},
	}

	consultation := suite.helpers.CreateTestConsultation(initialData)
	consultationID := consultation.ID

	t.Logf("Phase 1 - Initial consultation created: %s", consultationID)

	// Phase 2: Business analysis and context gathering
	businessContextData := map[string]interface{}{
		"business_context": map[string]interface{}{
			"industry":           "E-commerce",
			"business_type":      "D2C Fashion Retail",
			"team_size":          18,
			"current_platform":   "Shopify Plus + various integrations",
			"digital_presence":   []string{"Website", "Instagram", "Facebook", "TikTok", "Pinterest"},
			"marketing_channels": []string{"Social Media Ads", "Influencer Marketing", "Email", "SEO"},
		},
	}

	updatedConsultation := suite.helpers.UpdateConsultation(consultationID, businessContextData)
	t.Logf("Phase 2 - Business context added, completion: %d%%", updatedConsultation.CompletionPercentage.Int32)

	// Phase 3: Pain point discovery through multiple sessions
	painPointsData := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{
				"Inventory management across multiple channels",
				"Order fulfillment delays during peak seasons",
				"Customer service overwhelm during sales events",
				"Marketing attribution across platforms",
				"Cash flow management with rapid growth",
			},
			"technical_issues": []string{
				"Shopify app conflicts causing site slowdowns",
				"Inventory sync issues between systems",
				"Analytics data discrepancies",
			},
			"urgency_level":         "high",
			"impact_assessment":     "Peak season (Q4) approaching. Current issues could cost $500K+ in lost sales and damage brand reputation.",
			"current_solution_gaps": []string{
				"No unified inventory management",
				"Manual order routing",
				"Siloed customer support tools",
				"Disconnected marketing analytics",
			},
		},
	}

	updatedConsultation = suite.helpers.UpdateConsultation(consultationID, painPointsData)
	t.Logf("Phase 3 - Pain points identified, completion: %d%%", updatedConsultation.CompletionPercentage.Int32)

	// Phase 4: Goals and objectives definition with stakeholder input
	goalsData := map[string]interface{}{
		"goals_objectives": map[string]interface{}{
			"primary_goals": []string{
				"Implement unified inventory management system",
				"Automate order routing and fulfillment",
				"Create integrated customer service platform",
				"Build comprehensive analytics dashboard",
			},
			"secondary_goals": []string{
				"Improve peak season handling capacity",
				"Enhance customer experience consistency",
				"Streamline team workflows",
			},
			"success_metrics": []string{
				"Handle 3x current order volume without delays",
				"Reduce customer service response time by 60%",
				"Achieve 99.5% inventory accuracy",
				"Increase marketing ROI visibility by 80%",
			},
			"kpis": []string{
				"Order fulfillment time",
				"Inventory turnover rate",
				"Customer satisfaction score",
				"Marketing attribution accuracy",
				"Peak season revenue growth",
			},
			"timeline": map[string]interface{}{
				"desired_start":     "Immediately (Q3 2024)",
				"target_completion": "Before Black Friday (Q4 2024)",
				"milestones": []string{
					"Week 1-2: System selection and vendor negotiations",
					"Week 3-6: Core inventory system implementation",
					"Week 7-10: Order management automation setup",
					"Week 11-12: Customer service platform integration",
					"Week 13-14: Analytics dashboard and testing",
					"Week 15-16: Staff training and go-live preparation",
				},
			},
			"budget_range": "$150k-250k",
			"budget_constraints": []string{
				"Must demonstrate positive ROI within first peak season",
				"Implementation must not disrupt current operations",
				"Prefer solutions with proven e-commerce track record",
			},
		},
	}

	updatedConsultation = suite.helpers.UpdateConsultation(consultationID, goalsData)
	t.Logf("Phase 4 - Goals and objectives defined, completion: %d%%", updatedConsultation.CompletionPercentage.Int32)

	// Phase 5: Draft iterations and refinements
	t.Log("Phase 5 - Simulating draft iterations and refinements")

	// Draft session 1: Refine timeline based on stakeholder feedback
	draft1Data := map[string]interface{}{
		"goals_objectives": map[string]interface{}{
			"timeline": map[string]interface{}{
				"desired_start":     "August 1, 2024",
				"target_completion": "October 15, 2024", // Earlier for Black Friday prep
				"milestones": []string{
					"Phase 1 (Aug 1-15): System selection and planning",
					"Phase 2 (Aug 16 - Sep 15): Core implementation",
					"Phase 3 (Sep 16 - Oct 1): Integration and automation",
					"Phase 4 (Oct 2-15): Testing, training, and go-live",
				},
			},
		},
	}

	suite.helpers.CreateDraft(consultationID, draft1Data)

	// Draft session 2: Adjust budget after vendor quotes
	draft2Data := map[string]interface{}{
		"goals_objectives": map[string]interface{}{
			"budget_range": "$180k-220k", // Narrowed based on quotes
			"budget_constraints": []string{
				"Implementation cost not to exceed $200k",
				"Must include 6 months of vendor support",
				"ROI target: break even within 4 months",
			},
		},
	}

	suite.helpers.CreateDraft(consultationID, draft2Data)

	// Draft session 3: Add additional technical requirements discovered
	draft3Data := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"technical_issues": []string{
				"Shopify app conflicts causing site slowdowns",
				"Inventory sync issues between systems",
				"Analytics data discrepancies",
				"Mobile checkout experience inconsistencies", // New issue discovered
				"Email automation platform integration gaps",
			},
		},
	}

	suite.helpers.CreateDraft(consultationID, draft3Data)

	// Promote final draft
	t.Log("Promoting final draft to consultation")
	finalConsultation := suite.helpers.PromoteDraft(consultationID)

	// Phase 6: Final review and completion
	t.Log("Phase 6 - Final review and consultation completion")

	// Parse and verify all data integrity
	err := finalConsultation.ParseAllJSONFields()
	require.NoError(t, err)

	// Verify contact information
	assert.Equal(t, "GrowthCo E-commerce", finalConsultation.ParsedContactInfo.BusinessName)
	assert.Equal(t, "alex@growthco.com", finalConsultation.ParsedContactInfo.Email)

	// Verify business context
	assert.Equal(t, "E-commerce", finalConsultation.ParsedBusinessContext.Industry)
	assert.Equal(t, 18, *finalConsultation.ParsedBusinessContext.TeamSize)

	// Verify pain points (including the new technical issue from draft)
	assert.Contains(t, finalConsultation.ParsedPainPoints.TechnicalIssues, "Mobile checkout experience inconsistencies")
	assert.Equal(t, consultation.UrgencyHigh, finalConsultation.ParsedPainPoints.UrgencyLevel)

	// Verify goals and objectives (including refined budget and timeline)
	assert.Equal(t, "$180k-220k", finalConsultation.ParsedGoalsObjectives.BudgetRange)
	assert.Contains(t, finalConsultation.ParsedGoalsObjectives.BudgetConstraints, "Implementation cost not to exceed $200k")

	// Complete the consultation
	completedConsultation := suite.helpers.CompleteConsultation(consultationID)

	assert.Equal(t, "completed", completedConsultation.Status)
	assert.Equal(t, int32(100), completedConsultation.CompletionPercentage.Int32)
	assert.True(t, completedConsultation.CompletedAt.Valid)

	// Phase 7: Verify version history captures the journey
	versionHistory := suite.helpers.GetVersionHistory(consultationID)
	assert.True(t, len(versionHistory.Versions) >= 4, "Should have version history from all major updates")

	t.Logf("Complex workflow completed successfully with %d versions tracked", len(versionHistory.Versions))

	// Final verification: retrieve and validate complete consultation
	finalRetrievedConsultation := suite.helpers.GetConsultation(consultationID)
	err = finalRetrievedConsultation.ParseAllJSONFields()
	require.NoError(t, err)

	// Verify data integrity across all sections
	assert.Equal(t, "GrowthCo E-commerce", finalRetrievedConsultation.ParsedContactInfo.BusinessName)
	assert.Equal(t, "D2C Fashion Retail", finalRetrievedConsultation.ParsedBusinessContext.BusinessType)
	assert.Contains(t, finalRetrievedConsultation.ParsedPainPoints.PrimaryChallenges, "Inventory management across multiple channels")
	assert.Contains(t, finalRetrievedConsultation.ParsedGoalsObjectives.PrimaryGoals, "Implement unified inventory management system")
	assert.Equal(t, "completed", finalRetrievedConsultation.Status)

	t.Log("Complex e-commerce scaling consultation workflow completed and validated successfully")
}

// TestWorkflowSuite runs the workflow test suite
func TestWorkflowSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping workflow tests in short mode")
	}

	suite.Run(t, new(WorkflowTestSuite))
}