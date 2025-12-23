package payment

import (
	"context"
	"encoding/json"
	"errors"
	"gofast/pkg"
	"gofast/pkg/auth"
	ot "gofast/pkg/otel"
	"gofast/service-core/config"
	"gofast/service-core/storage/query"
	"log/slog"
	"time"

	"github.com/stripe/stripe-go/v84"
	portal_session "github.com/stripe/stripe-go/v84/billingportal/session"
	checkout_session "github.com/stripe/stripe-go/v84/checkout/session"
	"github.com/stripe/stripe-go/v84/customer"
	"github.com/stripe/stripe-go/v84/webhook"
	"go.opentelemetry.io/otel/trace"
)

type Deps struct {
	Cfg   *config.Config
	Store *query.Queries
}

type URLResponse struct {
	URL string `json:"url"`
}

func authorize(ctx context.Context, span trace.Span, requiredAccess int64) (*auth.AccessTokenClaims, error) {
	claims, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, pkg.UnauthorizedError{Message: "No claims found in context", Err: errors.New("no claims found in context")}
	}
	if !auth.HasAccess(requiredAccess, claims.Access) {
		return nil, pkg.ForbiddenError{Message: "Insufficient permissions", Err: errors.New("forbidden")}
	}
	span.AddEvent("Authorization successful")
	return claims, nil
}

func CreatePaymentCheckout(ctx context.Context, d *Deps, plan, successURL, cancelURL string) (url *URLResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "payment.service.CreatePaymentCheckout")
	defer func() { done(err) }()

	claims, err := authorize(ctx, span, auth.EditSkeleton)
	if err != nil {
		return nil, err
	}
	user, err := d.Store.SelectUserByID(ctx, claims.ID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting user by ID", Err: err}
	}

	if user.CustomerID == "" {
		customerID, err := createCustomer(ctx, d, user.Email)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error creating customer", Err: err}
		}
		params := query.UpdateUserCustomerIDParams{
			ID:         user.ID,
			CustomerID: customerID,
		}
		err = d.Store.UpdateUserCustomerID(ctx, params)
		user.CustomerID = customerID
		if err != nil {
			return nil, pkg.InternalError{Message: "Error updating customer ID", Err: err}
		}
	}

	var priceID string
	if plan == "pro" {
		priceID = d.Cfg.StripePriceIDPro
	} else {
		priceID = d.Cfg.StripePriceIDBasic
	}

	stripe.Key = d.Cfg.StripeAPIKey

	params := &stripe.CheckoutSessionParams{
		Params: stripe.Params{
			Context: ctx,
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		// For subscription
		Mode: stripe.String("subscription"),
		// For one-time payment
		// Mode: stripe.String("payment"),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		Customer: stripe.String(user.CustomerID),
		// For one-time payment
		// InvoiceCreation: &stripe.CheckoutSessionInvoiceCreationParams{
		//     Enabled: stripe.Bool(true),
		// },
		AllowPromotionCodes: stripe.Bool(true),
	}

	session, err := checkout_session.New(params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating payment checkout", Err: err}
	}
	return &URLResponse{URL: session.URL}, nil
}

func CreatePaymentPortal(ctx context.Context, d *Deps, returnURL string) (url *URLResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "payment.service.CreatePaymentPortal")
	defer func() { done(err) }()

	claims, err := authorize(ctx, span, auth.EditSkeleton)
	if err != nil {
		return nil, err
	}

	user, err := d.Store.SelectUserByID(ctx, claims.ID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting user by ID", Err: err}
	}
	span.AddEvent("User selected from store")

	stripe.Key = d.Cfg.StripeAPIKey
	params := &stripe.BillingPortalSessionParams{
		Params: stripe.Params{
			Context: ctx,
		},
		Customer:  stripe.String(user.CustomerID),
		ReturnURL: stripe.String(returnURL),
	}
	session, err := portal_session.New(params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating payment portal session", Err: err}
	}
	span.AddEvent("Portal session created")

	return &URLResponse{URL: session.URL}, nil
}

