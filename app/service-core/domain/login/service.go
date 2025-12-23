package login

import (
	"context"
	"errors"
	"fmt"
	"gofast/pkg"
	"gofast/pkg/auth"
	ot "gofast/pkg/otel"
	"gofast/pkg/str"
	"gofast/service-core/config"
	"gofast/service-core/storage/query"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"
	verify "github.com/twilio/twilio-go/rest/verify/v2"
	"golang.org/x/oauth2"
)

type Deps struct {
	Cfg    *config.Config
	Store  *query.Queries
	OAuth  OAuthClient
	Twilio TwilioClient
}

type AuthUser struct {
	ID                 string `json:"id"`
	Access             int64  `json:"access"`
	Avatar             string `json:"avatar"`
	Email              string `json:"email"`
	SubscriptionActive bool   `json:"subscription_active"`
}

type AuthResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ReturnURL    string    `json:"return_url"`
	User         *AuthUser `json:"user"`
	Fresh        bool      `json:"fresh"`
	// used for 2FA
	SessionToken string `json:"session_token"`
	HasPhone     bool   `json:"has_phone"`
}

type URLResponse struct {
	URL string `json:"url"`
}

func Refresh(ctx context.Context, deps Deps, accessToken string, refreshToken string) (result *AuthResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.Refresh")
	defer func() { done(err) }()

	// Validate token
	claims, err := auth.ValidateAccessToken(accessToken)
	// If access token is valid, return user info
	if err == nil {
		span.AddEvent("Access token is valid")
		// Get user from database
		user, err := deps.Store.SelectUserByID(ctx, claims.ID)
		if err != nil {
			return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
		}
		span.AddEvent("User selected from store")
		// Check if user has an active subscription
		subscriptionActive, access, err := CheckUserAccess(ctx, deps, user)
		if err != nil {
			return nil, pkg.UnauthorizedError{Message: "Error checking user access", Err: err}
		}
		span.AddEvent("User access checked")
		return &AuthResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ReturnURL:    "",
			User: &AuthUser{
				ID:                 user.ID.String(),
				Access:             access,
				Avatar:             user.Avatar,
				Email:              user.Email,
				SubscriptionActive: subscriptionActive,
			},
			Fresh:        false,
			HasPhone:     false,
			SessionToken: "",
		}, nil
	}
	// Validate refresh token
	span.AddEvent("Validating refresh token")
	refreshTokenClaims, err := auth.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error validating refresh token", Err: err}
	}
	// Extract token from database
	refreshTokenStore, err := deps.Store.SelectAuthTokenByID(ctx, refreshTokenClaims.ID.String())
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting token by ID", Err: err}
	}
	span.AddEvent("Refresh token selected from store")
	// Check if token has a user Id, if not it means the token have been revoked
	if !refreshTokenStore.UserID.Valid {
		return nil, pkg.UnauthorizedError{Message: "Token revoked", Err: errors.New("token revoked")}
	}
	// Check if token is expired
	if time.Now().After(refreshTokenStore.Expires) {
		return nil, pkg.UnauthorizedError{Message: "Token expired", Err: errors.New("token expired")}
	}
	// Get user from database
	user, err := deps.Store.SelectUserByID(ctx, refreshTokenClaims.UserID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
	}
	span.AddEvent("User selected from store")
	// Create refresh token (valid for 30 days)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error generating UUID", Err: err}
	}
	params := query.InsertAuthTokenParams{
		ID:        id.String(),
		Expires:   time.Now().Add(deps.Cfg.RefreshTokenExp),
		UserID:    uuid.NullUUID{UUID: refreshTokenClaims.UserID, Valid: true},
		Provider:  "",
		Verifier:  "",
		ReturnUrl: "",
	}
	newRefreshTokenStore, err := deps.Store.InsertAuthToken(ctx, params)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error inserting refresh token", Err: err}
	}
	span.AddEvent("New refresh token inserted into store")
	// Check if user has an active subscription
	subscriptionActive, access, err := CheckUserAccess(ctx, deps, user)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error checking user access", Err: err}
	}
	span.AddEvent("User access checked")
	// Generate JWT tokens
	newAccessToken, newRefreshToken, err := auth.GenerateTokens(
		newRefreshTokenStore.ID,
		user.ID.String(),
		access,
		user.Avatar,
		user.Email,
		subscriptionActive,
		deps.Cfg.AccessTokenExp,
		deps.Cfg.RefreshTokenExp,
	)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error generating JWT token", Err: err}
	}
	span.AddEvent("JWT tokens generated")

	// Update user activity and update old refresh token expiration to 1 minute
	// This is to prevent the refresh token from being used again
	go func() {
		ctx, cancel := context.WithTimeout(ctx, deps.Cfg.ContextTimeout)
		defer cancel()
		params := query.UpdateAuthTokenParams{
			ID:      refreshTokenClaims.ID.String(),
			Expires: time.Now().Add(time.Minute),
		}
		err := deps.Store.UpdateAuthToken(ctx, params)
		if err != nil {
			slog.Error("Error updating token", "error", err)
		}
		err = deps.Store.UpdateUserActivity(ctx, user.ID)
		if err != nil {
			slog.Error("Error updating user", "error", err)
		}
	}()

	return &AuthResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		ReturnURL:    "",
		User: &AuthUser{
			ID:                 user.ID.String(),
			Access:             access,
			Avatar:             user.Avatar,
			Email:              user.Email,
			SubscriptionActive: subscriptionActive,
		},
		Fresh:        true,
		SessionToken: "",
		HasPhone:     false,
	}, nil
}

