package otel_test

import (
	"context"
	"errors"
	"testing"

	"app/pkg/otel"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupOTelSDK_NoEndpoint(t *testing.T) {
	t.Parallel()
	shutdown, err := otel.SetupOTelSDK(context.Background(), "", "test-service")
	require.NoError(t, err)
	assert.NotNil(t, shutdown)
	assert.NoError(t, shutdown(context.Background()))
}

func TestStartSpan_Success(t *testing.T) {
	t.Parallel()
	ctx, span, done := otel.StartSpan(context.Background(), "test.op")
	assert.NotNil(t, ctx)
	assert.NotNil(t, span)
	done(nil)
}

func TestStartSpan_Error(t *testing.T) {
	t.Parallel()
	_, _, done := otel.StartSpan(context.Background(), "test.op")
	done(errors.New("something failed"))
}

func TestMetricsHelpers_DoNotPanic(t *testing.T) {
	t.Parallel()

	otel.AuthRefresh(context.Background(), "success", "refreshed")
	otel.AuthorizeDenied(context.Background(), "get_skeletons", "forbidden")

	doneDB := otel.StartDBQuery(context.Background(), "select_skeleton_by_id")
	doneDB(nil)

	doneExternal := otel.StartExternalCall(context.Background(), "postmark", "send_email")
	doneExternal(errors.New("boom"))
}

func TestParseOTLPEndpoint(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "http_url_strips_scheme",
			in:   "http://otel-collector:4317",
			want: "otel-collector:4317",
		},
		{
			name: "https_url_strips_scheme",
			in:   "https://collector.prod:4317",
			want: "collector.prod:4317",
		},
		{
			name: "host_port_unchanged",
			in:   "otel-collector:4317",
			want: "otel-collector:4317",
		},
		{
			name: "empty_unchanged",
			in:   "",
			want: "",
		},
		{
			name: "malformed_url_falls_through",
			in:   "http://[::",
			want: "http://[::",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := otel.ParseOTLPEndpointForTest(tc.in)
			assert.Equal(t, tc.want, got)
		})
	}
}
