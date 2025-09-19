package payment

import (
	"context"
	"log/slog"
	"service-core/config"
	"time"
)

type localProvider struct {
	cfg *config.Config
}

func (p *localProvider) CreateCustomer(
	_ context.Context,
	_ string,
) (string, error) {
	return "local_customer_id", nil
}

func (p *localProvider) CreatePaymentPortal(
	_ context.Context,
	_ string,
) (string, error) {
	return p.cfg.ClientURL + "/payments/mock?type=portal", nil
}

func (p *localProvider) CreatePaymentCheckout(
	_ context.Context,
	_ string,
	_ string,
) (string, error) {
	return p.cfg.ClientURL + "/payments/mock?type=checkout", nil
}

func (p *localProvider) UpdateSubscription(
	_ context.Context,
	_ string,
	_ string,
) error {
	slog.Info("Local provider subscription update")
	return nil
}

func (p *localProvider) HandleWebhook(
	_ context.Context,
	_ []byte,
	_ string,
) (string, string, *time.Time, string, error) {
	slog.Info("Local provider webhook")
	// End date is 1 month from now
	endDate := time.Now().AddDate(0, 1, 0)
	return "local_customer_id", "local_subscription_id", &endDate, "local_price_id", nil
}
