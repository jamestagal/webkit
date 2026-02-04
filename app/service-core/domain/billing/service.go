package billing

import (
	"app/pkg"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"service-core/config"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v82"
	portal_session "github.com/stripe/stripe-go/v82/billingportal/session"
	checkout_session "github.com/stripe/stripe-go/v82/checkout/session"
	"github.com/stripe/stripe-go/v82/customer"
	"github.com/stripe/stripe-go/v82/subscription"
	"github.com/stripe/stripe-go/v82/webhook"
)

// store defines the database interface for billing operations
type store interface {
	GetAgencyBillingInfo(ctx context.Context, id uuid.UUID) (query.GetAgencyBillingInfoRow, error)
	UpdateAgencyStripeCustomer(ctx context.Context, arg query.UpdateAgencyStripeCustomerParams) error
	UpdateAgencySubscription(ctx context.Context, arg query.UpdateAgencySubscriptionParams) error
	GetAgencyByStripeCustomer(ctx context.Context, stripeCustomerID string) (query.Agency, error)
	DowngradeAgencyToFree(ctx context.Context, id uuid.UUID) error
}

// Service handles agency billing operations
type Service struct {
	cfg   *config.Config
	store store
}

// NewService creates a new billing service
func NewService(cfg *config.Config, store store) *Service {
	return &Service{
		cfg:   cfg,
		store: store,
	}
}

// URLResponse represents a response containing a URL
type URLResponse struct {
	URL string `json:"url"`
}

// BillingInfo represents the billing information for an agency
type BillingInfo struct {
	AgencyID         uuid.UUID  `json:"agencyId"`
	Name             string     `json:"name"`
	Tier             string     `json:"tier"`
	SubscriptionID   string     `json:"subscriptionId"`
	SubscriptionEnd  *time.Time `json:"subscriptionEnd"`
	StripeCustomerID string     `json:"stripeCustomerId"`
	IsFreemium       bool       `json:"isFreemium"`
	FreemiumExpires  *time.Time `json:"freemiumExpiresAt"`
}

// getPriceID maps tier + interval to Stripe price ID
func (s *Service) getPriceID(tier, interval string) (string, error) {
	prices := map[string]map[string]string{
		"starter": {
			"month": s.cfg.StripePriceStarterMonthly,
			"year":  s.cfg.StripePriceStarterYearly,
		},
		"growth": {
			"month": s.cfg.StripePriceGrowthMonthly,
			"year":  s.cfg.StripePriceGrowthYearly,
		},
		"enterprise": {
			"month": s.cfg.StripePriceEnterpriseMonthly,
			"year":  s.cfg.StripePriceEnterpriseYearly,
		},
	}

	if tierPrices, ok := prices[tier]; ok {
		if priceID, ok := tierPrices[interval]; ok && priceID != "" {
			return priceID, nil
		}
	}
	return "", fmt.Errorf("invalid tier/interval: %s/%s", tier, interval)
}

// tierFromPriceID reverse maps price ID to tier name
func (s *Service) tierFromPriceID(priceID string) string {
	priceToTier := map[string]string{
		s.cfg.StripePriceStarterMonthly:    "starter",
		s.cfg.StripePriceStarterYearly:     "starter",
		s.cfg.StripePriceGrowthMonthly:     "growth",
		s.cfg.StripePriceGrowthYearly:      "growth",
		s.cfg.StripePriceEnterpriseMonthly: "enterprise",
		s.cfg.StripePriceEnterpriseYearly:  "enterprise",
	}
	if tier, ok := priceToTier[priceID]; ok {
		return tier
	}
	return "free"
}

