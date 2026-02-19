package embeddings

import (
	"strings"
)

// Chunk represents a segment of text with its position and token count.
type Chunk struct {
	Index      int
	Text       string
	TokenCount int
}

// EstimateTokens provides a rough token count (~4 chars per token).
func EstimateTokens(text string) int {
	if len(text) == 0 {
		return 0
	}
	return len(text) / 4
}

// DefaultChunk uses standard params: target=500, min=400, max=600, overlap=0.15.
func DefaultChunk(text string) []Chunk {
	return ChunkText(text, 500, 400, 600, 0.15)
}

// ChunkText splits text into chunks of approximately targetTokens size
// with overlapPct overlap between consecutive chunks.
func ChunkText(text string, targetTokens, minTokens, maxTokens int, overlapPct float64) []Chunk {
	text = strings.TrimSpace(text)
	if len(text) == 0 {
		return nil
	}

	// If text is shorter than minTokens, return single chunk.
	if EstimateTokens(text) <= minTokens {
		return []Chunk{{
			Index:      0,
			Text:       text,
			TokenCount: EstimateTokens(text),
		}}
	}

	sentences := splitSentences(text)
	if len(sentences) == 0 {
		return nil
	}

	overlapTokens := int(float64(targetTokens) * overlapPct)
	var chunks []Chunk
	chunkIdx := 0

	i := 0
	for i < len(sentences) {
		// Accumulate sentences until we reach targetTokens.
		var chunkSentences []string
		tokenCount := 0

		for i < len(sentences) {
			sentTokens := EstimateTokens(sentences[i])
			if tokenCount+sentTokens > targetTokens && len(chunkSentences) > 0 {
				break
			}
			chunkSentences = append(chunkSentences, sentences[i])
			tokenCount += sentTokens
			i++
		}

		chunkText := strings.Join(chunkSentences, " ")

		// Hard split if chunk exceeds maxTokens.
		if EstimateTokens(chunkText) > maxTokens {
			chunkText = hardSplitAtWordBoundary(chunkText, maxTokens)
		}

		chunkText = strings.TrimSpace(chunkText)
		if len(chunkText) > 0 {
			chunks = append(chunks, Chunk{
				Index:      chunkIdx,
				Text:       chunkText,
				TokenCount: EstimateTokens(chunkText),
			})
			chunkIdx++
		}

		// If there are more sentences, rewind for overlap.
		if i < len(sentences) {
			overlapSentCount := 0
			overlapToks := 0
			for j := i - 1; j >= 0 && overlapToks < overlapTokens; j-- {
				overlapToks += EstimateTokens(sentences[j])
				overlapSentCount++
			}
			if overlapSentCount > 0 && i-overlapSentCount > (i-len(chunkSentences)) {
				i = i - overlapSentCount
			}
		}
	}

	return chunks
}

// splitSentences splits text on sentence boundaries.
func splitSentences(text string) []string {
	// First split on paragraph breaks.
	paragraphs := strings.Split(text, "\n\n")
	var sentences []string

	for _, para := range paragraphs {
		para = strings.TrimSpace(para)
		if len(para) == 0 {
			continue
		}
		// Split on sentence-ending punctuation followed by a space.
		sents := splitOnSentenceEnds(para)
		sentences = append(sentences, sents...)
	}

	return sentences
}

// splitOnSentenceEnds splits a paragraph into sentences on ". ", "! ", "? " boundaries.
func splitOnSentenceEnds(text string) []string {
	var sentences []string
	start := 0

	for i := 0; i < len(text)-1; i++ {
		if (text[i] == '.' || text[i] == '!' || text[i] == '?') && text[i+1] == ' ' {
			sent := strings.TrimSpace(text[start : i+1])
			if len(sent) > 0 {
				sentences = append(sentences, sent)
			}
			start = i + 2
		}
	}

	// Remaining text.
	if start < len(text) {
		sent := strings.TrimSpace(text[start:])
		if len(sent) > 0 {
			sentences = append(sentences, sent)
		}
	}

	return sentences
}

// hardSplitAtWordBoundary truncates text to approximately maxTokens at a word boundary.
func hardSplitAtWordBoundary(text string, maxTokens int) string {
	maxChars := maxTokens * 4
	if len(text) <= maxChars {
		return text
	}

	// Find the last space before the limit.
	idx := maxChars
	for idx > 0 && text[idx] != ' ' {
		idx--
	}
	if idx == 0 {
		// No space found; hard cut.
		return text[:maxChars]
	}
	return text[:idx]
}
