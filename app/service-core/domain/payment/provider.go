package payment

import (
	"service-core/config"
)

//nolint:ireturn
func NewProvider(cfg *config.Config) provider {
	switch cfg.PaymentProvider {
	case "stripe":
		return &stripeProvider{cfg: cfg}
	case "local":
		return &localProvider{cfg: cfg}
	default:
		panic("Invalid provider")
	}
}
