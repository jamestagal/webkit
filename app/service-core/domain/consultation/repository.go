package consultation

import (
	"context"
	"service-core/storage/query"

	"github.com/google/uuid"
)

// Repository interface defines all consultation-related data operations
type Repository interface {
	// Consultation CRUD operations
	CountConsultations(ctx context.Context, userID uuid.UUID) (int64, error)
	SelectConsultations(ctx context.Context, params query.SelectConsultationsParams) ([]query.Consultation, error)
	SelectConsultationsByStatus(ctx context.Context, params query.SelectConsultationsByStatusParams) ([]query.Consultation, error)
	SelectConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error)
	InsertConsultation(ctx context.Context, params query.InsertConsultationParams) (query.Consultation, error)
	UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error)
	UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error)
	DeleteConsultation(ctx context.Context, id uuid.UUID) error

	// Consultation Draft operations
	SelectConsultationDraft(ctx context.Context, params query.SelectConsultationDraftParams) (query.ConsultationDraft, error)
	InsertConsultationDraft(ctx context.Context, params query.InsertConsultationDraftParams) (query.ConsultationDraft, error)
	UpdateConsultationDraft(ctx context.Context, params query.UpdateConsultationDraftParams) (query.ConsultationDraft, error)
	UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error)
	DeleteConsultationDraft(ctx context.Context, params query.DeleteConsultationDraftParams) error

	// Consultation Version operations
	SelectConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error)
	SelectConsultationVersion(ctx context.Context, params query.SelectConsultationVersionParams) (query.ConsultationVersion, error)
	GetLatestVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error)
	InsertConsultationVersion(ctx context.Context, params query.InsertConsultationVersionParams) (query.ConsultationVersion, error)
	DeleteConsultationVersions(ctx context.Context, consultationID uuid.UUID) error

	// User operations (for joining with consultation data)
	SelectUser(ctx context.Context, id uuid.UUID) (query.User, error)
}

// repositoryImpl implements the Repository interface using sqlc generated queries
type repositoryImpl struct {
	querier query.Querier
}

// NewRepository creates a new consultation repository
func NewRepository(querier query.Querier) Repository {
	return &repositoryImpl{
		querier: querier,
	}
}

// Consultation CRUD operations
func (r *repositoryImpl) CountConsultations(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.querier.CountConsultations(ctx, userID)
}

func (r *repositoryImpl) SelectConsultations(ctx context.Context, params query.SelectConsultationsParams) ([]query.Consultation, error) {
	return r.querier.SelectConsultations(ctx, params)
}

func (r *repositoryImpl) SelectConsultationsByStatus(ctx context.Context, params query.SelectConsultationsByStatusParams) ([]query.Consultation, error) {
	return r.querier.SelectConsultationsByStatus(ctx, params)
}

func (r *repositoryImpl) SelectConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error) {
	return r.querier.SelectConsultation(ctx, id)
}

func (r *repositoryImpl) InsertConsultation(ctx context.Context, params query.InsertConsultationParams) (query.Consultation, error) {
	return r.querier.InsertConsultation(ctx, params)
}

func (r *repositoryImpl) UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error) {
	return r.querier.UpdateConsultation(ctx, params)
}

func (r *repositoryImpl) UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error) {
	return r.querier.UpdateConsultationStatus(ctx, params)
}

func (r *repositoryImpl) DeleteConsultation(ctx context.Context, id uuid.UUID) error {
	return r.querier.DeleteConsultation(ctx, id)
}

// Consultation Draft operations
func (r *repositoryImpl) SelectConsultationDraft(ctx context.Context, params query.SelectConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.SelectConsultationDraft(ctx, params)
}

func (r *repositoryImpl) InsertConsultationDraft(ctx context.Context, params query.InsertConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.InsertConsultationDraft(ctx, params)
}

func (r *repositoryImpl) UpdateConsultationDraft(ctx context.Context, params query.UpdateConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.UpdateConsultationDraft(ctx, params)
}

func (r *repositoryImpl) UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error) {
	return r.querier.UpsertConsultationDraft(ctx, params)
}

func (r *repositoryImpl) DeleteConsultationDraft(ctx context.Context, params query.DeleteConsultationDraftParams) error {
	return r.querier.DeleteConsultationDraft(ctx, params)
}

// Consultation Version operations
func (r *repositoryImpl) SelectConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error) {
	return r.querier.SelectConsultationVersions(ctx, consultationID)
}

func (r *repositoryImpl) SelectConsultationVersion(ctx context.Context, params query.SelectConsultationVersionParams) (query.ConsultationVersion, error) {
	return r.querier.SelectConsultationVersion(ctx, params)
}

func (r *repositoryImpl) GetLatestVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error) {
	return r.querier.GetLatestVersionNumber(ctx, consultationID)
}

func (r *repositoryImpl) InsertConsultationVersion(ctx context.Context, params query.InsertConsultationVersionParams) (query.ConsultationVersion, error) {
	return r.querier.InsertConsultationVersion(ctx, params)
}

func (r *repositoryImpl) DeleteConsultationVersions(ctx context.Context, consultationID uuid.UUID) error {
	return r.querier.DeleteConsultationVersions(ctx, consultationID)
}

// User operations
func (r *repositoryImpl) SelectUser(ctx context.Context, id uuid.UUID) (query.User, error) {
	return r.querier.SelectUser(ctx, id)
}