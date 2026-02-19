package embeddings

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
)

// PageInput holds the data needed to run the embedding pipeline for a single page.
type PageInput struct {
	ClientID uuid.UUID
	PageID   uuid.UUID
	PageType string
	URL      string
	BodyText string
}

// RunPipeline processes a single page through the embedding pipeline:
// chunk text, generate embeddings, and store in the database.
func RunPipeline(ctx context.Context, db *sql.DB, client *Client, page PageInput) error {
	// Skip pages with too little content.
	if len(page.BodyText) < 50 {
		return nil
	}

	// If Workers AI client is not configured, skip silently.
	if client == nil {
		slog.Warn("embeddings: Workers AI client not configured, skipping embedding pipeline",
			"page_id", page.PageID,
			"url", page.URL,
		)
		return nil
	}

	// Clear old chunks for this page (idempotent re-embedding).
	_, err := db.ExecContext(ctx, "DELETE FROM content_chunks WHERE page_id = $1", page.PageID)
	if err != nil {
		return fmt.Errorf("embeddings: delete old chunks: %w", err)
	}

	// Chunk the page text.
	chunks := DefaultChunk(page.BodyText)
	if len(chunks) == 0 {
		return nil
	}

	// Extract chunk texts for embedding.
	chunkTexts := make([]string, len(chunks))
	for i, ch := range chunks {
		chunkTexts[i] = ch.Text
	}

	// Generate embeddings.
	vectors, err := client.Embed(ctx, chunkTexts)
	if err != nil {
		return fmt.Errorf("embeddings: generate vectors: %w", err)
	}

	// Build metadata JSON.
	meta, err := json.Marshal(map[string]string{
		"page_type": page.PageType,
		"url":       page.URL,
	})
	if err != nil {
		return fmt.Errorf("embeddings: marshal metadata: %w", err)
	}

	// Insert each chunk with its embedding.
	const insertSQL = `
		INSERT INTO content_chunks (id, page_id, client_id, chunk_index, chunk_text, token_count, embedding, embedding_model, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9)`

	for i, chunk := range chunks {
		chunkID := uuid.New()
		vectorStr := FormatVector(vectors[i])

		_, err := db.ExecContext(ctx, insertSQL,
			chunkID,
			page.PageID,
			page.ClientID,
			chunk.Index,
			chunk.Text,
			chunk.TokenCount,
			vectorStr,
			"bge-base-en-v1.5",
			meta,
		)
		if err != nil {
			return fmt.Errorf("embeddings: insert chunk %d: %w", i, err)
		}
	}

	slog.Info("embeddings: pipeline complete",
		"page_id", page.PageID,
		"url", page.URL,
		"chunks", len(chunks),
	)

	return nil
}
