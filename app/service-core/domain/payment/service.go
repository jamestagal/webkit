package payment

import (
	"app/pkg"
	"app/pkg/auth"
	"context"
	"log/slog"
	"service-core/config"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
)

type store interface {
	SelectUser(ctx context.Context, id uuid.UUID) (query.User, error)
	SelectUserByCustomerID(ctx context.Context, customerID string) (query.User, error)
	UpdateUserCustomerID(ctx context.Context, params query.UpdateUserCustomerIDParams) error
	UpdateUserSubscription(ctx context.Context, params query.UpdateUserSubscriptionParams) error
}

type provider interface {
	CreateCustomer(ctx context.Context, userEmail string) (customerID string, err error)
	CreatePaymentPortal(ctx context.Context, customerID string) (url string, err error)
	CreatePaymentCheckout(ctx context.Context, customerID string, plan string) (url string, err error)
	UpdateSubscription(ctx context.Context, subscriptionID string, priceID string) (err error)
	HandleWebhook(ctx context.Context, payload []byte, signature string) (customerID string, subscriptionID string, subEndDate *time.Time, priceID string, err error)
}

type Service struct {
	cfg      *config.Config
	store    store
	provider provider
}

func NewService(
	cfg *config.Config,
	store store,
	provider provider,
) *Service {
	return &Service{
		cfg:      cfg,
		store:    store,
		provider: provider,
	}
}

type URLResponse struct {
	URL string `json:"url"`
}

func (s *Service) CreatePaymentPortal(
	ctx context.Context,
	userID uuid.UUID,
) (*URLResponse, error) {
	u, err := s.store.SelectUser(ctx, userID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting user by ID", Err: err}
	}
	url, err := s.provider.CreatePaymentPortal(ctx, u.CustomerID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating payment portal", Err: err}
	}
	return &URLResponse{URL: url}, nil
}

func (s *Service) CreatePaymentCheckout(
	ctx context.Context,
	userID uuid.UUID,
	userEmail string,
	plan string,
) (*URLResponse, error) {
	u, err := s.store.SelectUser(ctx, userID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting user by ID", Err: err}
	}

	if u.CustomerID == "" {
		customerID, err := s.provider.CreateCustomer(ctx, userEmail)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error creating customer", Err: err}
		}
		params := query.UpdateUserCustomerIDParams{
			ID:         userID,
			CustomerID: customerID,
		}
		err = s.store.UpdateUserCustomerID(ctx, params)
		u.CustomerID = customerID
		if err != nil {
			return nil, pkg.InternalError{Message: "Error updating customer ID", Err: err}
		}
	}

	var priceID string
	if plan == "premium" {
		priceID = s.cfg.StripePriceIDPremium
	} else {
		priceID = s.cfg.StripePriceIDBasic
	}

	url, err := s.provider.CreatePaymentCheckout(ctx, u.CustomerID, priceID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating payment checkout", Err: err}
	}
	return &URLResponse{URL: url}, nil
}

func (s *Service) UpdateSubscription(
	ctx context.Context,
	userID uuid.UUID,
	plan string,
) error {
	u, err := s.store.SelectUser(ctx, userID)
	if err != nil {
		return pkg.InternalError{Message: "Error selecting user by ID", Err: err}
	}
	if u.SubscriptionID == "" {
		return pkg.InternalError{Message: "User does not have a subscription", Err: err}
	}
	var priceID string
	switch plan {
	case "premium":
		priceID = s.cfg.StripePriceIDPremium
	default:
		priceID = s.cfg.StripePriceIDBasic
	}
	err = s.provider.UpdateSubscription(ctx, u.SubscriptionID, priceID)
	if err != nil {
		return pkg.InternalError{Message: "Error updating subscription", Err: err}
	}
	return nil
}

func (s *Service) Webhook(
	ctx context.Context,
	signature string,
	payload []byte,
) error {
	customerID, subscriptionID, subEndDate, priceID, err := s.provider.HandleWebhook(ctx, payload, signature)
	if err != nil {
		return pkg.InternalError{Message: "Error handling webhook", Err: err}
	}
	if subEndDate == nil {
		return nil
	}
	user, err := s.store.SelectUserByCustomerID(ctx, customerID)
	switch priceID {
	case s.cfg.StripePriceIDBasic:
		user.Access |= auth.BasicPlan
		user.Access &^= auth.PremiumPlan
	case s.cfg.StripePriceIDPremium:
		user.Access |= auth.PremiumPlan
		user.Access &^= auth.BasicPlan
	case "local_price_id":
		user.Access |= auth.BasicPlan
		user.Access &^= auth.PremiumPlan
	default:
		return pkg.InternalError{Message: "Unknown price ID", Err: err}
	}
	params := query.UpdateUserSubscriptionParams{
		CustomerID:      customerID,
		Access:          user.Access,
		SubscriptionID:  subscriptionID,
		SubscriptionEnd: *subEndDate,
	}
	err = s.store.UpdateUserSubscription(ctx, params)
	if err != nil {
		return pkg.InternalError{Message: "Error updating subscription end date", Err: err}
	}
	slog.Info("------ Subscription updated ------", "customerID", customerID, "subscriptionID", subscriptionID, "subEndDate", subEndDate)
	return nil
}