func Webhook(ctx context.Context, d *Deps, signature string, payload []byte) (err error) {
	ctx, span, done := ot.StartSpan(ctx, "payment.service.Webhook")
	defer func() { done(err) }()

	endpointSecret := d.Cfg.StripeWebhookSecret
	event, err := webhook.ConstructEvent(payload, signature, endpointSecret)
	if err != nil {
		return pkg.InternalError{Message: "Error verifying webhook signature", Err: err}
	}
	span.AddEvent("Webhook signature verified")

	switch event.Type {
	case stripe.EventTypeInvoicePaid:
		return handleInvoicePaid(ctx, d, event)
	default:
		slog.Info("Unhandled event type", "type", event.Type)
		return nil
	}
}

func handleInvoicePaid(ctx context.Context, d *Deps, event stripe.Event) (err error) {
	ctx, span, done := ot.StartSpan(ctx, "payment.service.handleInvoicePaid")
	defer func() { done(err) }()

	var invoice stripe.Invoice
	err = json.Unmarshal(event.Data.Raw, &invoice)
	if err != nil {
		return pkg.InternalError{Message: "Error parsing invoice JSON", Err: err}
	}
	if len(invoice.Lines.Data) == 0 {
		return pkg.InternalError{Message: "No invoice lines", Err: errors.New("no invoice lines")}
	}
	span.AddEvent("Invoice parsed")

	// Look for positive amount line item
	var line *stripe.InvoiceLineItem
	for _, l := range invoice.Lines.Data {
		if l.Amount > 0 {
			line = l
			break
		}
	}
	if line == nil {
		slog.Info("No positive amount line item found")
		span.AddEvent("No positive amount line item")
		return nil
	}

	customerID := invoice.Customer.ID
	subscriptionID := line.Parent.SubscriptionItemDetails.Subscription
	priceID := line.Pricing.PriceDetails.Price
	periodStart := time.Unix(line.Period.Start, 0)
	periodEnd := time.Unix(line.Period.End, 0).AddDate(0, 0, d.Cfg.SubscriptionSafePeriodDays)

	if subscriptionID == "" || priceID == "" {
		return pkg.InternalError{Message: "Subscription ID or price ID is empty", Err: errors.New("subscription ID or price ID is empty")}
	}

	// Find user by customer ID
	user, err := d.Store.SelectUserByCustomerID(ctx, customerID)
	if err != nil {
		return pkg.InternalError{Message: "Error selecting user by customer ID", Err: err}
	}
	span.AddEvent("User selected by customer ID")

	// Upsert subscription record
	_, err = d.Store.UpsertSubscription(ctx, query.UpsertSubscriptionParams{
		UserID:               user.ID,
		StripeCustomerID:     customerID,
		StripeSubscriptionID: subscriptionID,
		StripePriceID:        priceID,
		Status:               "active",
		CurrentPeriodStart:   periodStart,
		CurrentPeriodEnd:     periodEnd,
	})
	if err != nil {
		return pkg.InternalError{Message: "Error upserting subscription", Err: err}
	}
	span.AddEvent("Subscription upserted")

	slog.Info("Subscription upserted", "customerID", customerID, "subscriptionID", subscriptionID, "priceID", priceID, "periodEnd", periodEnd)
	return nil
}

func createCustomer(ctx context.Context, d *Deps, userEmail string) (customerID string, err error) {
	ctx, span, done := ot.StartSpan(ctx, "payment.service.createCustomer")
	defer func() { done(err) }()

	stripe.Key = d.Cfg.StripeAPIKey
	params := &stripe.CustomerParams{
		Params: stripe.Params{
			Context: ctx,
		},
		Email: stripe.String(userEmail),
	}
	c, err := customer.New(params)
	if err != nil {
		return "", pkg.InternalError{Message: "Error creating customer", Err: err}
	}
	span.AddEvent("Customer created in Stripe")

	return c.ID, nil
}
