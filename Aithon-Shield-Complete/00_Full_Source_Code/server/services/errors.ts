/**
 * Error Handling Service
 * Feature 12: Error Handling & Cancellation
 * 
 * Provides user-friendly error handling for scan operations.
 * Maps technical errors to actionable user messages.
 */

/**
 * Custom error class for scan operations
 */
export class ScanError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

/**
 * Handle scan errors and convert to user-friendly messages
 */
export function handleScanError(error: any): ScanError {
  const errorMessage = error?.message || String(error);
  const errorString = errorMessage.toLowerCase();

  // Authentication/Authorization Errors
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    return new ScanError(
      errorMessage,
      'ACCESS_DENIED',
      'Authentication failed. Please check your credentials and try again.',
      true
    );
  }

  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return new ScanError(
      errorMessage,
      'ACCESS_DENIED',
      'Access denied. Please check your permissions and authentication token.',
      true
    );
  }

  // Network Errors
  if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
    return new ScanError(
      errorMessage,
      'NETWORK_ERROR',
      'Unable to reach the target. Please check the URL and your internet connection.',
      true
    );
  }

  if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
    return new ScanError(
      errorMessage,
      'TIMEOUT_ERROR',
      'Request timed out. The target may be slow or unreachable. Please try again.',
      true
    );
  }

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
    return new ScanError(
      errorMessage,
      'CONNECTION_ERROR',
      'Connection refused. The target may be down or not accepting connections.',
      true
    );
  }

  // Repository/Code Errors (MVP)
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return new ScanError(
      errorMessage,
      'NOT_FOUND',
      'Repository or resource not found. Please check the URL and ensure it exists.',
      false
    );
  }

  if (errorMessage.includes('git') && errorMessage.includes('clone')) {
    return new ScanError(
      errorMessage,
      'GIT_ERROR',
      'Failed to clone repository. Please check the repository URL and access permissions.',
      true
    );
  }

  // Web App Errors
  if (errorMessage.includes('SSL') || errorMessage.includes('certificate')) {
    return new ScanError(
      errorMessage,
      'SSL_ERROR',
      'SSL certificate error. The website may have certificate issues or use self-signed certificates.',
      false
    );
  }

  if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
    return new ScanError(
      errorMessage,
      'CORS_ERROR',
      'CORS policy blocked the request. The website may not allow scanning from this origin.',
      false
    );
  }

  // Mobile App Errors
  if (errorMessage.includes('invalid file') || errorMessage.includes('not a valid')) {
    return new ScanError(
      errorMessage,
      'INVALID_FILE',
      'Invalid file format. Please ensure you\'re providing a valid APK (Android) or IPA (iOS) file.',
      false
    );
  }

  if (errorMessage.includes('extract') || errorMessage.includes('unzip')) {
    return new ScanError(
      errorMessage,
      'EXTRACTION_ERROR',
      'Failed to extract app archive. The file may be corrupted or in an unsupported format.',
      false
    );
  }

  // Cancellation Errors
  if (errorMessage.includes('cancellation requested') || errorMessage.includes('cancel')) {
    return new ScanError(
      errorMessage,
      'CANCELLED',
      'Scan was cancelled by user.',
      false
    );
  }

  // Rate Limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return new ScanError(
      errorMessage,
      'RATE_LIMIT',
      'Rate limit exceeded. Please wait a few minutes before trying again.',
      true
    );
  }

  // File System Errors
  if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
    return new ScanError(
      errorMessage,
      'FILE_NOT_FOUND',
      'Required file not found. The scan may have encountered missing files.',
      false
    );
  }

  if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
    return new ScanError(
      errorMessage,
      'PERMISSION_ERROR',
      'Permission denied. Please check file permissions and try again.',
      false
    );
  }

  // Generic Error
  return new ScanError(
    errorMessage,
    'UNKNOWN_ERROR',
    'An unexpected error occurred. Please try again or contact support if the issue persists.',
    true
  );
}

/**
 * Format error for logging (includes full details)
 */
export function formatErrorForLogging(error: any): string {
  if (error instanceof ScanError) {
    return `[${error.code}] ${error.message} - User: ${error.userMessage}`;
  }
  return `Error: ${error?.message || String(error)}`;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof ScanError) {
    return error.retryable;
  }
  // Default to retryable for unknown errors
  return true;
}
