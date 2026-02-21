package rest

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// newTestHandler creates a Handler with a sqlmock DB for testing.
func newTestHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { db.Close() })

	h := &Handler{db: db}
	return h, mock
}

// makeAuthRequest creates an *http.Request with agencyID and userID injected into context.
func makeAuthRequest(method, path string, body io.Reader, agencyID, userID uuid.UUID) *http.Request {
	req := httptest.NewRequest(method, path, body)
	ctx := context.WithValue(req.Context(), ctxUserID, userID)
	ctx = context.WithValue(ctx, ctxAgencyID, agencyID)
	return req.WithContext(ctx)
}

// assertJSONResponse reads the response body, parses as apiResponse, asserts status code.
func assertJSONResponse(t *testing.T, w *httptest.ResponseRecorder, expectedStatus int) apiResponse {
	t.Helper()
	require.Equal(t, expectedStatus, w.Code, "unexpected status code; body: %s", w.Body.String())

	var resp apiResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err, "failed to decode response body")
	return resp
}
