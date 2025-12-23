package payment

import (
	"context"
	"fmt"
	proto "gofast/gen/proto/v1"
	"gofast/service-core/domain/payment"
	"io"
	"log/slog"
	"net/http"

	"connectrpc.com/connect"
)

type Server struct {
	deps payment.Deps
}

func NewPaymentServer(deps payment.Deps) *Server {
	return &Server{deps: deps}
}

// CreateCheckoutSession creates a Stripe checkout session for subscription payments.
func (s *Server) CreateCheckoutSession(
	ctx context.Context,
	req *connect.Request[proto.CreateCheckoutSessionRequest],
) (*connect.Response[proto.CreateCheckoutSessionResponse], error) {
	url, err := payment.CreatePaymentCheckout(ctx, &s.deps, req.Msg.GetPlan(), req.Msg.GetSuccessUrl(), req.Msg.GetCancelUrl())
	if err != nil {
		return nil, fmt.Errorf("error creating checkout session: %w", err)
	}
	return connect.NewResponse(&proto.CreateCheckoutSessionResponse{
		Url: url.URL,
	}), nil
}

func (s *Server) CreatePortalSession(
	ctx context.Context,
	req *connect.Request[proto.CreatePortalSessionRequest],
) (*connect.Response[proto.CreatePortalSessionResponse], error) {
	url, err := payment.CreatePaymentPortal(ctx, &s.deps, req.Msg.GetReturnUrl())
	if err != nil {
		return nil, fmt.Errorf("error creating portal session: %w", err)
	}
	return connect.NewResponse(&proto.CreatePortalSessionResponse{
		Url: url.URL,
	}), nil
}

func (s *Server) Webhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	const MaxBodyBytes = int64(65536)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		slog.ErrorContext(ctx, "Error reading request body", "error", err)
		http.Error(w, "Error reading request body", http.StatusServiceUnavailable)
		return
	}
	signature := r.Header.Get("Stripe-Signature")
	err = payment.Webhook(ctx, &s.deps, signature, payload)
	if err != nil {
		slog.ErrorContext(ctx, "Error processing webhook", "error", err)
		http.Error(w, "Webhook error: "+err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}
