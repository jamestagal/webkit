package consultation

import (
	"app/pkg"
	"context"
	"encoding/json"
	"service-core/storage/query"

	"github.com/google/uuid"
)

type consultationStore interface {
	CountConsultations(ctx context.Context, userID uuid.UUID) (int64, error)
	SelectConsultations(ctx context.Context, params query.SelectConsultationsParams) ([]query.Consultation, error)
	SelectConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error)
	SelectConsultationsByStatus(ctx context.Context, params query.SelectConsultationsByStatusParams) ([]query.Consultation, error)
	InsertConsultation(ctx context.Context, params query.InsertConsultationParams) (query.Consultation, error)
	UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error)
	UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error)
	DeleteConsultation(ctx context.Context, id uuid.UUID) error

	SelectConsultationDraft(ctx context.Context, params query.SelectConsultationDraftParams) (query.ConsultationDraft, error)
	UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error)
	DeleteConsultationDraft(ctx context.Context, params query.DeleteConsultationDraftParams) error

	SelectConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error)
	GetLatestVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error)
	InsertConsultationVersion(ctx context.Context, params query.InsertConsultationVersionParams) (query.ConsultationVersion, error)

	SelectUser(ctx context.Context, id uuid.UUID) (query.User, error)
}

type Service struct {
	consultationStore consultationStore
}

func NewService(consultationStore consultationStore) *Service {
	return &Service{
		consultationStore: consultationStore,
	}
}

type Consultation struct {
	Consultation query.Consultation `json:"consultation"`
	User         query.User         `json:"user"`
}

type ConsultationsResponse struct {
	Count         int64          `json:"count"`
	Consultations []Consultation `json:"consultations"`
}

func (s *Service) GetConsultationsByUserID(
	ctx context.Context,
	page int32,
	limit int32,
	userID uuid.UUID,
) (*ConsultationsResponse, error) {
	errChan := make(chan error, 2)
	var count int64
	consultationsWithUsers := make([]Consultation, 0)

	go func() {
		c, err := s.consultationStore.CountConsultations(ctx, userID)
		if err != nil {
			errChan <- pkg.InternalError{Message: "Error counting consultations", Err: err}
			return
		}
		count = c
		errChan <- nil
	}()

	go func() {
		params := query.SelectConsultationsParams{
			Limit:  limit,
			Offset: (page - 1) * limit,
			UserID: userID,
		}
		consultations, err := s.consultationStore.SelectConsultations(ctx, params)
		if err != nil {
			errChan <- pkg.InternalError{Message: "Error selecting consultations", Err: err}
			return
		}
		for _, consultation := range consultations {
			user, err := s.consultationStore.SelectUser(ctx, consultation.UserID)
			if err != nil {
				errChan <- pkg.InternalError{Message: "Error selecting user", Err: err}
				return
			}
			consultationsWithUsers = append(consultationsWithUsers, Consultation{
				Consultation: consultation,
				User:         user,
			})
		}
		errChan <- nil
	}()

	for range 2 {
		err := <-errChan
		if err != nil {
			return nil, err
		}
	}

	return &ConsultationsResponse{
		Count:         count,
		Consultations: consultationsWithUsers,
	}, nil
}

func (s *Service) GetConsultationByID(
	ctx context.Context,
	id uuid.UUID,
) (*Consultation, error) {
	consultation, err := s.consultationStore.SelectConsultation(ctx, id)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting consultation by ID", Err: err}
	}
	user, err := s.consultationStore.SelectUser(ctx, consultation.UserID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user", Err: err}
	}
	return &Consultation{
		Consultation: consultation,
		User:         user,
	}, nil
}

func (s *Service) CreateConsultation(
	ctx context.Context,
	userID uuid.UUID,
	businessName string,
	contactName string,
	contactTitle string,
	email string,
	phone string,
	website string,
	preferredContact string,
	industry string,
	location string,
	businessData map[string]interface{},
	challenges map[string]interface{},
	goals map[string]interface{},
	budget map[string]interface{},
) (*query.Consultation, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return nil, pkg.InternalError{Message: "Error generating consultation ID", Err: err}
	}

	// Convert maps to JSON for database storage
	businessDataJSON, err := json.Marshal(businessData)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error marshaling business data", Err: err}
	}

	challengesJSON, err := json.Marshal(challenges)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error marshaling challenges", Err: err}
	}

	goalsJSON, err := json.Marshal(goals)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error marshaling goals", Err: err}
	}

	budgetJSON, err := json.Marshal(budget)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error marshaling budget", Err: err}
	}

	params := query.InsertConsultationParams{
		ID:               id,
		UserID:           userID,
		BusinessName:     businessName,
		ContactName:      contactName,
		ContactTitle:     contactTitle,
		Email:            email,
		Phone:            phone,
		Website:          website,
		PreferredContact: preferredContact,
		Industry:         industry,
		Location:         location,
		BusinessData:     businessDataJSON,
		Challenges:       challengesJSON,
		Goals:            goalsJSON,
		Budget:           budgetJSON,
		Status:           "scheduled",
	}

	err = validate(&schema{
		businessName:     params.BusinessName,
		contactName:      params.ContactName,
		email:            params.Email,
		industry:         params.Industry,
		location:         params.Location,
		preferredContact: params.PreferredContact,
	})
	if err != nil {
		return nil, err
	}

	consultation, err := s.consultationStore.InsertConsultation(ctx, params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error inserting consultation", Err: err}
	}
	return &consultation, nil
}

func (s *Service) UpdateConsultationStatus(
	ctx context.Context,
	id uuid.UUID,
	status string,
) (*query.Consultation, error) {
	params := query.UpdateConsultationStatusParams{
		ID:     id,
		Status: status,
	}

	consultation, err := s.consultationStore.UpdateConsultationStatus(ctx, params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error updating consultation status", Err: err}
	}
	return &consultation, nil
}

func (s *Service) DeleteConsultation(
	ctx context.Context,
	id uuid.UUID,
) error {
	err := s.consultationStore.DeleteConsultation(ctx, id)
	if err != nil {
		return pkg.InternalError{Message: "Error deleting consultation", Err: err}
	}
	return nil
}

func (s *Service) SaveDraft(
	ctx context.Context,
	consultationID uuid.UUID,
	userID uuid.UUID,
	draftData map[string]interface{},
) error {
	draftID, err := uuid.NewV7()
	if err != nil {
		return pkg.InternalError{Message: "Error generating draft ID", Err: err}
	}

	draftJSON, err := json.Marshal(draftData)
	if err != nil {
		return pkg.InternalError{Message: "Error marshaling draft data", Err: err}
	}

	params := query.UpsertConsultationDraftParams{
		ID:             draftID,
		ConsultationID: consultationID,
		UserID:         userID,
		DraftData:      draftJSON,
	}

	_, err = s.consultationStore.UpsertConsultationDraft(ctx, params)
	if err != nil {
		return pkg.InternalError{Message: "Error saving consultation draft", Err: err}
	}
	return nil
}

func (s *Service) GetDraft(
	ctx context.Context,
	consultationID uuid.UUID,
	userID uuid.UUID,
) (*query.ConsultationDraft, error) {
	params := query.SelectConsultationDraftParams{
		ConsultationID: consultationID,
		UserID:         userID,
	}

	draft, err := s.consultationStore.SelectConsultationDraft(ctx, params)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting consultation draft", Err: err}
	}
	return &draft, nil
}