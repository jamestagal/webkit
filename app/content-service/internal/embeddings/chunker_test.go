package embeddings

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// EstimateTokens
// ---------------------------------------------------------------------------

func TestEstimateTokens_Empty(t *testing.T) {
	assert.Equal(t, 0, EstimateTokens(""))
}

func TestEstimateTokens_Short(t *testing.T) {
	// "hello" = 5 chars → 5/4 = 1
	assert.Equal(t, 1, EstimateTokens("hello"))
}

func TestEstimateTokens_Medium(t *testing.T) {
	text := strings.Repeat("a", 400)
	assert.Equal(t, 100, EstimateTokens(text))
}

func TestEstimateTokens_ExactDivision(t *testing.T) {
	text := strings.Repeat("a", 100)
	assert.Equal(t, 25, EstimateTokens(text))
}

// ---------------------------------------------------------------------------
// ChunkText — basic cases
// ---------------------------------------------------------------------------

func TestChunkText_EmptyInput(t *testing.T) {
	result := ChunkText("", 500, 400, 600, 0.15)
	assert.Nil(t, result)
}

func TestChunkText_WhitespaceOnly(t *testing.T) {
	result := ChunkText("   ", 500, 400, 600, 0.15)
	assert.Nil(t, result)
}

func TestChunkText_ShortText_SingleChunk(t *testing.T) {
	// 10 repetitions of a 25-char sentence = ~250 chars = ~62 tokens.
	// minTokens=400 so this should be a single chunk.
	text := strings.Repeat("This is a test sentence. ", 10)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.Len(t, chunks, 1)
	assert.Equal(t, 0, chunks[0].Index)
	assert.Equal(t, text, chunks[0].Text)
	assert.Equal(t, EstimateTokens(text), chunks[0].TokenCount)
}

func TestChunkText_LongText_MultipleChunks(t *testing.T) {
	// Each sentence ~25 chars = ~6 tokens. targetTokens=500 → ~83 sentences per chunk.
	// 250 sentences → ~1500 tokens → expect 2-4 chunks.
	text := strings.Repeat("This is a test sentence. ", 250)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 2, "expected at least 2 chunks, got %d", len(chunks))
	require.True(t, len(chunks) <= 6, "expected at most 6 chunks, got %d", len(chunks))
}

func TestChunkText_ChunkIndexesSequential(t *testing.T) {
	text := strings.Repeat("This is a test sentence. ", 250)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 2, "need multiple chunks for this test")

	for i, c := range chunks {
		assert.Equal(t, i, c.Index, "chunk index should be sequential")
	}
}

func TestChunkText_TokenCountsAccurate(t *testing.T) {
	text := strings.Repeat("This is a test sentence. ", 250)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 2)

	for _, c := range chunks {
		assert.Equal(t, EstimateTokens(c.Text), c.TokenCount,
			"TokenCount should match EstimateTokens(Text) for chunk %d", c.Index)
	}
}

func TestChunkText_SentenceBoundaries(t *testing.T) {
	// Build text with distinct sentences so we can verify chunks don't
	// break mid-sentence.
	text := strings.Repeat("Alpha bravo charlie delta. ", 200)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 2)

	for _, c := range chunks {
		trimmed := strings.TrimSpace(c.Text)
		// Each chunk should end with a period (complete sentence) or be the
		// last chunk which might not end with one.
		if c.Index < len(chunks)-1 {
			assert.True(t,
				strings.HasSuffix(trimmed, ".") ||
					strings.HasSuffix(trimmed, "!") ||
					strings.HasSuffix(trimmed, "?"),
				"non-final chunk %d should end at sentence boundary, got: ...%q",
				c.Index, trimmed[max(0, len(trimmed)-30):])
		}
	}
}

func TestChunkText_ParagraphBoundaries(t *testing.T) {
	// Two paragraphs separated by double-newline.
	para1 := strings.Repeat("First paragraph sentence. ", 100)
	para2 := strings.Repeat("Second paragraph sentence. ", 100)
	text := para1 + "\n\n" + para2

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 2, "expected multiple chunks from two paragraphs")

	// All text should be represented in chunks (no data lost).
	combined := ""
	for _, c := range chunks {
		combined += c.Text + " "
	}
	// Both paragraph keywords should appear.
	assert.Contains(t, combined, "First paragraph")
	assert.Contains(t, combined, "Second paragraph")
}

