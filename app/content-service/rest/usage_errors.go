package rest

import (
	"errors"
	"net/http"
	"time"

	"app/pkg/usage"
)

// writeUsageError maps usage.* sentinel errors to HTTP status + a JSON body
// that includes the reset date (first day of next UTC month) so the SvelteKit
// client can display "resets on <date>" without recomputing. Returns true if
// it wrote a response; callers should then return without further work.
//
// Non-usage errors fall through to the caller's standard error handling.
func writeUsageError(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, usage.ErrLimitExceeded):
		writeJSON(w, http.StatusTooManyRequests, usageErrorBody(
			"monthly limit reached for this feature — upgrade for more",
			err,
		))
		return true
	case errors.Is(err, usage.ErrFeatureDisabled):
		writeJSON(w, http.StatusForbidden, usageErrorBody(
			"this feature is not available on your plan",
			err,
		))
		return true
	}
	return false
}

// usageErrorBody enriches the standard apiResponse with a reset_date hint.
// The UI uses reset_date to render "resets on DD Month YYYY" in upgrade prompts.
func usageErrorBody(msg string, _ error) apiResponse {
	// First day of next month in UTC.
	now := time.Now().UTC()
	reset := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	return apiResponse{
		Success: false,
		Message: msg,
		Data: map[string]any{
			"reset_date": reset.Format(time.RFC3339),
		},
	}
}