func extractPRIdentifier(deps Deps) string {
	// Extract PR identifier from CLIENT_URL (e.g., "pr-87" from "https://pr-87-context.workers.dev")
	re := regexp.MustCompile(`pr-\d+`)
	match := re.FindString(deps.Cfg.ClientURL)
	return match
}

func Login(
	ctx context.Context,
	deps Deps,
	returnURL string,
	provider Provider,
) (result *URLResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.Login")
	defer func() { done(err) }()

	ctx, cancel := context.WithTimeout(ctx, deps.Cfg.ContextTimeout)
	defer cancel()

	// Generate random state
	randomState, err := str.GenerateRandomBase64String()
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error generating state", Err: err}
	}

	// Prefix state with PR identifier for PR environments (proxy will route based on this)
	state := randomState
	if prID := extractPRIdentifier(deps); prID != "" {
		state = prID + "-" + randomState
		span.AddEvent("Prefixed state with PR identifier: " + prID)
	}

	// Generate code verifier
	verifier := oauth2.GenerateVerifier()
	span.AddEvent("State and verifier generated")

	// Store state and verifier in database
	params := query.InsertAuthTokenParams{
		ID:        state,
		Expires:   time.Now().Add(deps.Cfg.AccessTokenExp),
		Provider:  string(provider),
		Verifier:  verifier,
		ReturnUrl: returnURL,
		UserID:    uuid.NullUUID{UUID: uuid.Nil, Valid: false},
	}
	_, err = deps.Store.InsertAuthToken(ctx, params)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error inserting token", Err: err}
	}
	span.AddEvent("Auth token inserted into store")

	// Redirect user to consent page to ask for permission
	url, err := deps.OAuth.AuthCodeURL(deps.Cfg, provider, state, oauth2.AccessTypeOffline, oauth2.S256ChallengeOption(verifier))
	if err != nil {
		return nil, pkg.BadRequestError{Message: "Provider not found", Err: err}
	}
	return &URLResponse{URL: url}, nil
}

