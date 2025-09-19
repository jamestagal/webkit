package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"io"
	"net/http"
	"time"
)

func (h *Handler) handlePaymentsPortal(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	user, err := h.authService.Auth(token, auth.GetPayments)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	response, err := h.paymentService.CreatePaymentPortal(r.Context(), user.ID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	http.Redirect(w, r, response.URL, http.StatusSeeOther)
}

func (h *Handler) handlePaymentsCheckout(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	user, err := h.authService.Auth(token, auth.CreatePayment)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	plan := r.URL.Query().Get("plan")
	response, err := h.paymentService.CreatePaymentCheckout(r.Context(), user.ID, user.Email, plan)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	// access_token stores the subscription status, so we need to refresh it
	http.SetCookie(w, &http.Cookie{
		Name:   "access_token",
		Domain: h.cfg.Domain,
		Value:  "",
		MaxAge: -1,
	})
	http.Redirect(w, r, response.URL, http.StatusSeeOther)
}

func (h *Handler) handlePaymentsUpdate(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	user, err := h.authService.Auth(token, auth.CreatePayment)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	plan := r.URL.Query().Get("plan")
	err = h.paymentService.UpdateSubscription(r.Context(), user.ID, plan)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	// access_token stores the subscription status, so we need to refresh it
	http.SetCookie(w, &http.Cookie{
		Name:   "access_token",
		Domain: h.cfg.Domain,
		Value:  "",
		MaxAge: -1,
	})
	// wait for 5 seconds before redirecting for webhook to be processed
	time.Sleep(5 * time.Second)
	http.Redirect(w, r, h.cfg.ClientURL+"/payments/?update=true", http.StatusSeeOther)
}

func (h *Handler) handlePaymentsWebhook(w http.ResponseWriter, r *http.Request) {
	const MaxBodyBytes = int64(65536)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Error reading request body",
			Err:     err,
		})
		return
	}
	signature := r.Header.Get("Stripe-Signature")
	err = h.paymentService.Webhook(r.Context(), signature, payload)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
}
