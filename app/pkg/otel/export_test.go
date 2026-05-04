package otel

// ParseOTLPEndpointForTest exposes the unexported parseOTLPEndpoint helper to
// the external otel_test package. It exists only in test builds.
var ParseOTLPEndpointForTest = parseOTLPEndpoint