// GetBillingInfo returns the billing information for an agency.
// If sessionId is provided, it will check Stripe and auto-sync if the DB is behind.
// This makes the endpoint idempotent - always returns the truth regardless of webhook timing.
func (s *Service) GetBillingInfo(ctx context.Context, agencyID uuid.UUID, sessionID string) (*BillingInfo, error) {
	// If sessionId provided, check Stripe and sync if DB is behind
	if sessionID != "" {
		if err := s.syncIfNeeded(ctx, agencyID, sessionID); err != nil {
			// Log but don't fail - continue with DB data
			slog.Warn("Failed to sync from session", "error", err, "session_id", sessionID)
		}
	}

	info, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error getting agency billing info", Err: err}
	}

	result := &BillingInfo{
		AgencyID:         info.ID,
		Name:             info.Name,
		Tier:             info.SubscriptionTier,
		SubscriptionID:   info.SubscriptionID,
		StripeCustomerID: info.StripeCustomerID,
		IsFreemium:       info.IsFreemium,
	}

	if info.SubscriptionEnd.Valid {
		result.SubscriptionEnd = &info.SubscriptionEnd.Time
	}
	if info.FreemiumExpiresAt.Valid {
		result.FreemiumExpires = &info.FreemiumExpiresAt.Time
	}

	return result, nil
}

// syncIfNeeded checks if the session is complete and syncs to DB if needed
func (s *Service) syncIfNeeded(ctx context.Context, agencyID uuid.UUID, sessionID string) error {
	stripe.Key = s.cfg.StripeAPIKey

	// Get current DB state
	info, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
	if err != nil {
		return err
	}

	// If already has a subscription, no need to sync
	if info.SubscriptionID != "" {
		return nil
	}

	// Check Stripe session
	params := &stripe.CheckoutSessionParams{
		Params: stripe.Params{Context: ctx},
	}
	params.AddExpand("subscription")
	params.AddExpand("subscription.items.data.price")

	sess, err := checkout_session.Get(sessionID, params)
	if err != nil {
		return err
	}

	// Only sync if session is complete with a subscription
	if sess.Status != stripe.CheckoutSessionStatusComplete || sess.Subscription == nil {
		return nil
	}

	// Verify this session belongs to this agency
	if agencyIDStr, ok := sess.Metadata["agency_id"]; !ok || agencyIDStr != agencyID.String() {
		return nil
	}

	// Sync the subscription
	return s.SyncSubscriptionFromSession(ctx, sessionID)
}

// CheckoutSessionStatus represents the status of a checkout session
type CheckoutSessionStatus struct {
	Status           string `json:"status"`           // "complete", "expired", "open"
	PaymentStatus    string `json:"paymentStatus"`    // "paid", "unpaid", "no_payment_required"
	SubscriptionID   string `json:"subscriptionId"`
	Tier             string `json:"tier"`
	CustomerID       string `json:"customerId"`
	SubscriptionEnd  *int64 `json:"subscriptionEnd,omitempty"`
}

// GetCheckoutSessionStatus retrieves the status of a checkout session directly from Stripe
func (s *Service) GetCheckoutSessionStatus(ctx context.Context, sessionID string) (*CheckoutSessionStatus, error) {
	stripe.Key = s.cfg.StripeAPIKey

	// Get the checkout session with expanded subscription
	params := &stripe.CheckoutSessionParams{
		Params: stripe.Params{Context: ctx},
	}
	params.AddExpand("subscription")
	params.AddExpand("subscription.items.data.price")

	sess, err := checkout_session.Get(sessionID, params)
	if err != nil {
		return nil, pkg.BadRequestError{Message: "Invalid or expired checkout session"}
	}

	result := &CheckoutSessionStatus{
		Status:        string(sess.Status),
		PaymentStatus: string(sess.PaymentStatus),
	}

	if sess.Customer != nil {
		result.CustomerID = sess.Customer.ID
	}

	// If session has a subscription, get the tier info
	if sess.Subscription != nil {
		result.SubscriptionID = sess.Subscription.ID

		if len(sess.Subscription.Items.Data) > 0 {
			priceID := sess.Subscription.Items.Data[0].Price.ID
			result.Tier = s.tierFromPriceID(priceID)
		}

		// Get subscription end date from raw JSON (SDK version compatibility)
		subJSON, _ := json.Marshal(sess.Subscription)
		var rawSub map[string]interface{}
		_ = json.Unmarshal(subJSON, &rawSub)
		if periodEnd, ok := rawSub["current_period_end"].(float64); ok && periodEnd > 0 {
			endTime := int64(periodEnd)
			result.SubscriptionEnd = &endTime
		}
	}

	return result, nil
}

