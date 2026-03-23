/**
 * OAuth/OIDC Client Implementation
 * Handles modern SSO via OpenID Connect protocol (Azure AD, Okta OIDC, etc.)
 * Using openid-client v6 API with security enhancements
 */

import * as oidc from "openid-client";
import type { SsoProvider } from "@shared/schema";

const isDevelopment = process.env.NODE_ENV === 'development';

function getInsecureRequestsOptions() {
  if (isDevelopment) {
    return { [oidc.allowInsecureRequests]: true };
  }
  return {};
}

export interface OidcUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}

const configCache = new Map<string, any>();

// Clear cache for a specific provider (useful when config changes)
export function clearOidcConfigCache(providerId?: string) {
  if (providerId) {
    configCache.delete(providerId);
    console.log(`[OIDC] Cleared config cache for provider: ${providerId}`);
  } else {
    configCache.clear();
    console.log('[OIDC] Cleared all config cache');
  }
}

interface VerifierData {
  verifier: string;
  nonce: string;
  createdAt: number;
  providerId: string;
}

const verifierStore = new Map<string, VerifierData>();

const VERIFIER_TTL = 10 * 60 * 1000;

function cleanupExpiredVerifiers() {
  const now = Date.now();
  for (const [state, data] of verifierStore.entries()) {
    if (now - data.createdAt > VERIFIER_TTL) {
      verifierStore.delete(state);
    }
  }
}

setInterval(cleanupExpiredVerifiers, 60 * 1000);

/**
 * Get or create OIDC configuration for a provider
 */
async function getOidcConfig(provider: SsoProvider) {
  if (provider.type !== 'oidc') {
    throw new Error('Provider must be of type OIDC');
  }

  if (!provider.oidcIssuer || !provider.oidcClientId) {
    throw new Error('Missing required OIDC configuration');
  }

  const cacheKey = provider.id;
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey);
  }

  try {
    const issuerUrl = new URL(provider.oidcIssuer);
    
    const config = await oidc.discovery(
      issuerUrl,
      provider.oidcClientId,
      provider.oidcClientSecret || undefined,
      undefined,
      getInsecureRequestsOptions()
    );

    configCache.set(cacheKey, config);
    return config;
  } catch (error) {
    console.error("OIDC discovery failed:", error);
    throw new Error(`Failed to discover OIDC configuration: ${error}`);
  }
}

/**
 * Generate authorization URL for OIDC flow
 */
export async function getAuthorizationUrl(provider: SsoProvider, state: string): Promise<string> {
  // Clear cache for test provider to ensure fresh config
  if (provider.id === 'test-oidc-provider') {
    configCache.delete(provider.id);
  }
  
  const config = await getOidcConfig(provider);
  
  // Build callback URL - REPLIT_DEV_DOMAIN already includes https:// prefix
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? (process.env.REPLIT_DEV_DOMAIN.startsWith('http') ? process.env.REPLIT_DEV_DOMAIN : `https://${process.env.REPLIT_DEV_DOMAIN}`)
    : 'http://localhost:5000';
  const callbackUrl = provider.oidcCallbackUrl || `${baseUrl}/api/sso/oidc/callback/${provider.id}`;
  
  console.log(`[OIDC] Generating auth URL for provider ${provider.id}:`);
  console.log(`[OIDC]   Base URL: ${baseUrl}`);
  console.log(`[OIDC]   Callback URL: ${callbackUrl}`);

  const code_verifier = oidc.randomPKCECodeVerifier();
  const code_challenge = await oidc.calculatePKCECodeChallenge(code_verifier);
  const nonce = oidc.randomNonce();
  
  verifierStore.set(state, {
    verifier: code_verifier,
    nonce,
    createdAt: Date.now(),
    providerId: provider.id,
  });

  const scopes = provider.oidcScopes || ['openid', 'profile', 'email'];

  const authUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: scopes.join(' '),
    state,
    code_challenge,
    code_challenge_method: 'S256',
    nonce,
  });

  return authUrl.href;
}

/**
 * Handle OIDC callback and exchange code for tokens
 */
