package profiler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// QuestionnaireContext aggregates discovery data from consultations and form submissions.
type QuestionnaireContext struct {
	// Consultation fields
	ConsultationID   uuid.UUID
	BusinessName     string
	Industry         string
	BusinessType     string
	PrimaryChallenges []string
	PrimaryGoals     []string
	ConversionGoal   string
	DesignStyles     []string
	AdmiredWebsites  []string
	ConsultationNotes string

	// Form submission fields
	FormSubmissionID uuid.UUID
	FormData         map[string]any
}

// GatherQuestionnaireContext queries the most recent consultation and form submission
// for a client and returns aggregated context for brand profile generation.
func (p *Profiler) GatherQuestionnaireContext(ctx context.Context, clientID, agencyID uuid.UUID) (*QuestionnaireContext, error) {
	qCtx := &QuestionnaireContext{}

	// Query the most recent completed consultation
	var (
		consultationID                  uuid.UUID
		businessName, industry, bizType string
		conversionGoal, notes           string
		challengesJSON, goalsJSON       json.RawMessage
		designStylesJSON, websitesJSON  json.RawMessage
	)

	err := p.db.QueryRowContext(ctx,
		`SELECT id, COALESCE(business_name, ''), COALESCE(industry, ''), COALESCE(business_type, ''),
			primary_challenges, primary_goals, COALESCE(conversion_goal, ''),
			design_styles, admired_websites, COALESCE(consultation_notes, '')
		 FROM consultations
		 WHERE client_id = $1 AND agency_id = $2 AND status = 'completed'
		 ORDER BY created_at DESC LIMIT 1`,
		clientID, agencyID,
	).Scan(
		&consultationID, &businessName, &industry, &bizType,
		&challengesJSON, &goalsJSON, &conversionGoal,
		&designStylesJSON, &websitesJSON, &notes,
	)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query consultation: %w", err)
	}

	if err == nil {
		qCtx.ConsultationID = consultationID
		qCtx.BusinessName = businessName
		qCtx.Industry = industry
		qCtx.BusinessType = bizType
		qCtx.ConversionGoal = conversionGoal
		qCtx.ConsultationNotes = notes

		// Unmarshal JSONB array columns
		qCtx.PrimaryChallenges = unmarshalStringArray(challengesJSON)
		qCtx.PrimaryGoals = unmarshalStringArray(goalsJSON)
		qCtx.DesignStyles = unmarshalStringArray(designStylesJSON)
		qCtx.AdmiredWebsites = unmarshalStringArray(websitesJSON)
	}

	// Query the most recent completed/processed form submission
	var (
		formID   uuid.UUID
		formData json.RawMessage
	)

	err = p.db.QueryRowContext(ctx,
		`SELECT id, data
		 FROM form_submissions
		 WHERE client_id = $1 AND agency_id = $2 AND status IN ('completed', 'processed')
		 ORDER BY submitted_at DESC LIMIT 1`,
		clientID, agencyID,
	).Scan(&formID, &formData)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query form submission: %w", err)
	}

	if err == nil {
		qCtx.FormSubmissionID = formID
		if len(formData) > 0 {
			var data map[string]any
			if jsonErr := json.Unmarshal(formData, &data); jsonErr == nil {
				qCtx.FormData = data
			}
		}
	}

	// Return nil if no data was found at all
	if qCtx.ConsultationID == uuid.Nil && qCtx.FormSubmissionID == uuid.Nil {
		return nil, fmt.Errorf("no questionnaire data found for client %s", clientID)
	}

	return qCtx, nil
}

// unmarshalStringArray safely converts a JSON raw message (JSONB array) into a []string.
func unmarshalStringArray(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	var result []string
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil
	}
	return result
}
