package embeddings

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// ChunkResult represents a single chunk returned from similarity search.
type ChunkResult struct {
	ID         uuid.UUID
	PageID     uuid.UUID
	ChunkIndex int
	ChunkText  string
	TokenCount int
	Distance   float64
	Metadata   json.RawMessage
}

// SearchSimilar finds the most similar chunks to the given query embedding
// for a specific client, ordered by cosine distance (ascending).
func SearchSimilar(ctx context.Context, db *sql.DB, clientID uuid.UUID, queryEmbedding []float32, limit int) ([]ChunkResult, error) {
	if limit <= 0 {
		limit = 10
	}

	query := `
		SELECT id, page_id, chunk_index, chunk_text, token_count, metadata,
		       embedding <=> $1::vector AS distance
		FROM content_chunks
		WHERE client_id = $2
		ORDER BY distance
		LIMIT $3`

	vectorStr := FormatVector(queryEmbedding)

	rows, err := db.QueryContext(ctx, query, vectorStr, clientID, limit)
	if err != nil {
		return nil, fmt.Errorf("embeddings: search query: %w", err)
	}
	defer rows.Close()

	var results []ChunkResult
	for rows.Next() {
		var r ChunkResult
		if err := rows.Scan(&r.ID, &r.PageID, &r.ChunkIndex, &r.ChunkText, &r.TokenCount, &r.Metadata, &r.Distance); err != nil {
			return nil, fmt.Errorf("embeddings: scan row: %w", err)
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("embeddings: iterate rows: %w", err)
	}

	return results, nil
}

// FormatVector converts a float32 slice to pgvector string format: "[0.1,0.2,0.3,...]".
func FormatVector(v []float32) string {
	if len(v) == 0 {
		return "[]"
	}

	var b strings.Builder
	b.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, "%g", f)
	}
	b.WriteByte(']')
	return b.String()
}