// getOrCreateCustomer ensures agency has a Stripe customer ID
func (s *Service) getOrCreateCustomer(ctx context.Context, agencyID uuid.UUID, email, name string) (string, error) {
	stripe.Key = s.cfg.StripeAPIKey

	info, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
	if err != nil {
		return "", pkg.InternalError{Message: "Error getting agency billing info", Err: err}
	}

	// Return existing customer if present
	if info.StripeCustomerID != "" {
		return info.StripeCustomerID, nil
	}

	// Create new Stripe customer
	params := &stripe.CustomerParams{
		Params: stripe.Params{Context: ctx},
		Email:  stripe.String(email),
		Name:   stripe.String(name),
		Metadata: map[string]string{
			"agency_id": agencyID.String(),
		},
	}

	cust, err := customer.New(params)
	if err != nil {
		return "", pkg.InternalError{Message: "Error creating Stripe customer", Err: err}
	}

	// Store customer ID on agency
	err = s.store.UpdateAgencyStripeCustomer(ctx, query.UpdateAgencyStripeCustomerParams{
		ID:               agencyID,
		StripeCustomerID: cust.ID,
	})
	if err != nil {
		return "", pkg.InternalError{Message: "Error updating agency Stripe customer", Err: err}
	}

	return cust.ID, nil
}

// CreateCheckoutSession creates a Stripe Checkout session for subscription
func (s *Service) CreateCheckoutSession(
	ctx context.Context,
	agencyID uuid.UUID,
	agencySlug string,
	email string,
	agencyName string,
	tier string,
	interval string,
) (*URLResponse, error) {
	stripe.Key = s.cfg.StripeAPIKey

	priceID, err := s.getPriceID(tier, interval)
	if err != nil {
		return nil, pkg.BadRequestError{Message: err.Error()}
	}

	customerID, err := s.getOrCreateCustomer(ctx, agencyID, email, agencyName)
	if err != nil {
		return nil, err
	}

	params := &stripe.CheckoutSessionParams{
		Params:   stripe.Params{Context: ctx},
		Customer: stripe.String(customerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(fmt.Sprintf("%s/%s/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}", s.cfg.ClientURL, agencySlug)),
		CancelURL:  stripe.String(fmt.Sprintf("%s/%s/settings/billing?canceled=true", s.cfg.ClientURL, agencySlug)),
		Metadata: map[string]string{
			"agency_id": agencyID.String(),
			"tier":      tier,
		},
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Metadata: map[string]string{
				"agency_id": agencyID.String(),
				"tier":      tier,
			},
		},
		AllowPromotionCodes: stripe.Bool(true),
	}

	sess, err := checkout_session.New(params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating checkout session", Err: err}
	}

	return &URLResponse{URL: sess.URL}, nil
}

// CreatePortalSession creates a Stripe Billing Portal session
func (s *Service) CreatePortalSession(ctx context.Context, agencyID uuid.UUID, agencySlug string) (*URLResponse, error) {
	stripe.Key = s.cfg.StripeAPIKey

	info, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error getting agency billing info", Err: err}
	}

	if info.StripeCustomerID == "" {
		return nil, pkg.BadRequestError{Message: "Agency has no Stripe customer. Subscribe to a plan first."}
	}

	params := &stripe.BillingPortalSessionParams{
		Params:    stripe.Params{Context: ctx},
		Customer:  stripe.String(info.StripeCustomerID),
		ReturnURL: stripe.String(fmt.Sprintf("%s/%s/settings/billing", s.cfg.ClientURL, agencySlug)),
	}

	sess, err := portal_session.New(params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating portal session", Err: err}
	}

	return &URLResponse{URL: sess.URL}, nil
}

