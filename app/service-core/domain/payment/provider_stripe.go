package payment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"service-core/config"
	"time"

	"github.com/stripe/stripe-go/v82"
	portal_session "github.com/stripe/stripe-go/v82/billingportal/session"
	checkout_session "github.com/stripe/stripe-go/v82/checkout/session"
	"github.com/stripe/stripe-go/v82/customer"
	"github.com/stripe/stripe-go/v82/subscription"
	"github.com/stripe/stripe-go/v82/webhook"
)

type stripeProvider struct {
	cfg *config.Config
}

func (p *stripeProvider) CreateCustomer(
	ctx context.Context,
	userEmail string,
) (string, error) {
	stripe.Key = p.cfg.StripeAPIKey
	params := &stripe.CustomerParams{
		Params: stripe.Params{
			Context: ctx,
		},
		Email: stripe.String(userEmail),
	}
	customer, err := customer.New(params)
	if err != nil {
		return "", fmt.Errorf("error creating customer: %w", err)
	}
	return customer.ID, nil
}

func (p *stripeProvider) CreatePaymentPortal(
	ctx context.Context,
	customerID string,
) (url string, err error) {
	stripe.Key = p.cfg.StripeAPIKey
	params := &stripe.BillingPortalSessionParams{
		Params: stripe.Params{
			Context: ctx,
		},
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(p.cfg.ClientURL + "/payments"),
	}
	session, err := portal_session.New(params)
	if err != nil {
		return "", fmt.Errorf("error creating portal session: %w", err)
	}
	return session.URL, nil
}

func (p *stripeProvider) CreatePaymentCheckout(
	ctx context.Context,
	customerID string,
	priceID string,
) (string, error) {
	stripe.Key = p.cfg.StripeAPIKey

	params := &stripe.CheckoutSessionParams{
		Params: stripe.Params{
			Context: ctx,
		},
		SuccessURL: stripe.String(p.cfg.ClientURL + "/payments/?success=true"),
		CancelURL:  stripe.String(p.cfg.ClientURL + "/payments/?cancel=true"),
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
		Customer: stripe.String(customerID),
		// For one-time payment
		// InvoiceCreation: &stripe.CheckoutSessionInvoiceCreationParams{
		//     Enabled: stripe.Bool(true),
		// },
		AllowPromotionCodes: stripe.Bool(true),
	}

	session, err := checkout_session.New(params)
	if err != nil {
		return "", fmt.Errorf("error creating checkout session: %w", err)
	}
	return session.URL, nil
}

func (p *stripeProvider) UpdateSubscription(
	ctx context.Context,
	subscriptionID string,
	newPriceID string,
) error {
	stripe.Key = p.cfg.StripeAPIKey
	currentSub, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		return fmt.Errorf("error getting subscription: %w", err)
	}
	if currentSub == nil || len(currentSub.Items.Data) == 0 {
		return fmt.Errorf("subscription %s not found or has no items", subscriptionID)
	}
	if len(currentSub.Items.Data) > 1 {
		slog.Warn("Subscription has multiple items. Updating the first item.", "subscription_id", subscriptionID)
		// Add logic here if you need to specifically find an item based on the OLD price ID
	}
	currentItem := currentSub.Items.Data[0]
	if currentItem.Price.ID == newPriceID {
		slog.Info("User is already on the target plan", "subscription_id", subscriptionID, "price_id", newPriceID)
		return nil // Or return a specific error/status indicating no change needed
	}
	params := &stripe.SubscriptionParams{
		Params: stripe.Params{
			Context: ctx,
		},
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:    stripe.String(currentItem.ID),
				Price: stripe.String(newPriceID),
			},
		},
		// 'create_prorations': Charges/credits immediately for the time difference. Common for upgrades.
		// 'none': Changes happen at the next billing cycle boundary. No immediate charge/credit. Common for downgrades.
		// 'always_invoice': Ensures an invoice is created even for $0 changes.
		ProrationBehavior: stripe.String(string(stripe.BillingPortalConfigurationFeaturesSubscriptionUpdateProrationBehaviorAlwaysInvoice)),
		CancelAtPeriodEnd: stripe.Bool(false),
	}

	_, err = subscription.Update(subscriptionID, params)
	if err != nil {
		return fmt.Errorf("error updating subscription: %w", err)
	}

	slog.Info("Subscription updated successfully", "subscription_id", subscriptionID, "new_price_id", newPriceID)
	return nil
}

func (p *stripeProvider) HandleWebhook(
	_ context.Context,
	payload []byte,
	signature string,
) (customerID string, subscriptionID string, subEndDate *time.Time, priceID string, err error) {
	endpointSecret := p.cfg.StripeWebhookSecret
	event, err := webhook.ConstructEventWithOptions(payload, signature, endpointSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		return "", "", nil, "", fmt.Errorf("error verifying webhook signature: %w", err)
	}

	switch event.Type {
	case stripe.EventTypeInvoicePaid:
		var invoice stripe.Invoice
		err := json.Unmarshal(event.Data.Raw, &invoice)
		if err != nil {
			return "", "", nil, "", fmt.Errorf("error parsing invoice JSON: %w", err)
		}
		if len(invoice.Lines.Data) == 0 {
			return "", "", nil, "", errors.New("no invoice lines")
		}
		// Look for positive amount
		var line *stripe.InvoiceLineItem
		for _, l := range invoice.Lines.Data {
			if l.Amount > 0 {
				line = l
				break
			}
		}

		subscriptionID = line.Parent.SubscriptionItemDetails.Subscription
		priceID = line.Pricing.PriceDetails.Price
		subEnd := line.Period.End
		subEndDate := time.Unix(subEnd, 0)
		subEndDate = subEndDate.AddDate(0, 0, p.cfg.SubscriptionSafePeriodDays)
		if subscriptionID == "" || priceID == "" {
			return "", "", nil, "", errors.New("subscription ID or price ID is empty")
		}
		slog.Info("Invoice paid", "customer", invoice.Customer.ID, "subscription", subscriptionID, "price", priceID, "end_date", subEndDate)
		return invoice.Customer.ID, subscriptionID, &subEndDate, priceID, nil
	default:
		slog.Info("Unhandled event type", "type", event.Type)
		return "", "", nil, "", nil
	}
}
