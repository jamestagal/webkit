package jobs

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"content-service/internal/generator"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// handleGenerateCopy receives a GenerateCopyMsg and launches AI copy generation
// in a tracked goroutine.
func (m *Manager) handleGenerateCopy(msg *nats.Msg) {
	var genMsg GenerateCopyMsg
	if err := json.Unmarshal(msg.Data, &genMsg); err != nil {
		slog.Error("Failed to unmarshal generate copy message", "error", err)
		return
	}

	agencyID, err := uuid.Parse(genMsg.AgencyID)
	if err != nil {
		slog.Error("Invalid agency_id in generate copy", "agency_id", genMsg.AgencyID, "error", err)
		return
	}
	clientID, err := uuid.Parse(genMsg.ClientID)
	if err != nil {
		slog.Error("Invalid client_id in generate copy", "client_id", genMsg.ClientID, "error", err)
		return
	}
	generatedBy, err := uuid.Parse(genMsg.GeneratedBy)
	if err != nil {
		slog.Error("Invalid generated_by in generate copy", "generated_by", genMsg.GeneratedBy, "error", err)
		return
	}

	var pageID *uuid.UUID
	if genMsg.PageID != "" {
		parsed, err := uuid.Parse(genMsg.PageID)
		if err != nil {
			slog.Error("Invalid page_id in generate copy", "page_id", genMsg.PageID, "error", err)
			return
		}
		pageID = &parsed
	}

	slog.Info("Processing copy generation",
		"client_id", clientID,
		"copy_type", genMsg.CopyType,
		"page_id", genMsg.PageID,
	)

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()

		gen := generator.New(m.db, m.cfg.AnthropicAPIKey, m.embedClient)
		result, err := gen.GenerateCopy(m.ctx, generator.CopyRequest{
			ClientID:        clientID,
			AgencyID:        agencyID,
			PageID:          pageID,
			CopyType:        genMsg.CopyType,
			TargetKeyword:   genMsg.TargetKeyword,
			TargetWordCount: genMsg.TargetWordCount,
			Notes:           genMsg.Notes,
			GeneratedBy:     generatedBy,
		})
		if err != nil {
			slog.Error("Copy generation failed",
				"client_id", clientID,
				"copy_type", genMsg.CopyType,
				"error", err,
			)
			return
		}

		slog.Info("Copy generation complete",
			"copy_id", result.CopyID,
			"word_count", result.ActualWordCount,
			"model", result.ModelUsed,
		)
	}()
}

// handleGenerateBulk receives a GenerateBulkMsg and iterates over page IDs,
// generating copy for each sequentially in a tracked goroutine.
func (m *Manager) handleGenerateBulk(msg *nats.Msg) {
	var bulkMsg GenerateBulkMsg
	if err := json.Unmarshal(msg.Data, &bulkMsg); err != nil {
		slog.Error("Failed to unmarshal generate bulk message", "error", err)
		return
	}

	agencyID, err := uuid.Parse(bulkMsg.AgencyID)
	if err != nil {
		slog.Error("Invalid agency_id in generate bulk", "agency_id", bulkMsg.AgencyID, "error", err)
		return
	}
	clientID, err := uuid.Parse(bulkMsg.ClientID)
	if err != nil {
		slog.Error("Invalid client_id in generate bulk", "client_id", bulkMsg.ClientID, "error", err)
		return
	}
	generatedBy, err := uuid.Parse(bulkMsg.GeneratedBy)
	if err != nil {
		slog.Error("Invalid generated_by in generate bulk", "generated_by", bulkMsg.GeneratedBy, "error", err)
		return
	}

	slog.Info("Processing bulk generation",
		"client_id", clientID,
		"page_count", len(bulkMsg.PageIDs),
		"copy_type", bulkMsg.CopyType,
	)

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()

		gen := generator.New(m.db, m.cfg.AnthropicAPIKey, m.embedClient)

		for i, pageIDStr := range bulkMsg.PageIDs {
			pageID, err := uuid.Parse(pageIDStr)
			if err != nil {
				slog.Error("Invalid page_id in bulk generation",
					"page_id", pageIDStr,
					"error", err,
				)
				continue
			}

			// Determine target keyword for this page (positional match).
			var targetKeyword string
			if i < len(bulkMsg.TargetKeywords) {
				targetKeyword = bulkMsg.TargetKeywords[i]
			}

			result, err := gen.GenerateCopy(m.ctx, generator.CopyRequest{
				ClientID:      clientID,
				AgencyID:      agencyID,
				PageID:        &pageID,
				CopyType:      bulkMsg.CopyType,
				TargetKeyword: targetKeyword,
				GeneratedBy:   generatedBy,
			})
			if err != nil {
				slog.Error("Bulk generation failed for page",
					"page_id", pageID,
					"error", err,
				)
				continue
			}

			slog.Info("Bulk generation: page complete",
				"page_id", pageID,
				"copy_id", result.CopyID,
				"word_count", result.ActualWordCount,
				"progress", fmt.Sprintf("%d/%d", i+1, len(bulkMsg.PageIDs)),
			)
		}

		slog.Info("Bulk generation complete",
			"client_id", clientID,
			"page_count", len(bulkMsg.PageIDs),
		)
	}()
}