// UpgradeSubscription upgrades an existing subscription with proration
func (s *Service) UpgradeSubscription(
	ctx context.Context,
	agencyID uuid.UUID,
	tier string,
	interval string,
) error {
	stripe.Key = s.cfg.StripeAPIKey

	// Get agency billing info - must have existing subscription
	info, err := s.store.GetAgencyBillingInfo(ctx, agencyID)
	if err != nil {
		return pkg.InternalError{Message: "Error getting agency billing info", Err: err}
	}

	if info.SubscriptionID == "" {
		return pkg.BadRequestError{Message: "No active subscription to upgrade. Please subscribe first."}
	}

	// Get new price ID for target tier
	priceID, err := s.getPriceID(tier, interval)
	if err != nil {
		return pkg.BadRequestError{Message: err.Error()}
	}

	// Get current subscription from Stripe
	currentSub, err := subscription.Get(info.SubscriptionID, nil)
	if err != nil {
		return pkg.InternalError{Message: "Error getting current subscription", Err: err}
	}

	if len(currentSub.Items.Data) == 0 {
		return pkg.InternalError{Message: "Subscription has no items", Err: nil}
	}

	// Check if already on target plan
	currentPriceID := currentSub.Items.Data[0].Price.ID
	if currentPriceID == priceID {
		return pkg.BadRequestError{Message: "You are already on this plan"}
	}

	// Update subscription with proration
	params := &stripe.SubscriptionParams{
		Params: stripe.Params{Context: ctx},
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:    stripe.String(currentSub.Items.Data[0].ID),
				Price: stripe.String(priceID),
			},
		},
		// create_prorations: Charges immediately for upgrades, credits for downgrades
		ProrationBehavior: stripe.String("create_prorations"),
	}

	_, err = subscription.Update(info.SubscriptionID, params)
	if err != nil {
		return pkg.InternalError{Message: "Error updating subscription", Err: err}
	}

	slog.Info("Subscription upgrade initiated",
		"agency_id", agencyID,
		"new_tier", tier,
		"subscription_id", info.SubscriptionID)

	// Note: Database will be updated via customer.subscription.updated webhook
	return nil
}

// SyncSubscriptionFromSession syncs the subscription from a completed checkout session
// This is called after the client polls and confirms the session is complete,
// ensuring the database is updated even if webhooks are delayed
func (s *Service) SyncSubscriptionFromSession(ctx context.Context, sessionID string) error {
	stripe.Key = s.cfg.StripeAPIKey

	// Get the checkout session with expanded subscription
	params := &stripe.CheckoutSessionParams{
		Params: stripe.Params{Context: ctx},
	}
	params.AddExpand("subscription")
	params.AddExpand("subscription.items.data.price")

	sess, err := checkout_session.Get(sessionID, params)
	if err != nil {
		return pkg.BadRequestError{Message: "Invalid or expired checkout session"}
	}

	// Verify session is complete
	if sess.Status != stripe.CheckoutSessionStatusComplete {
		return pkg.BadRequestError{Message: "Checkout session is not complete"}
	}

	// Get agency ID from metadata
	agencyIDStr, ok := sess.Metadata["agency_id"]
	if !ok || agencyIDStr == "" {
		return pkg.BadRequestError{Message: "No agency_id in session metadata"}
	}

	agencyID, err := uuid.Parse(agencyIDStr)
	if err != nil {
		return pkg.BadRequestError{Message: "Invalid agency ID in metadata"}
	}

	// Ensure customer ID is saved to agency
	if sess.Customer != nil {
		err = s.store.UpdateAgencyStripeCustomer(ctx, query.UpdateAgencyStripeCustomerParams{
			ID:               agencyID,
			StripeCustomerID: sess.Customer.ID,
		})
		if err != nil {
			slog.Warn("Failed to update agency Stripe customer", "error", err)
			// Continue anyway - not fatal
		}
	}

	// Get subscription details
	if sess.Subscription == nil {
		return pkg.BadRequestError{Message: "No subscription in checkout session"}
	}

	if len(sess.Subscription.Items.Data) == 0 {
		return pkg.BadRequestError{Message: "Subscription has no items"}
	}

	tier := s.tierFromPriceID(sess.Subscription.Items.Data[0].Price.ID)

	// Get subscription end date from raw JSON (SDK version compatibility)
	subJSON, _ := json.Marshal(sess.Subscription)
	var rawSub map[string]interface{}
	_ = json.Unmarshal(subJSON, &rawSub)

	var endDate time.Time
	if periodEnd, ok := rawSub["current_period_end"].(float64); ok && periodEnd > 0 {
		endDate = time.Unix(int64(periodEnd), 0)
	} else {
		// Fallback: set end date to 30 days from now
		endDate = time.Now().AddDate(0, 1, 0)
	}

	err = s.store.UpdateAgencySubscription(ctx, query.UpdateAgencySubscriptionParams{
		ID:               agencyID,
		SubscriptionTier: tier,
		SubscriptionID:   sess.Subscription.ID,
		SubscriptionEnd:  sql.NullTime{Time: endDate, Valid: true},
	})
	if err != nil {
		return pkg.InternalError{Message: "Error updating agency subscription", Err: err}
	}

	slog.Info("Agency subscription synced from session",
		"agency_id", agencyID,
		"tier", tier,
		"subscription_id", sess.Subscription.ID,
		"ends", endDate)

	return nil
}

