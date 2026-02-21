package rest

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleGenerateSocial_Validation(t *testing.T) {
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantMsg    string
		mockSetup  func(sqlmock.Sqlmock)
	}{
		{
			name:       "bad JSON body",
			body:       `{bad json`,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid request body",
		},
		{
			name:       "invalid client_id",
			body:       `{"client_id":"not-a-uuid","platform":"twitter","topic":"test"}`,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid client_id format",
		},
		{
			name:       "invalid platform",
			body:       `{"client_id":"` + clientID.String() + `","platform":"tiktok","topic":"test"}`,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid platform",
		},
		{
			name:       "empty topic",
			body:       `{"client_id":"` + clientID.String() + `","platform":"twitter","topic":""}`,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "topic is required",
		},
		{
			name:       "invalid post_goal",
			body:       `{"client_id":"` + clientID.String() + `","platform":"twitter","topic":"test","post_goal":"invalid"}`,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid post_goal",
		},
		{
			name:       "valid input but client not found",
			body:       `{"client_id":"` + clientID.String() + `","platform":"twitter","topic":"test","post_goal":"engagement"}`,
			wantStatus: http.StatusNotFound,
			wantMsg:    "client not found",
			mockSetup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery("SELECT EXISTS").
					WithArgs(clientID, agencyID).
					WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
			},
		},
		{
			name:       "valid platforms pass validation - linkedin",
			body:       `{"client_id":"` + clientID.String() + `","platform":"linkedin","topic":"AI trends"}`,
			wantStatus: http.StatusNotFound,
			wantMsg:    "client not found",
			mockSetup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery("SELECT EXISTS").
					WithArgs(clientID, agencyID).
					WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
			},
		},
		{
			name:       "valid platforms pass validation - facebook",
			body:       `{"client_id":"` + clientID.String() + `","platform":"facebook","topic":"product launch"}`,
			wantStatus: http.StatusNotFound,
			wantMsg:    "client not found",
			mockSetup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery("SELECT EXISTS").
					WithArgs(clientID, agencyID).
					WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
			},
		},
		{
			name:       "valid platforms pass validation - instagram",
			body:       `{"client_id":"` + clientID.String() + `","platform":"instagram","topic":"behind the scenes"}`,
			wantStatus: http.StatusNotFound,
			wantMsg:    "client not found",
			mockSetup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery("SELECT EXISTS").
					WithArgs(clientID, agencyID).
					WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h, mock := newTestHandler(t)
			if tc.mockSetup != nil {
				tc.mockSetup(mock)
			}

			req := makeAuthRequest("POST", "/api/content/generate/social", strings.NewReader(tc.body), agencyID, userID)
			w := httptest.NewRecorder()

			h.handleGenerateSocial(w, req)

			resp := assertJSONResponse(t, w, tc.wantStatus)
			assert.False(t, resp.Success)
			assert.Contains(t, resp.Message, tc.wantMsg)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestHandleGetSocialPosts_InvalidClientId(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()

	req := makeAuthRequest("GET", "/api/content/social/not-a-uuid", nil, agencyID, userID)
	req.SetPathValue("clientId", "not-a-uuid")
	w := httptest.NewRecorder()

	h.handleGetSocialPosts(w, req)

	resp := assertJSONResponse(t, w, http.StatusBadRequest)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "invalid client ID format")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetSocialPosts_InvalidPageIdFilter(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	req := makeAuthRequest("GET", "/api/content/social/"+clientID.String()+"?page_id=not-a-uuid", nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetSocialPosts(w, req)

	resp := assertJSONResponse(t, w, http.StatusBadRequest)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "invalid page_id format")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetSocialPosts_EmptyResult(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	columns := []string{
		"id", "client_id", "agency_id", "page_id", "generated_by", "copy_type",
		"title", "content", "target_keyword", "target_word_count", "actual_word_count",
		"seo_score", "readability_score", "status", "prompt_tokens", "completion_tokens",
		"model_used", "generation_config", "created_at", "updated_at",
	}

	mock.ExpectQuery("SELECT .+ FROM content_copy").
		WithArgs(clientID, agencyID, 50, 0).
		WillReturnRows(sqlmock.NewRows(columns))

	req := makeAuthRequest("GET", "/api/content/social/"+clientID.String(), nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetSocialPosts(w, req)

	resp := assertJSONResponse(t, w, http.StatusOK)
	assert.True(t, resp.Success)
	// Data should be an empty array, not null
	data, ok := resp.Data.([]interface{})
	require.True(t, ok, "data should be an array, got %T", resp.Data)
	assert.Empty(t, data)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetSocialPosts_PlatformFilter(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	columns := []string{
		"id", "client_id", "agency_id", "page_id", "generated_by", "copy_type",
		"title", "content", "target_keyword", "target_word_count", "actual_word_count",
		"seo_score", "readability_score", "status", "prompt_tokens", "completion_tokens",
		"model_used", "generation_config", "created_at", "updated_at",
	}

	// With platform filter, query has 4 args: clientID, agencyID, platform, limit, offset
	mock.ExpectQuery("SELECT .+ FROM content_copy").
		WithArgs(clientID, agencyID, "twitter", 50, 0).
		WillReturnRows(sqlmock.NewRows(columns))

	req := makeAuthRequest("GET", "/api/content/social/"+clientID.String()+"?platform=twitter", nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetSocialPosts(w, req)

	resp := assertJSONResponse(t, w, http.StatusOK)
	assert.True(t, resp.Success)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHandleGetSocialPosts_CustomPagination(t *testing.T) {
	h, mock := newTestHandler(t)
	agencyID := uuid.New()
	userID := uuid.New()
	clientID := uuid.New()

	columns := []string{
		"id", "client_id", "agency_id", "page_id", "generated_by", "copy_type",
		"title", "content", "target_keyword", "target_word_count", "actual_word_count",
		"seo_score", "readability_score", "status", "prompt_tokens", "completion_tokens",
		"model_used", "generation_config", "created_at", "updated_at",
	}

	mock.ExpectQuery("SELECT .+ FROM content_copy").
		WithArgs(clientID, agencyID, 10, 20).
		WillReturnRows(sqlmock.NewRows(columns))

	req := makeAuthRequest("GET", "/api/content/social/"+clientID.String()+"?limit=10&offset=20", nil, agencyID, userID)
	req.SetPathValue("clientId", clientID.String())
	w := httptest.NewRecorder()

	h.handleGetSocialPosts(w, req)

	resp := assertJSONResponse(t, w, http.StatusOK)
	assert.True(t, resp.Success)
	require.NoError(t, mock.ExpectationsWereMet())
}