func Callback(
	ctx context.Context,
	deps Deps,
	state string,
	code string,
) (result *AuthResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.Callback")
	defer func() { done(err) }()

	// Get verifier from state
	token, err := deps.Store.SelectAuthTokenByID(ctx, state)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting token by ID", Err: err}
	}
	if time.Now().After(token.Expires) {
		return nil, pkg.InternalError{Message: "Token expired", Err: errors.New("token expired")}
	}
	span.AddEvent("Auth token selected from store")

	// Verify code and exchange for token
	provider := Provider(token.Provider)
	oauthToken, err := deps.OAuth.Exchange(ctx, deps.Cfg, provider, code, oauth2.VerifierOption(token.Verifier))
	if err != nil {
		return nil, pkg.InternalError{Message: "Error exchanging code for token", Err: err}
	}
	span.AddEvent("OAuth code exchanged for token")

	// Fetch user info from provider
	userInfo, err := deps.OAuth.GetUserInfo(ctx, provider, oauthToken.AccessToken)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error fetching user info", Err: err}
	}
	span.AddEvent("User info fetched from provider")

	// Get user, create if not exists
	userEmail := userInfo.Email
	userSub := fmt.Sprintf("%s:%s", token.Provider, userInfo.Sub)
	userAvatar := userInfo.Avatar
	user, err := deps.Store.SelectUserByEmailAndSub(ctx, query.SelectUserByEmailAndSubParams{
		Email: userEmail,
		Sub:   userSub,
	})

	// Create new user if not found
	if err != nil {
		span.AddEvent("User not found, creating new user")
		apiKey, err := str.GenerateRandomHexString()
		if err != nil {
			return nil, pkg.InternalError{Message: "Error generating API key", Err: err}
		}
		user, err = deps.Store.InsertUser(ctx, query.InsertUserParams{
			Email:  userEmail,
			Access: auth.UserAccess,
			Sub:    userSub,
			Avatar: userAvatar,
			ApiKey: apiKey,
		})
		if err != nil {
			return nil, pkg.InternalError{Message: "Error inserting user", Err: err}
		}
		span.AddEvent("New user inserted into store")
	} else {
		span.AddEvent("User found in store")
	}

	// If Twilio is not configured, skip 2FA
	if deps.Cfg.TwilioServiceSID == "" {
		span.AddEvent("Twilio not configured, skipping 2FA")
		authResponse, err := createAuthTokens(ctx, deps, user)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error creating auth tokens", Err: err}
		}
		authResponse.ReturnURL = token.ReturnUrl
		return authResponse, nil
	}

	// If user has a phone number, send a 2FA code
	if user.Phone != "" {
		span.AddEvent("User has phone, sending 2FA code")
		sessionToken, err := Phone(ctx, deps, user.ID, user.Phone)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error sending SMS", Err: err}
		}
		return &AuthResponse{
			ReturnURL:    token.ReturnUrl,
			SessionToken: sessionToken,
			HasPhone:     true,
			AccessToken:  "",
			RefreshToken: "",
			User:         nil,
			Fresh:        false,
		}, nil
	}

	// Generate session token
	span.AddEvent("User has no phone, generating session token")
	sessionToken, err := auth.GenerateSessionToken(user.ID.String(), "", deps.Cfg.AccessTokenExp)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error generating session token", Err: err}
	}
	return &AuthResponse{
		ReturnURL:    token.ReturnUrl,
		SessionToken: sessionToken,
		HasPhone:     false,
		AccessToken:  "",
		RefreshToken: "",
		User:         nil,
		Fresh:        false,
	}, nil
}

func Phone(
	ctx context.Context,
	deps Deps,
	userID uuid.UUID,
	phone string,
) (result string, err error) {
	_, span, done := ot.StartSpan(ctx, "login.service.Phone")
	defer func() { done(err) }()

	if phone == "" {
		return "", pkg.UnauthorizedError{Message: "Phone number is required", Err: errors.New("phone number is required")}
	}

	// Send SMS
	params := &verify.CreateVerificationParams{}
	params.SetTo(phone)
	params.SetChannel("sms")
	_, err = deps.Twilio.CreateVerification(deps.Cfg.TwilioServiceSID, params)
	if err != nil {
		return "", pkg.UnauthorizedError{Message: "Error sending SMS", Err: err}
	}
	span.AddEvent("SMS verification sent")

	// Generate session token
	sessionToken, err := auth.GenerateSessionToken(userID.String(), phone, deps.Cfg.AccessTokenExp)
	if err != nil {
		return "", pkg.UnauthorizedError{Message: "Error generating session token", Err: err}
	}
	span.AddEvent("Session token generated")
	return sessionToken, nil
}

