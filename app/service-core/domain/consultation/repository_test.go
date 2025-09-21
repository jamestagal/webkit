package consultation_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"app/service-core/domain/consultation"
	"app/service-core/storage/query"
	"app/pkg/testing/testdb"
)

func TestConsultationRepository_CreateConsultation(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()

	input := consultation.CreateConsultationInput{
		UserID:       userID,
		BusinessName: "Test Company",
		ContactName:  "John Doe",
		Email:        "john@test.com",
		Phone:        "+1234567890",
		Website:      "https://test.com",
		Industry:     "technology",
		Location:     "San Francisco, CA",
		BusinessData: map[string]interface{}{
			"teamSize":      10,
			"currentPlatform": "wordpress",
		},
		Challenges: map[string]interface{}{
			"primary": []string{"slow website", "low conversions"},
		},
		Goals: map[string]interface{}{
			"primaryGoal": "increase conversions",
		},
		Budget: map[string]interface{}{
			"range": map[string]interface{}{
				"min": 5000,
				"max": 15000,
			},
		},
	}

	consultation, err := repo.Create(context.Background(), input)

	require.NoError(t, err)
	assert.NotNil(t, consultation)
	assert.Equal(t, userID, consultation.UserID)
	assert.Equal(t, "Test Company", consultation.BusinessName)
	assert.Equal(t, "John Doe", consultation.ContactName)
	assert.Equal(t, "john@test.com", consultation.Email)
	assert.Equal(t, "technology", consultation.Industry)
	assert.Equal(t, "scheduled", consultation.Status)
	assert.NotZero(t, consultation.ID)
	assert.NotZero(t, consultation.CreatedAt)
}

func TestConsultationRepository_GetConsultation(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()

	// Create a consultation first
	input := consultation.CreateConsultationInput{
		UserID:       userID,
		BusinessName: "Test Company",
		ContactName:  "John Doe",
		Email:        "john@test.com",
		Industry:     "technology",
		Location:     "San Francisco, CA",
	}

	created, err := repo.Create(context.Background(), input)
	require.NoError(t, err)

	// Get the consultation
	consultation, err := repo.GetByID(context.Background(), created.ID)

	require.NoError(t, err)
	assert.Equal(t, created.ID, consultation.ID)
	assert.Equal(t, "Test Company", consultation.BusinessName)
	assert.Equal(t, "John Doe", consultation.ContactName)
}

func TestConsultationRepository_UpdateConsultation(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()

	// Create a consultation first
	input := consultation.CreateConsultationInput{
		UserID:       userID,
		BusinessName: "Test Company",
		ContactName:  "John Doe",
		Email:        "john@test.com",
		Industry:     "technology",
		Location:     "San Francisco, CA",
	}

	created, err := repo.Create(context.Background(), input)
	require.NoError(t, err)

	// Update the consultation
	updateInput := consultation.UpdateConsultationInput{
		BusinessName: "Updated Company",
		ContactName:  "Jane Doe",
		Status:       "completed",
	}

	updated, err := repo.Update(context.Background(), created.ID, updateInput)

	require.NoError(t, err)
	assert.Equal(t, "Updated Company", updated.BusinessName)
	assert.Equal(t, "Jane Doe", updated.ContactName)
	assert.Equal(t, "completed", updated.Status)
	assert.True(t, updated.UpdatedAt.After(created.UpdatedAt))
}

func TestConsultationRepository_DeleteConsultation(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()

	// Create a consultation first
	input := consultation.CreateConsultationInput{
		UserID:       userID,
		BusinessName: "Test Company",
		ContactName:  "John Doe",
		Email:        "john@test.com",
		Industry:     "technology",
		Location:     "San Francisco, CA",
	}

	created, err := repo.Create(context.Background(), input)
	require.NoError(t, err)

	// Delete the consultation
	err = repo.Delete(context.Background(), created.ID)

	require.NoError(t, err)

	// Verify it's deleted
	_, err = repo.GetByID(context.Background(), created.ID)
	assert.Error(t, err)
}

func TestConsultationRepository_ListConsultations(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()

	// Create multiple consultations
	for i := 0; i < 3; i++ {
		input := consultation.CreateConsultationInput{
			UserID:       userID,
			BusinessName: fmt.Sprintf("Company %d", i+1),
			ContactName:  fmt.Sprintf("Contact %d", i+1),
			Email:        fmt.Sprintf("contact%d@test.com", i+1),
			Industry:     "technology",
			Location:     "San Francisco, CA",
		}

		_, err := repo.Create(context.Background(), input)
		require.NoError(t, err)
	}

	// List consultations
	consultations, err := repo.ListByUserID(context.Background(), userID, consultation.ListFilters{
		Limit:  10,
		Offset: 0,
	})

	require.NoError(t, err)
	assert.Len(t, consultations, 3)
	assert.Equal(t, "Company 1", consultations[0].BusinessName)
}

func TestConsultationDraft_CreateAndGet(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()
	consultationID := uuid.New()

	draftData := map[string]interface{}{
		"businessName": "Draft Company",
		"contactName":  "Draft Contact",
		"step":         2,
	}

	// Save draft
	err := repo.SaveDraft(context.Background(), consultationID, userID, draftData)
	require.NoError(t, err)

	// Get draft
	draft, err := repo.GetDraft(context.Background(), consultationID)
	require.NoError(t, err)
	assert.Equal(t, consultationID, draft.ConsultationID)
	assert.Equal(t, userID, draft.UserID)
	assert.Contains(t, draft.DraftData, "businessName")
}

func TestConsultationVersion_CreateAndList(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	repo := consultation.NewRepository(query.New(db))
	userID := uuid.New()
	consultationID := uuid.New()

	versionData := map[string]interface{}{
		"businessName": "Version Company",
		"version":      1,
	}

	// Create version
	version, err := repo.CreateVersion(context.Background(), consultationID, userID, versionData, "Initial version")
	require.NoError(t, err)
	assert.Equal(t, consultationID, version.ConsultationID)
	assert.Equal(t, 1, version.Version)

	// List versions
	versions, err := repo.ListVersions(context.Background(), consultationID)
	require.NoError(t, err)
	assert.Len(t, versions, 1)
	assert.Equal(t, "Initial version", versions[0].ChangeDescription)
}