// HandleWebhook processes Stripe billing webhooks
func (s *Service) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
	stripe.Key = s.cfg.StripeAPIKey

	// Use separate webhook secret for billing webhooks
	webhookSecret := s.cfg.StripeBillingWebhookSecret
	if webhookSecret == "" {
		// Fall back to main webhook secret if billing-specific one not set
		webhookSecret = s.cfg.StripeWebhookSecret
	}

	event, err := webhook.ConstructEventWithOptions(payload, signature, webhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		return pkg.BadRequestError{Message: fmt.Sprintf("Webhook signature verification failed: %v", err)}
	}

	slog.Info("Billing webhook received", "type", event.Type)

	switch event.Type {
	case "checkout.session.completed":
		return s.handleCheckoutCompleted(ctx, event)
	case "customer.subscription.updated":
		return s.handleSubscriptionUpdated(ctx, event)
	case "customer.subscription.deleted":
		return s.handleSubscriptionDeleted(ctx, event)
	case "invoice.payment_failed":
		return s.handlePaymentFailed(ctx, event)
	default:
		// Log but don't error on unhandled events
		slog.Info("Unhandled billing webhook event", "type", event.Type)
		return nil
	}
}

func (s *Service) handleCheckoutCompleted(ctx context.Context, event stripe.Event) error {
	var sess stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
		return pkg.InternalError{Message: "Error parsing checkout session", Err: err}
	}

	agencyIDStr, ok := sess.Metadata["agency_id"]
	if !ok || agencyIDStr == "" {
		slog.Warn("Checkout completed without agency_id in metadata", "session_id", sess.ID)
		return nil
	}

	agencyID, err := uuid.Parse(agencyIDStr)
	if err != nil {
		return pkg.InternalError{Message: "Invalid agency ID in metadata", Err: err}
	}

	// Get subscription details
	if sess.Subscription == nil {
		return pkg.InternalError{Message: "No subscription in checkout session", Err: nil}
	}

	sub, err := subscription.Get(sess.Subscription.ID, nil)
	if err != nil {
		return pkg.InternalError{Message: "Error getting subscription", Err: err}
	}

	if len(sub.Items.Data) == 0 {
		return pkg.InternalError{Message: "Subscription has no items", Err: nil}
	}

	tier := s.tierFromPriceID(sub.Items.Data[0].Price.ID)

	// Marshal subscription to JSON to extract period end (handles SDK version differences)
	subJSON, _ := json.Marshal(sub)
	var rawSub map[string]interface{}
	_ = json.Unmarshal(subJSON, &rawSub)

	var endDate time.Time
	if periodEnd, ok := rawSub["current_period_end"].(float64); ok && periodEnd > 0 {
		endDate = time.Unix(int64(periodEnd), 0)
	} else {
		// Fallback: set end date to 30 days from now
		endDate = time.Now().AddDate(0, 1, 0)
	}

	err = s.store.UpdateAgencySubscription(ctx, query.UpdateAgencySubscriptionParams{
		ID:               agencyID,
		SubscriptionTier: tier,
		SubscriptionID:   sub.ID,
		SubscriptionEnd:  sql.NullTime{Time: endDate, Valid: true},
	})
	if err != nil {
		return pkg.InternalError{Message: "Error updating agency subscription", Err: err}
	}

	slog.Info("Agency subscription created",
		"agency_id", agencyID,
		"tier", tier,
		"subscription_id", sub.ID,
		"ends", endDate)

	return nil
}