func Verify(
	ctx context.Context,
	deps Deps,
	userID uuid.UUID,
	phone string,
	code string,
) (result *AuthResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.Verify")
	defer func() { done(err) }()

	user, err := deps.Store.SelectUserByID(ctx, userID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
	}
	span.AddEvent("User selected from store")

	params := &verify.CreateVerificationCheckParams{}
	params.SetTo(phone)
	params.SetCode(code)

	r, err := deps.Twilio.CreateVerificationCheck(deps.Cfg.TwilioServiceSID, params)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error verifying code", Err: err}
	}
	if *r.Status != "approved" {
		return nil, pkg.UnauthorizedError{Message: "Invalid code", Err: errors.New("invalid code")}
	}
	span.AddEvent("SMS verification code verified")

	err = deps.Store.UpdateUserPhone(ctx, query.UpdateUserPhoneParams{
		ID:    userID,
		Phone: phone,
	})
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error updating user phone", Err: err}
	}
	span.AddEvent("User phone updated in store")

	authResponse, err := createAuthTokens(ctx, deps, user)
	if err != nil {
		return nil, pkg.UnauthorizedError{Message: "Error creating auth tokens", Err: err}
	}
	return authResponse, nil
}

// CheckUserAccess checks the user's subscription status and returns the appropriate access level.
// GF_STRIPE_START
func CheckUserAccess(ctx context.Context, deps Deps, user query.User) (subscriptionActive bool, access int64, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.CheckUserAccess")
	defer func() { done(err) }()

	// Start with base access (no plan bits)
	access = user.Access
	access &^= auth.ProPlan
	access &^= auth.BasicPlan

	// Check for active subscription
	sub, err := deps.Store.SelectActiveSubscription(ctx, user.ID)
	if err != nil {
		// No active subscription found
		span.AddEvent("No active subscription")
		return false, access, nil
	}

	// Derive plan bits from subscription
	span.AddEvent("Active subscription found")
	switch sub.StripePriceID {
	case deps.Cfg.StripePriceIDBasic:
		access |= auth.BasicPlan
	case deps.Cfg.StripePriceIDPro:
		access |= auth.ProPlan
	}

	return true, access, nil
}

// GF_STRIPE_END

func ForceRefresh(ctx context.Context, deps Deps, userID uuid.UUID) (result *AuthResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.ForceRefresh")
	defer func() { done(err) }()

	user, err := deps.Store.SelectUserByID(ctx, userID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
	}
	span.AddEvent("User selected from store")

	return createAuthTokens(ctx, deps, user)
}

func createAuthTokens(ctx context.Context, deps Deps, user query.User) (result *AuthResponse, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.createAuthTokens")
	defer func() { done(err) }()

	// Check if user has an active subscription
	subscriptionActive, access, err := CheckUserAccess(ctx, deps, user)
	if err != nil {
		return nil, fmt.Errorf("error checking user access: %w", err)
	}

	// Create refresh token (valid for 30 days)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, fmt.Errorf("error generating UUID: %w", err)
	}
	params := query.InsertAuthTokenParams{
		ID:        id.String(),
		Expires:   time.Now().Add(deps.Cfg.RefreshTokenExp),
		UserID:    uuid.NullUUID{UUID: user.ID, Valid: true},
		Provider:  "",
		Verifier:  "",
		ReturnUrl: "",
	}
	refreshToken, err := deps.Store.InsertAuthToken(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("error inserting refresh token: %w", err)
	}
	span.AddEvent("Refresh token inserted into store")

	// Generate JWT tokens
	jwtToken, jwtRefreshToken, err := auth.GenerateTokens(
		refreshToken.ID,
		user.ID.String(),
		access,
		user.Avatar,
		user.Email,
		subscriptionActive,
		deps.Cfg.AccessTokenExp,
		deps.Cfg.RefreshTokenExp,
	)
	if err != nil {
		return nil, fmt.Errorf("error generating JWT token: %w", err)
	}
	span.AddEvent("JWT tokens generated")
	return &AuthResponse{
		AccessToken:  jwtToken,
		RefreshToken: jwtRefreshToken,
		ReturnURL:    "",
		User: &AuthUser{
			ID:                 user.ID.String(),
			Access:             access,
			Avatar:             user.Avatar,
			Email:              user.Email,
			SubscriptionActive: subscriptionActive,
		},
		Fresh:        true,
		SessionToken: "",
		HasPhone:     false,
	}, nil
}

func HTTPCall(ctx context.Context, url string, accessToken string) (result []byte, err error) {
	ctx, span, done := ot.StartSpan(ctx, "login.service.HTTPCall")
	defer func() { done(err) }()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("http.NewRequest: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http.DefaultClient.Do: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Error("Error closing response body", "error", err)
		}
	}()
	span.AddEvent("HTTP response received")
	userInfoB, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("io.ReadAll: %w", err)
	}
	return userInfoB, nil
}
