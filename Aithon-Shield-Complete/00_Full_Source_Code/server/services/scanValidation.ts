/**
 * Scan Validation Service
 * 
 * Provides validation functions for all scan types to catch invalid inputs
 * before starting scans, providing clear error messages to users.
 */

/**
 * Validate MVP Code Scan repository URL
 */
export function validateMvpRepositoryUrl(repositoryUrl: string): { valid: boolean; error?: string } {
  if (!repositoryUrl || typeof repositoryUrl !== 'string') {
    return { valid: false, error: 'Repository URL is required and must be a valid string.' };
  }

  // Check if URL starts with http:// or https://
  if (!/^https?:\/\//.test(repositoryUrl)) {
    return {
      valid: false,
      error: 'Repository URL must be a valid URL starting with http:// or https://. Example: https://github.com/user/repo'
    };
  }

  // Check if it's a valid Git repository URL format
  // Supports GitHub, GitLab, Bitbucket, and other git URLs
  const gitUrlPattern = /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|.*\/.*\.git|.*\/.*\/.*)/;
  if (!gitUrlPattern.test(repositoryUrl)) {
    return {
      valid: false,
      error: 'Repository URL must be a valid Git repository URL. Examples:\n' +
             '  • https://github.com/username/repository\n' +
             '  • https://gitlab.com/username/repository\n' +
             '  • https://bitbucket.org/username/repository'
    };
  }

  // Additional check: ensure it has at least user/repo structure
  try {
    const url = new URL(repositoryUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) {
      return {
        valid: false,
        error: 'Repository URL must include both username and repository name. Example: https://github.com/username/repo'
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Repository URL is not a valid URL format.'
    };
  }

  return { valid: true };
}

/**
 * Validate Web App Scan URL
 */
export function validateWebAppUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Application URL is required and must be a valid string.' };
  }

  // Check if URL starts with http:// or https://
  if (!/^https?:\/\//.test(url)) {
    return {
      valid: false,
      error: 'Application URL must be a valid URL starting with http:// or https://. Example: https://example.com'
    };
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname) {
      return {
        valid: false,
        error: 'Application URL must include a valid hostname. Example: https://example.com'
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Application URL is not a valid URL format. Example: https://example.com'
    };
  }

  return { valid: true };
}

/**
 * Validate Web App authentication configuration
 */
export function validateWebAppAuth(
  authRequired: boolean,
  authType?: string | null,
  authUsername?: string | null,
  authPassword?: string | null,
  authApiKey?: string | null,
  authLoginUrl?: string | null
): { valid: boolean; error?: string } {
  if (!authRequired) {
    return { valid: true };
  }

  if (!authType) {
    return {
      valid: false,
      error: 'Authentication type is required when authentication is enabled. Please select Basic, Form, or API Key authentication.'
    };
  }

  if (authType === 'basic') {
    if (!authUsername || !authPassword) {
      return {
        valid: false,
        error: 'Username and password are required for Basic authentication.'
      };
    }
  } else if (authType === 'form') {
    if (!authLoginUrl) {
      return {
        valid: false,
        error: 'Login URL is required for Form-based authentication.'
      };
    }
    // Validate login URL
    const loginUrlValidation = validateWebAppUrl(authLoginUrl);
    if (!loginUrlValidation.valid) {
      return {
        valid: false,
        error: `Login URL is invalid: ${loginUrlValidation.error}`
      };
    }
    if (!authUsername || !authPassword) {
      return {
        valid: false,
        error: 'Username and password are required for Form-based authentication.'
      };
    }
  } else if (authType === 'api-key') {
    if (!authApiKey) {
      return {
        valid: false,
        error: 'API Key is required for API Key authentication.'
      };
    }
  }

  return { valid: true };
}

/**
 * Validate Mobile App Scan configuration
 */
export function validateMobileAppScan(
  platform: string,
  appId: string,
  appUrl?: string | null
): { valid: boolean; error?: string } {
  if (!platform || (platform !== 'ios' && platform !== 'android')) {
    return {
      valid: false,
      error: 'Platform must be either "ios" or "android".'
    };
  }

  if (!appId || typeof appId !== 'string' || appId.trim().length === 0) {
    return {
      valid: false,
      error: 'App Store URL or Bundle ID is required.'
    };
  }

  // If appId looks like a URL, validate it
  if (/^https?:\/\//.test(appId)) {
    const urlValidation = validateWebAppUrl(appId);
    if (!urlValidation.valid) {
      return {
        valid: false,
        error: `App Store URL is invalid: ${urlValidation.error}`
      };
    }

    // Check if it's a valid App Store URL
    if (platform === 'ios') {
      if (!appId.includes('apps.apple.com') && !appId.includes('itunes.apple.com')) {
        return {
          valid: false,
          error: 'iOS App Store URL must be from apps.apple.com or itunes.apple.com. Example: https://apps.apple.com/app/id123456789'
        };
      }
    } else if (platform === 'android') {
      if (!appId.includes('play.google.com')) {
        return {
          valid: false,
          error: 'Android App Store URL must be from play.google.com. Example: https://play.google.com/store/apps/details?id=com.example.app'
        };
      }
    }
  } else {
    // Validate Bundle ID / Package Name format
    if (platform === 'ios') {
      // iOS Bundle ID format: com.company.app (reverse domain notation)
      const bundleIdPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+(\.[a-zA-Z0-9.-]+)*$/;
      if (!bundleIdPattern.test(appId)) {
        return {
          valid: false,
          error: 'iOS Bundle ID must be in reverse domain notation (e.g., com.company.app).'
        };
      }
    } else if (platform === 'android') {
      // Android Package Name format: com.company.app (same as iOS Bundle ID)
      const packagePattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+(\.[a-zA-Z0-9.-]+)*$/;
      if (!packagePattern.test(appId)) {
        return {
          valid: false,
          error: 'Android Package Name must be in reverse domain notation (e.g., com.company.app).'
        };
      }
    }
  }

  // If appUrl is provided, validate it
  if (appUrl) {
    const urlValidation = validateWebAppUrl(appUrl);
    if (!urlValidation.valid) {
      return {
        valid: false,
        error: `App download URL is invalid: ${urlValidation.error}`
      };
    }
  }

  return { valid: true };
}

/**
 * Validate all scan inputs before starting scan
 */
export function validateScanBeforeStart(
  scanType: 'mvp' | 'web' | 'mobile',
  scanData: any
): { valid: boolean; error?: string } {
  if (scanType === 'mvp') {
    if (!scanData.repositoryUrl) {
      return { valid: false, error: 'Repository URL is required for MVP code scans.' };
    }
    return validateMvpRepositoryUrl(scanData.repositoryUrl);
  } else if (scanType === 'web') {
    if (!scanData.url) {
      return { valid: false, error: 'Application URL is required for web app scans.' };
    }
    const urlValidation = validateWebAppUrl(scanData.url);
    if (!urlValidation.valid) {
      return urlValidation;
    }
    // Validate auth if required
    return validateWebAppAuth(
      scanData.authRequired || false,
      scanData.authType,
      scanData.authUsername,
      scanData.authPassword,
      scanData.authApiKey,
      scanData.authLoginUrl
    );
  } else if (scanType === 'mobile') {
    if (!scanData.platform || !scanData.appId) {
      return { valid: false, error: 'Platform and App ID are required for mobile app scans.' };
    }
    return validateMobileAppScan(scanData.platform, scanData.appId, scanData.appUrl);
  }

  return { valid: false, error: `Unknown scan type: ${scanType}` };
}