func (s *Service) handleSubscriptionUpdated(ctx context.Context, event stripe.Event) error {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		return pkg.InternalError{Message: "Error parsing subscription", Err: err}
	}

	// Find agency by customer ID
	agency, err := s.store.GetAgencyByStripeCustomer(ctx, sub.Customer.ID)
	if err != nil {
		slog.Warn("Agency not found for Stripe customer", "customer_id", sub.Customer.ID)
		return nil // Don't error - might be a user subscription, not agency
	}

	// Handle cancellation at period end
	if sub.CancelAtPeriodEnd {
		slog.Info("Agency subscription scheduled for cancellation",
			"agency_id", agency.ID,
			"cancels_at", time.Unix(sub.CancelAt, 0))
		return nil
	}

	if len(sub.Items.Data) == 0 {
		return pkg.InternalError{Message: "Subscription has no items", Err: nil}
	}

	tier := s.tierFromPriceID(sub.Items.Data[0].Price.ID)

	// Parse period end from raw JSON since struct field access varies by SDK version
	var rawSub map[string]interface{}
	_ = json.Unmarshal(event.Data.Raw, &rawSub)
	var endDate time.Time
	if periodEnd, ok := rawSub["current_period_end"].(float64); ok && periodEnd > 0 {
		endDate = time.Unix(int64(periodEnd), 0)
	} else {
		// Fallback: set end date to 30 days from now
		endDate = time.Now().AddDate(0, 1, 0)
	}

	err = s.store.UpdateAgencySubscription(ctx, query.UpdateAgencySubscriptionParams{
		ID:               agency.ID,
		SubscriptionTier: tier,
		SubscriptionID:   sub.ID,
		SubscriptionEnd:  sql.NullTime{Time: endDate, Valid: true},
	})
	if err != nil {
		return pkg.InternalError{Message: "Error updating agency subscription", Err: err}
	}

	slog.Info("Agency subscription updated",
		"agency_id", agency.ID,
		"tier", tier,
		"subscription_id", sub.ID,
		"ends", endDate)

	return nil
}

func (s *Service) handleSubscriptionDeleted(ctx context.Context, event stripe.Event) error {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		return pkg.InternalError{Message: "Error parsing subscription", Err: err}
	}

	agency, err := s.store.GetAgencyByStripeCustomer(ctx, sub.Customer.ID)
	if err != nil {
		slog.Warn("Agency not found for Stripe customer", "customer_id", sub.Customer.ID)
		return nil // Don't error - might be a user subscription
	}

	err = s.store.DowngradeAgencyToFree(ctx, agency.ID)
	if err != nil {
		return pkg.InternalError{Message: "Error downgrading agency to free", Err: err}
	}

	slog.Info("Agency downgraded to free tier", "agency_id", agency.ID)
	return nil
}

func (s *Service) handlePaymentFailed(ctx context.Context, event stripe.Event) error {
	// TODO: Implement dunning - email agency about failed payment
	// For MVP, just log it
	var invoice stripe.Invoice
	if err := json.Unmarshal(event.Data.Raw, &invoice); err != nil {
		return pkg.InternalError{Message: "Error parsing invoice", Err: err}
	}

	slog.Warn("Agency payment failed",
		"customer_id", invoice.Customer.ID,
		"amount", invoice.AmountDue,
		"attempt_count", invoice.AttemptCount)

	return nil
}
