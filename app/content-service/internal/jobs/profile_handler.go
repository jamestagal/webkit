package jobs

import (
	"encoding/json"
	"log/slog"

	"content-service/internal/profiler"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// handleProfileGenerate receives a ProfileGenerateMsg and launches brand profile
// generation in a tracked goroutine.
func (m *Manager) handleProfileGenerate(msg *nats.Msg) {
	var genMsg ProfileGenerateMsg
	if err := json.Unmarshal(msg.Data, &genMsg); err != nil {
		slog.Error("Failed to unmarshal profile generate message", "error", err)
		return
	}

	agencyID, err := uuid.Parse(genMsg.AgencyID)
	if err != nil {
		slog.Error("Invalid agency_id in profile generate", "agency_id", genMsg.AgencyID, "error", err)
		return
	}
	clientID, err := uuid.Parse(genMsg.ClientID)
	if err != nil {
		slog.Error("Invalid client_id in profile generate", "client_id", genMsg.ClientID, "error", err)
		return
	}

	slog.Info("Profile generation starting",
		"client_id", clientID,
		"agency_id", agencyID,
	)

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()

		prof := profiler.New(m.db, m.cfg.AnthropicAPIKey, m.embedClient)
		profile, err := prof.Generate(m.ctx, clientID, agencyID)
		if err != nil {
			slog.Error("Brand profile generation failed",
				"client_id", clientID,
				"agency_id", agencyID,
				"error", err,
			)
			return
		}

		slog.Info("Brand profile generation complete",
			"client_id", clientID,
			"agency_id", agencyID,
			"personality_traits", len(profile.PersonalityTraits),
			"messaging_pillars", len(profile.MessagingPillars),
		)
	}()
}
