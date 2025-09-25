import { logger } from "./logger";
import type { Safe } from "./safe";
import { safeValidate, type ValidationChain } from "./validation";
import type { ZodSchema } from "zod";

export interface HttpOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  form?: FormData;
  json?: Record<string, unknown>;
  token?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  validateWith?: ZodSchema<unknown> | ValidationChain<unknown>;
  validationContext?: string;
}

export interface HttpResponse<T> {
  data?: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class HttpClient {
  private defaultTimeout = 10000; // 10 seconds
  private defaultRetries = 3;
  private defaultRetryDelay = 1000; // 1 second

  async request<T>(url: string, options: HttpOptions = {}): Promise<Safe<T>> {
    const {
      method = "GET",
      form,
      json,
      token,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      headers: customHeaders = {},
      skipAuth = false,
      validateWith,
      validationContext,
    } = options;

    let attempt = 0;

    while (attempt <= retries) {
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers = new Headers(customHeaders);

        // Add authorization header
        if (token && !skipAuth) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        // Set content type for JSON requests
        if (json && !form) {
          headers.set("Content-Type", "application/json");
        }

        // Prepare request body
        let body: string | FormData | null = null;
        if (form) {
          body = form;
        } else if (json) {
          body = JSON.stringify(json);
        }

        logger.debug(`HTTP ${method} ${url} (attempt ${attempt + 1}/${retries + 1})`);

        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        // Handle different response statuses
        if (response.ok) {
          const parseResult = await this.parseResponse<T>(response);

          // Apply validation if schema provided
          if (parseResult.success && validateWith) {
            return this.validateResponse(parseResult.data, validateWith, validationContext);
          }

          return parseResult;
        }

        // Handle client and server errors
        const errorResult = await this.handleErrorResponse(response);

        // Retry on server errors (5xx) or network issues
        if (response.status >= 500 && attempt < retries) {
          attempt++;
          await this.sleep(retryDelay * attempt); // Exponential backoff
          continue;
        }

        // Return error for client errors (4xx) or max retries reached
        return errorResult;

      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle fetch errors (network, timeout, etc.)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error(`HTTP request timeout: ${url}`);
          if (attempt < retries) {
            attempt++;
            await this.sleep(retryDelay * attempt);
            continue;
          }
          return {
            success: false,
            message: `Request timeout after ${timeout}ms`,
            code: 408,
          };
        }

        // Handle other network errors
        if (attempt < retries) {
          attempt++;
          logger.warn(`Network error on attempt ${attempt}, retrying...`, error);
          await this.sleep(retryDelay * attempt);
          continue;
        }

        logger.error(`HTTP request failed after ${retries + 1} attempts`, error);
        return {
          success: false,
          message: error instanceof Error ? error.message : "Network error",
          code: 0,
        };
      }
    }

    // This should never be reached
    return {
      success: false,
      message: "Maximum retry attempts exceeded",
      code: 500,
    };
  }

  private async parseResponse<T>(response: Response): Promise<Safe<T>> {
    try {
      // Handle empty responses (204 No Content)
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return {
          success: true,
          data: {} as T,
          message: "Success",
        };
      }

      // Check content type
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        logger.warn(`Non-JSON response: ${contentType}`, { text: text.substring(0, 200) });
        return {
          success: false,
          message: `Expected JSON response, got ${contentType}`,
          code: response.status,
        };
      }

      // Parse JSON response
      const data = await response.json() as T;
      return {
        success: true,
        data,
        message: "Success",
      };

    } catch (error) {
      logger.error("Failed to parse response", error);
      return {
        success: false,
        message: "Invalid response format",
        code: response.status,
      };
    }
  }

  private async handleErrorResponse(response: Response): Promise<Safe<never>> {
    try {
      const contentType = response.headers.get("content-type");
      let errorMessage = response.statusText;

      // Try to extract error message from response body
      if (contentType?.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || response.statusText;
        } catch {
          // Fall back to status text if JSON parsing fails
        }
      } else {
        try {
          const textResponse = await response.text();
          if (textResponse) {
            errorMessage = textResponse.substring(0, 200); // Limit error message length
          }
        } catch {
          // Fall back to status text if text parsing fails
        }
      }

      logger.error(`HTTP ${response.status} error`, { url: response.url, message: errorMessage });

      return {
        success: false,
        message: errorMessage,
        code: response.status,
      };

    } catch (error) {
      logger.error("Failed to parse error response", error);
      return {
        success: false,
        message: response.statusText || "Unknown error",
        code: response.status,
      };
    }
  }

  private validateResponse<T>(
    data: T,
    validator: ZodSchema<unknown> | ValidationChain<unknown>,
    context?: string
  ): Safe<T> {
    try {
      // Handle ValidationChain
      if (validator && typeof validator === 'object' && 'validate' in validator) {
        const chain = validator as ValidationChain<T>;
        return chain.validate(data);
      }

      // Handle ZodSchema
      if (validator) {
        const schema = validator as ZodSchema<T>;
        return safeValidate(data, schema, context);
      }

      // No validation needed
      return {
        success: true,
        data,
        message: 'No validation applied',
      };
    } catch (error) {
      logger.error('Response validation error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Validation failed',
        code: 422,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default HTTP client instance
export const httpClient = new HttpClient();

// Backward compatibility - enhanced version of the original api function
export async function api<T>(
	url: string,
	options: HttpOptions = {},
): Promise<Safe<T>> {
  return httpClient.request<T>(url, options);
}