func TestChunkText_NoOverlap(t *testing.T) {
	// Use distinct numbered sentences so we can detect duplicates.
	var sb strings.Builder
	for i := 0; i < 200; i++ {
		sb.WriteString("Sentence number ")
		sb.WriteString(strings.Repeat("x", 20)) // pad to ~10 tokens each
		sb.WriteString(". ")
	}
	text := strings.TrimSpace(sb.String())

	// overlapPct=0 → no overlap.
	chunks := ChunkText(text, 500, 400, 600, 0.0)
	require.True(t, len(chunks) >= 2)

	// Concatenate all chunk texts and verify approximate coverage.
	totalTokens := 0
	for _, c := range chunks {
		totalTokens += c.TokenCount
	}
	originalTokens := EstimateTokens(text)
	// With zero overlap, total tokens should be close to original
	// (allowing for sentence joining with spaces).
	ratio := float64(totalTokens) / float64(originalTokens)
	assert.InDelta(t, 1.0, ratio, 0.15,
		"with zero overlap, total chunk tokens should be close to original")
}

func TestChunkText_WithOverlap(t *testing.T) {
	text := strings.Repeat("This is a test sentence. ", 250)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 2)

	// With 15% overlap, total tokens across chunks should exceed the
	// original text's token count.
	totalTokens := 0
	for _, c := range chunks {
		totalTokens += c.TokenCount
	}
	originalTokens := EstimateTokens(text)
	assert.Greater(t, totalTokens, originalTokens,
		"with overlap, total chunk tokens should exceed original")

	// Verify that consecutive chunks share some text.
	foundOverlap := false
	for i := 0; i < len(chunks)-1; i++ {
		// Extract the last few words of chunk i.
		wordsA := strings.Fields(chunks[i].Text)
		if len(wordsA) < 5 {
			continue
		}
		tail := strings.Join(wordsA[len(wordsA)-5:], " ")
		if strings.Contains(chunks[i+1].Text, tail) {
			foundOverlap = true
			break
		}
	}
	assert.True(t, foundOverlap, "expected some text overlap between consecutive chunks")
}

// ---------------------------------------------------------------------------
// DefaultChunk
// ---------------------------------------------------------------------------

func TestDefaultChunk_ShortText(t *testing.T) {
	text := "Hello world, this is short."
	chunks := DefaultChunk(text)
	require.Len(t, chunks, 1)
	assert.Equal(t, text, chunks[0].Text)
	assert.Equal(t, 0, chunks[0].Index)
}

func TestDefaultChunk_LongText(t *testing.T) {
	// ~250 sentences * 25 chars = 6250 chars = ~1562 tokens. With target=500
	// and overlap, expect 3-5 chunks.
	text := strings.Repeat("This is a test sentence. ", 250)
	text = strings.TrimSpace(text)

	chunks := DefaultChunk(text)
	require.True(t, len(chunks) >= 2, "expected multiple chunks")

	for _, c := range chunks {
		// Allow some tolerance: chunks should be roughly within the
		// 400-600 token window (hard split enforces max, but min is soft).
		assert.LessOrEqual(t, c.TokenCount, 600+10,
			"chunk %d exceeds max tokens: %d", c.Index, c.TokenCount)
	}
}

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

func TestChunkText_SingleLongSentence(t *testing.T) {
	// One sentence with no periods → exceeds maxTokens → hard split.
	// 3000 chars = 750 tokens with maxTokens=600 → should be truncated.
	text := strings.Repeat("word ", 600) // 3000 chars
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 1)

	// First chunk should be at or under maxTokens.
	assert.LessOrEqual(t, chunks[0].TokenCount, 600,
		"chunk should be hard-split to max tokens")
}

func TestChunkText_OneSentence(t *testing.T) {
	// Single sentence within minTokens → single chunk.
	text := "This is a single sentence."
	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.Len(t, chunks, 1)
	assert.Equal(t, text, chunks[0].Text)
	assert.Equal(t, 0, chunks[0].Index)
}

func TestChunkText_ManySentences(t *testing.T) {
	// 500 short sentences → proper batching into chunks.
	text := strings.Repeat("Go. ", 500)
	text = strings.TrimSpace(text)

	chunks := ChunkText(text, 500, 400, 600, 0.15)
	require.True(t, len(chunks) >= 1)

	// Verify all chunks have valid structure.
	for i, c := range chunks {
		assert.Equal(t, i, c.Index)
		assert.True(t, len(c.Text) > 0, "chunk %d should have non-empty text", i)
		assert.True(t, c.TokenCount > 0, "chunk %d should have positive token count", i)
	}
}