export async function handleOidcCallback(
  provider: SsoProvider,
  callbackParams: any,
  state: string
): Promise<OidcUser> {
  const config = await getOidcConfig(provider);

  const verifierData = verifierStore.get(state);
  if (!verifierData) {
    throw new Error('Invalid or expired authentication request');
  }

  if (Date.now() - verifierData.createdAt > VERIFIER_TTL) {
    verifierStore.delete(state);
    throw new Error('Authentication request expired');
  }

  if (verifierData.providerId !== provider.id) {
    throw new Error('Provider mismatch in authentication flow');
  }

  // Build callback URL - REPLIT_DEV_DOMAIN may or may not include https:// prefix
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? (process.env.REPLIT_DEV_DOMAIN.startsWith('http') ? process.env.REPLIT_DEV_DOMAIN : `https://${process.env.REPLIT_DEV_DOMAIN}`)
    : 'http://localhost:5000';
  const callbackUrl = provider.oidcCallbackUrl || `${baseUrl}/api/sso/oidc/callback/${provider.id}`;

  const currentUrl = new URL(callbackUrl);
  currentUrl.search = new URLSearchParams(callbackParams).toString();

  try {
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      expectedState: state,
      pkceCodeVerifier: verifierData.verifier,
      expectedNonce: verifierData.nonce,
    });

    verifierStore.delete(state);

    const claims = oidc.getValidatedIdTokenClaims(tokens);

    if (claims.iss !== provider.oidcIssuer) {
      throw new Error(`Invalid issuer in ID token: expected ${provider.oidcIssuer}, got ${claims.iss}`);
    }

    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(provider.oidcClientId)) {
      throw new Error(`Invalid audience in ID token: expected ${provider.oidcClientId}, got ${JSON.stringify(claims.aud)}`);
    }

    if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== provider.oidcClientId) {
      throw new Error(`Invalid authorized party (azp): expected ${provider.oidcClientId}, got ${claims.azp}`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      throw new Error('ID token has expired');
    }

    let userinfo: any = claims;
    
    if (tokens.access_token) {
      try {
        userinfo = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
      } catch (e) {
        console.warn('Could not fetch userinfo, using ID token claims:', e);
      }
    }

    return await processOidcUserinfo(userinfo, provider);
  } catch (error) {
    verifierStore.delete(state);
    console.error("OIDC callback error:", error);
    throw new Error(`OIDC authentication failed: ${error}`);
  }
}

/**
 * Process OIDC userinfo and extract user information
 */
async function processOidcUserinfo(userinfo: any, provider: SsoProvider): Promise<OidcUser> {
  const email = userinfo.email;
  
  if (!email) {
    throw new Error('Email not found in OIDC userinfo');
  }

  const firstName = userinfo.given_name;
  const lastName = userinfo.family_name;

  let roles: string[] = [];
  if (provider.roleAttributeName) {
    const roleAttr = userinfo[provider.roleAttributeName];
    if (roleAttr) {
      roles = Array.isArray(roleAttr) ? roleAttr : [roleAttr];
    }
  }

  const appRoles = mapRoles(roles, provider);

  return {
    id: userinfo.sub,
    email,
    firstName,
    lastName,
    roles: appRoles,
  };
}

/**
 * Map IdP roles to application roles based on provider configuration
 */
function mapRoles(idpRoles: string[], provider: SsoProvider): string[] {
  const appRoles: string[] = [];

  if (provider.adminRoleValues) {
    const hasAdminRole = idpRoles.some(role => 
      provider.adminRoleValues?.includes(role)
    );
    if (hasAdminRole) {
      appRoles.push('admin');
    }
  }

  if (provider.devRoleValues) {
    const hasDevRole = idpRoles.some(role => 
      provider.devRoleValues?.includes(role)
    );
    if (hasDevRole) {
      appRoles.push('developer');
    }
  }

  if (appRoles.length === 0) {
    appRoles.push('viewer');
  }

  return appRoles;
}

/**
 * Clear client cache (useful when provider config changes)
 */
export function clearOidcClientCache(providerId?: string) {
  if (providerId) {
    configCache.delete(providerId);
    
    for (const [state, data] of verifierStore.entries()) {
      if (data.providerId === providerId) {
        verifierStore.delete(state);
      }
    }
  } else {
    configCache.clear();
    verifierStore.clear();
  }
}
