package rest

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleGetOverview_InvalidClientId(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()

	req := makeAuthRequest("GET", "/api/content/overview/bad-uuid", nil, agencyID, userID)
	req.SetPathValue("clientId", "bad-uuid")
	w := httptest.NewRecorder()

	h.handleGetOverview(w, req)

	resp := assertJSONResponse(t, w, http.StatusBadRequest)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "invalid client ID format")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetOverview_ClientNotFound(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	req := makeAuthRequest("GET", "/api/content/overview/"+clientID.String(), nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetOverview(w, req)

	resp := assertJSONResponse(t, w, http.StatusNotFound)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "client not found")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetOverview_EmptyClient(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	// Allow any order since the handler runs 6 goroutines concurrently.
	mock.MatchExpectationsInOrder(false)

	// Client EXISTS check
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// fetchCrawlOverview: COUNT(*), MAX(created_at) from content_pages
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"count", "max_created_at"}).AddRow(0, nil))

	// fetchCrawlOverview: status from content_crawl_jobs (no rows)
	mock.ExpectQuery("SELECT status FROM content_crawl_jobs").
		WithArgs(clientID).
		WillReturnError(sql.ErrNoRows)

	// fetchSEOOverview: check if completed audit exists (none)
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	// fetchCopyOverview: copy_type, status, COUNT(*) (empty)
	mock.ExpectQuery("SELECT copy_type").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"copy_type", "status", "count"}))

	// fetchBrandOverview: source_type, updated_at (no rows)
	mock.ExpectQuery("SELECT source_type, updated_at FROM brand_profiles").
		WithArgs(clientID, agencyID).
		WillReturnError(sql.ErrNoRows)

	// fetchQuestionnaireOverview: EXISTS(... consultations ...)
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	// fetchActivityFeed: 3 queries
	// Copy activity
	mock.ExpectQuery("SELECT title, copy_type, created_at FROM content_copy").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"title", "copy_type", "created_at"}))

	// Crawl activity
	mock.ExpectQuery("SELECT url, created_at FROM content_pages").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"url", "created_at"}))

	// Brand activity
	mock.ExpectQuery("SELECT source_type, updated_at FROM brand_profiles").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"source_type", "updated_at"}))

	req := makeAuthRequest("GET", "/api/content/overview/"+clientID.String(), nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetOverview(w, req)

	resp := assertJSONResponse(t, w, http.StatusOK)
	assert.True(t, resp.Success)

	// Parse the data to verify structure
	dataBytes, err := json.Marshal(resp.Data)
	require.NoError(t, err)

	var overview overviewResponse
	err = json.Unmarshal(dataBytes, &overview)
	require.NoError(t, err)

	// Verify all sections are zeroed/empty
	assert.Equal(t, 0, overview.Crawl.TotalPages)
	assert.Nil(t, overview.Crawl.LastCrawledAt)
	assert.Equal(t, "none", overview.Crawl.Status)

	assert.Equal(t, 0, overview.SEO.Critical)
	assert.Equal(t, 0, overview.SEO.Warnings)
	assert.Equal(t, 0, overview.SEO.Notices)
	assert.Equal(t, 0, overview.SEO.Score) // no audit exists = zero score

	assert.Equal(t, 0, overview.Copy.Total)
	assert.Equal(t, 0, overview.Copy.Drafts)
	assert.Equal(t, 0, overview.Copy.Finals)

	assert.False(t, overview.Brand.HasProfile)

	assert.False(t, overview.Questionnaire.Completed)

	assert.Empty(t, overview.Activity)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetOverview_SEOScoreCalculation(t *testing.T) {
	tests := []struct {
		name      string
		critical  int
		warnings  int
		notices   int
		wantScore int
	}{
		{
			name:      "no issues = perfect score",
			critical:  0,
			warnings:  0,
			notices:   0,
			wantScore: 100,
		},
		{
			name:      "moderate issues",
			critical:  2,
			warnings:  5,
			notices:   3,
			wantScore: 100 - (2*10 + 5*3 + 3*1), // 100 - 38 = 62
		},
		{
			name:      "heavy issues clamp to zero",
			critical:  10,
			warnings:  10,
			notices:   10,
			wantScore: 0, // 100 - (100+30+10) = -40 → clamped to 0
		},
		{
			name:      "exactly 100 deduction",
			critical:  10,
			warnings:  0,
			notices:   0,
			wantScore: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h, mock := newTestHandler(t)
			agencyID := uuid.New()
			userID := uuid.New()
			clientID := uuid.New()

			mock.MatchExpectationsInOrder(false)

			// Client EXISTS
			mock.ExpectQuery("SELECT EXISTS").
				WithArgs(clientID, agencyID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

			// fetchCrawlOverview
			mock.ExpectQuery("SELECT COUNT").
				WithArgs(clientID).
				WillReturnRows(sqlmock.NewRows([]string{"count", "max"}).AddRow(0, nil))
			mock.ExpectQuery("SELECT status FROM content_crawl_jobs").
				WithArgs(clientID).
				WillReturnError(sql.ErrNoRows)

			// fetchSEOOverview: audit exists
			mock.ExpectQuery("SELECT EXISTS").
				WithArgs(clientID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

			// fetchSEOOverview: return severity rows
			seoRows := sqlmock.NewRows([]string{"severity", "count"})
			if tc.critical > 0 {
				seoRows.AddRow("critical", tc.critical)
			}
			if tc.warnings > 0 {
				seoRows.AddRow("warning", tc.warnings)
			}
			if tc.notices > 0 {
				seoRows.AddRow("notice", tc.notices)
			}
			mock.ExpectQuery("SELECT severity").
				WithArgs(clientID).
				WillReturnRows(seoRows)

			// fetchCopyOverview
			mock.ExpectQuery("SELECT copy_type").
				WithArgs(clientID, agencyID).
				WillReturnRows(sqlmock.NewRows([]string{"copy_type", "status", "count"}))

			// fetchBrandOverview
			mock.ExpectQuery("SELECT source_type, updated_at FROM brand_profiles").
				WithArgs(clientID, agencyID).
				WillReturnError(sql.ErrNoRows)

			// fetchQuestionnaireOverview
			mock.ExpectQuery("SELECT EXISTS").
				WithArgs(clientID, agencyID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

			// fetchActivityFeed
			mock.ExpectQuery("SELECT title, copy_type, created_at FROM content_copy").
				WithArgs(clientID, agencyID).
				WillReturnRows(sqlmock.NewRows([]string{"title", "copy_type", "created_at"}))
			mock.ExpectQuery("SELECT url, created_at FROM content_pages").
				WithArgs(clientID).
				WillReturnRows(sqlmock.NewRows([]string{"url", "created_at"}))
			mock.ExpectQuery("SELECT source_type, updated_at FROM brand_profiles").
				WithArgs(clientID, agencyID).
				WillReturnRows(sqlmock.NewRows([]string{"source_type", "updated_at"}))

			req := makeAuthRequest("GET", "/api/content/overview/"+clientID.String(), nil, agencyID, userID)
			req.SetPathValue("clientId", clientID.String())
			w := httptest.NewRecorder()

			h.handleGetOverview(w, req)

			resp := assertJSONResponse(t, w, http.StatusOK)
			assert.True(t, resp.Success)

			dataBytes, err := json.Marshal(resp.Data)
			require.NoError(t, err)

			var overview overviewResponse
			err = json.Unmarshal(dataBytes, &overview)
			require.NoError(t, err)

			assert.Equal(t, tc.wantScore, overview.SEO.Score)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestHandleGetOverview_WithData(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	mock.MatchExpectationsInOrder(false)

	// Client EXISTS
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// fetchCrawlOverview: 5 pages, has last crawl time
	crawlTime := time.Now().Add(-1 * time.Hour)
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"count", "max"}).AddRow(5, crawlTime))
	mock.ExpectQuery("SELECT status FROM content_crawl_jobs").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("completed"))

	// fetchSEOOverview: audit exists, some issues
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT severity").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"severity", "count"}).
			AddRow("critical", 1).
			AddRow("warning", 3))

	// fetchCopyOverview: some content
	mock.ExpectQuery("SELECT copy_type").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"copy_type", "status", "count"}).
			AddRow("social_post", "draft", 4).
			AddRow("page_copy", "final", 2))

	// fetchBrandOverview: has profile
	brandTime := time.Now().Add(-24 * time.Hour)
	mock.ExpectQuery("SELECT source_type, updated_at FROM brand_profiles").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"source_type", "updated_at"}).AddRow("website", brandTime))

	// fetchQuestionnaireOverview: completed
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// fetchActivityFeed
	mock.ExpectQuery("SELECT title, copy_type, created_at FROM content_copy").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"title", "copy_type", "created_at"}).
			AddRow("Test Post", "social_post", time.Now()))
	mock.ExpectQuery("SELECT url, created_at FROM content_pages").
		WithArgs(clientID).
		WillReturnRows(sqlmock.NewRows([]string{"url", "created_at"}))
	mock.ExpectQuery("SELECT source_type, updated_at FROM brand_profiles").
		WithArgs(clientID, agencyID).
		WillReturnRows(sqlmock.NewRows([]string{"source_type", "updated_at"}))

	req := makeAuthRequest("GET", "/api/content/overview/"+clientID.String(), nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetOverview(w, req)

	resp := assertJSONResponse(t, w, http.StatusOK)
	assert.True(t, resp.Success)

	dataBytes, err := json.Marshal(resp.Data)
	require.NoError(t, err)

	var overview overviewResponse
	err = json.Unmarshal(dataBytes, &overview)
	require.NoError(t, err)

	assert.Equal(t, 5, overview.Crawl.TotalPages)
	assert.Equal(t, "completed", overview.Crawl.Status)
	assert.NotNil(t, overview.Crawl.LastCrawledAt)

	// Score = 100 - (1*10 + 3*3 + 0*1) = 100 - 19 = 81
	assert.Equal(t, 81, overview.SEO.Score)
	assert.Equal(t, 1, overview.SEO.Critical)
	assert.Equal(t, 3, overview.SEO.Warnings)

	assert.Equal(t, 6, overview.Copy.Total)
	assert.Equal(t, 4, overview.Copy.Drafts)
	assert.Equal(t, 2, overview.Copy.Finals)

	assert.True(t, overview.Brand.HasProfile)
	assert.Equal(t, "website", overview.Brand.SourceType)

	assert.True(t, overview.Questionnaire.Completed)

	assert.Len(t, overview.Activity, 1)
	require.NoError(t, mock.ExpectationsWereMet())
}
