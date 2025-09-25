import { z, type ZodSchema, type ZodError } from 'zod';
import { logger } from './logger';
import type { Safe } from './safe';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate data against a Zod schema
 */
export function validateSchema<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context?: string
): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);

    if (context) {
      logger.debug(`Validation successful: ${context}`);
    }

    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    const zodError = error as ZodError;
    const errors = zodError.errors.map((err: any) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
      return `${path}${err.message}`;
    });

    if (context) {
      logger.error(`Validation failed: ${context}`, { errors });
    }

    return {
      success: false,
      errors,
    };
  }
}

/**
 * Safe validation that returns a Safe<T> result
 */
export function safeValidate<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context?: string
): Safe<T> {
  const result = validateSchema(data, schema, context);

  if (result.success && result.data) {
    return {
      success: true,
      data: result.data,
      message: 'Validation successful',
    };
  }

  return {
    success: false,
    message: result.errors?.join(', ') || 'Validation failed',
    code: 400,
  };
}

/**
 * Middleware for HTTP response validation
 */
export function createValidationMiddleware<T>(schema: ZodSchema<T>, context?: string) {
  return (data: unknown): Safe<T> => {
    return safeValidate(data, schema, context);
  };
}

/**
 * Common API response schemas
 */
export const ApiResponseSchemas = {
  // Generic success response
  success: z.object({
    success: z.literal(true),
    message: z.string().optional(),
  }),

  // Generic error response
  error: z.object({
    success: z.literal(false),
    message: z.string(),
    code: z.number().optional(),
    details: z.unknown().optional(),
  }),

  // Paginated response
  paginated: <T>(itemSchema: ZodSchema<T>) =>
    z.object({
      data: z.array(itemSchema),
      pagination: z.object({
        page: z.number().min(1),
        limit: z.number().min(1),
        total: z.number().min(0),
        pages: z.number().min(0),
      }),
    }),

  // List response
  list: <T>(itemSchema: ZodSchema<T>) =>
    z.object({
      data: z.array(itemSchema),
      count: z.number().min(0),
    }),

  // Single item response
  single: <T>(itemSchema: ZodSchema<T>) =>
    z.object({
      data: itemSchema,
    }),
};

/**
 * Validate paginated API response
 */
export function validatePaginatedResponse<T>(
  data: unknown,
  itemSchema: ZodSchema<T>,
  context?: string
): Safe<{ data: T[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  return safeValidate(data, ApiResponseSchemas.paginated(itemSchema), context);
}

/**
 * Validate list API response
 */
export function validateListResponse<T>(
  data: unknown,
  itemSchema: ZodSchema<T>,
  context?: string
): Safe<{ data: T[]; count: number }> {
  return safeValidate(data, ApiResponseSchemas.list(itemSchema), context);
}

/**
 * Validate single item API response
 */
export function validateSingleResponse<T>(
  data: unknown,
  itemSchema: ZodSchema<T>,
  context?: string
): Safe<{ data: T }> {
  return safeValidate(data, ApiResponseSchemas.single(itemSchema), context);
}

/**
 * Create a validation chain for API responses
 */
export class ValidationChain<T> {
  private validators: Array<(data: T) => Safe<T>> = [];

  constructor(private initialSchema: ZodSchema<T>, private context?: string) {}

  /**
   * Add a custom validator to the chain
   */
  addValidator(validator: (data: T) => Safe<T>): ValidationChain<T> {
    this.validators.push(validator);
    return this;
  }

  /**
   * Add a business rule validation
   */
  addRule(
    rule: (data: T) => boolean,
    errorMessage: string
  ): ValidationChain<T> {
    this.validators.push((data: T) => {
      if (!rule(data)) {
        return {
          success: false,
          message: errorMessage,
          code: 422,
        };
      }
      return {
        success: true,
        data,
        message: 'Rule validation passed',
      };
    });
    return this;
  }

  /**
   * Execute the validation chain
   */
  validate(data: unknown): Safe<T> {
    // First, validate against the schema
    const schemaResult = safeValidate(data, this.initialSchema, this.context);
    if (!schemaResult.success) {
      return schemaResult;
    }

    // Then run all custom validators
    let currentData = schemaResult.data;
    for (const validator of this.validators) {
      const result = validator(currentData);
      if (!result.success) {
        return result;
      }
      currentData = result.data;
    }

    return {
      success: true,
      data: currentData,
      message: 'All validations passed',
    };
  }
}

/**
 * Create a validation chain
 */
export function createValidationChain<T>(
  schema: ZodSchema<T>,
  context?: string
): ValidationChain<T> {
  return new ValidationChain(schema, context);
}