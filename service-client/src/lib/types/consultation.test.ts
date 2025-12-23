import { describe, it, expect } from 'vitest';
import {
  ContactInfoSchema,
  BusinessContextSchema,
  PainPointsSchema,
  GoalsObjectivesSchema,
  ConsultationSchema,
  ConsultationStatus,
  UrgencyLevel,
  type ContactInfo,
  type BusinessContext,
  type PainPoints,
  type GoalsObjectives
} from './consultation';

describe('ContactInfoSchema', () => {
  it('should validate complete contact info', () => {
    const validData = {
      business_name: 'Acme Corp',
      contact_person: 'John Doe',
      email: 'john@acme.com',
      phone: '+1-555-0100',
      website: 'https://acme.com'
    };

    const result = ContactInfoSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.business_name).toBe('Acme Corp');
      expect(result.data.email).toBe('john@acme.com');
    }
  });

  it('should validate minimal contact info (all fields optional)', () => {
    const minimalData = {};

    const result = ContactInfoSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      business_name: 'Acme Corp',
      email: 'not-an-email'
    };

    const result = ContactInfoSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('email');
    }
  });

  it('should reject invalid website URL', () => {
    const invalidData = {
      business_name: 'Acme Corp',
      website: 'not-a-url'
    };

    const result = ContactInfoSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('website');
    }
  });

  it('should accept partial data with only business name', () => {
    const partialData = {
      business_name: 'Acme Corp'
    };

    const result = ContactInfoSchema.safeParse(partialData);
    expect(result.success).toBe(true);
  });
});

describe('BusinessContextSchema', () => {
  it('should validate complete business context', () => {
    const validData: BusinessContext = {
      industry: 'Technology',
      business_type: 'B2B SaaS',
      team_size: 50,
      current_platform: 'WordPress',
      digital_presence: ['website', 'social_media', 'email_marketing'],
      marketing_channels: ['SEO', 'PPC', 'Content Marketing']
    };

    const result = BusinessContextSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate minimal business context', () => {
    const minimalData = {};

    const result = BusinessContextSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should reject negative team size', () => {
    const invalidData = {
      team_size: -5
    };

    const result = BusinessContextSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('team_size');
    }
  });

  it('should reject non-integer team size', () => {
    const invalidData = {
      team_size: 5.5
    };

    const result = BusinessContextSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('team_size');
    }
  });

  it('should accept team size of 1', () => {
    const validData = {
      team_size: 1
    };

    const result = BusinessContextSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('PainPointsSchema', () => {
  it('should validate complete pain points', () => {
    const validData: PainPoints = {
      primary_challenges: ['Slow website', 'Poor SEO', 'Low conversion rates'],
      technical_issues: ['Outdated CMS', 'No mobile optimization'],
      urgency_level: 'high',
      impact_assessment: 'Critical business impact - losing customers daily',
      current_solution_gaps: ['No analytics', 'Poor UX', 'Security concerns']
    };

    const result = PainPointsSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate minimal pain points', () => {
    const minimalData = {};

    const result = PainPointsSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should accept all urgency levels', () => {
    const levels: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];

    for (const level of levels) {
      const data = { urgency_level: level };
      const result = PainPointsSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid urgency level', () => {
    const invalidData = {
      urgency_level: 'extreme'
    };

    const result = PainPointsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('urgency_level');
    }
  });

  it('should accept empty arrays for challenge lists', () => {
    const validData = {
      primary_challenges: [],
      technical_issues: []
    };

    const result = PainPointsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('GoalsObjectivesSchema', () => {
  it('should validate complete goals and objectives', () => {
    const validData: GoalsObjectives = {
      primary_goals: ['Increase traffic by 200%', 'Improve conversion rate'],
      secondary_goals: ['Build brand awareness', 'Expand market reach'],
      success_metrics: ['Traffic', 'Conversions', 'Revenue'],
      kpis: ['Monthly visitors', 'Lead generation', 'Customer acquisition cost'],
      timeline: {
        desired_start: '2025-11-01',
        target_completion: '2026-02-01',
        milestones: ['Discovery phase', 'Design approval', 'Development', 'Launch']
      },
      budget_range: '$50,000 - $100,000',
      budget_constraints: ['Phased payments', 'ROI requirements']
    };

    const result = GoalsObjectivesSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate minimal goals and objectives', () => {
    const minimalData = {};

    const result = GoalsObjectivesSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should accept partial timeline', () => {
    const validData = {
      timeline: {
        desired_start: '2025-11-01'
      }
    };

    const result = GoalsObjectivesSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept goals without timeline', () => {
    const validData = {
      primary_goals: ['Increase traffic'],
      budget_range: '$10,000 - $25,000'
    };

    const result = GoalsObjectivesSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('ConsultationSchema', () => {
  it('should validate complete consultation', () => {
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '223e4567-e89b-12d3-a456-426614174000',
      contact_info: {},
      business_context: {},
      pain_points: {},
      goals_objectives: {},
      status: 'draft' as const,
      completion_percentage: 25,
      created_at: '2025-10-24T10:00:00Z',
      updated_at: '2025-10-24T10:05:00Z'
    };

    const result = ConsultationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate completed consultation', () => {
    const validData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '223e4567-e89b-12d3-a456-426614174000',
      contact_info: {},
      business_context: {},
      pain_points: {},
      goals_objectives: {},
      status: 'completed' as const,
      completion_percentage: 100,
      created_at: '2025-10-24T10:00:00Z',
      updated_at: '2025-10-24T10:15:00Z',
      completed_at: '2025-10-24T10:15:00Z'
    };

    const result = ConsultationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid consultation status', () => {
    const invalidData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '223e4567-e89b-12d3-a456-426614174000',
      contact_info: {},
      business_context: {},
      pain_points: {},
      goals_objectives: {},
      status: 'pending',
      created_at: '2025-10-24T10:00:00Z',
      updated_at: '2025-10-24T10:05:00Z'
    };

    const result = ConsultationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID format', () => {
    const invalidData = {
      id: 'not-a-uuid',
      user_id: '223e4567-e89b-12d3-a456-426614174000',
      contact_info: {},
      business_context: {},
      pain_points: {},
      goals_objectives: {},
      status: 'draft',
      created_at: '2025-10-24T10:00:00Z',
      updated_at: '2025-10-24T10:05:00Z'
    };

    const result = ConsultationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('id');
    }
  });

  it('should reject completion percentage over 100', () => {
    const invalidData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '223e4567-e89b-12d3-a456-426614174000',
      contact_info: {},
      business_context: {},
      pain_points: {},
      goals_objectives: {},
      status: 'draft',
      completion_percentage: 150,
      created_at: '2025-10-24T10:00:00Z',
      updated_at: '2025-10-24T10:05:00Z'
    };

    const result = ConsultationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('completion_percentage');
    }
  });

  it('should reject negative completion percentage', () => {
    const invalidData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '223e4567-e89b-12d3-a456-426614174000',
      contact_info: {},
      business_context: {},
      pain_points: {},
      goals_objectives: {},
      status: 'draft',
      completion_percentage: -10,
      created_at: '2025-10-24T10:00:00Z',
      updated_at: '2025-10-24T10:05:00Z'
    };

    const result = ConsultationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('completion_percentage');
    }
  });

  it('should accept all valid consultation statuses', () => {
    const statuses = ['draft', 'completed', 'archived'] as const;

    for (const status of statuses) {
      const data = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '223e4567-e89b-12d3-a456-426614174000',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status,
        created_at: '2025-10-24T10:00:00Z',
        updated_at: '2025-10-24T10:05:00Z'
      };

      const result = ConsultationSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });
});
