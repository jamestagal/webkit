package embeddings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	otel "app/pkg/otel"
)

const (
	// Model is the Cloudflare Workers AI embedding model.
	Model = "@cf/baai/bge-base-en-v1.5"
	// Dims is the embedding dimension count for bge-base-en-v1.5.
	Dims = 768
	// MaxBatch is the maximum number of texts per API call.
	MaxBatch = 100
	// MaxConcurrent is the maximum number of concurrent API calls.
	MaxConcurrent = 20
)

// Client communicates with the Cloudflare Workers AI REST API for text embeddings.
type Client struct {
	accountID  string
	apiToken   string
	httpClient *http.Client
	sem        chan struct{}
}

// NewClient returns a configured Workers AI embedding client, or nil if
// either credential is missing. Consumers must nil-check the return value
// before calling client methods. The nil-on-empty-creds contract prevents
// downstream code from constructing malformed Cloudflare API URLs (empty
// account ID produces /accounts//ai/run/... → 404).
func NewClient(accountID, apiToken string) *Client {
	if accountID == "" || apiToken == "" {
		return nil
	}
	return &Client{
		accountID:  accountID,
		apiToken:   apiToken,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		sem:        make(chan struct{}, MaxConcurrent),
	}
}

type embedRequest struct {
	Text []string `json:"text"`
}

type embedResponse struct {
	Result struct {
		Data [][]float32 `json:"data"`
	} `json:"result"`
	Success  bool     `json:"success"`
	Errors   []string `json:"errors"`
	Messages []string `json:"messages"`
}

// Embed generates embeddings for the given texts using Workers AI.
// Texts are automatically batched into groups of MaxBatch.
func (c *Client) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	var allVectors [][]float32

	// Split into batches of MaxBatch.
	for i := 0; i < len(texts); i += MaxBatch {
		end := i + MaxBatch
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[i:end]

		vectors, err := c.embedBatch(ctx, batch)
		if err != nil {
			return nil, fmt.Errorf("embeddings: batch %d-%d: %w", i, end, err)
		}
		allVectors = append(allVectors, vectors...)
	}

	if len(allVectors) != len(texts) {
		return nil, fmt.Errorf("embeddings: result count mismatch: got %d, want %d", len(allVectors), len(texts))
	}

	return allVectors, nil
}

// embedBatch sends a single batch of texts to the Workers AI API.
func (c *Client) embedBatch(ctx context.Context, texts []string) (vectors [][]float32, err error) {
	done := otel.StartExternalCall(ctx, "cf_workers_ai", "embed_text")
	defer func() { done(err) }()

	// Acquire semaphore slot.
	select {
	case c.sem <- struct{}{}:
	case <-ctx.Done():
		return nil, fmt.Errorf("embeddings: %w", ctx.Err())
	}
	defer func() { <-c.sem }()

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/ai/run/%s", c.accountID, Model)

	payload, err := json.Marshal(embedRequest{Text: texts})
	if err != nil {
		return nil, fmt.Errorf("embeddings: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("embeddings: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embeddings: execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("embeddings: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("embeddings: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var result embedResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("embeddings: unmarshal response: %w", err)
	}

	if !result.Success {
		return nil, fmt.Errorf("embeddings: API error: %v", result.Errors)
	}

	if len(result.Result.Data) != len(texts) {
		return nil, fmt.Errorf("embeddings: batch result count mismatch: got %d, want %d", len(result.Result.Data), len(texts))
	}

	return result.Result.Data, nil
}
