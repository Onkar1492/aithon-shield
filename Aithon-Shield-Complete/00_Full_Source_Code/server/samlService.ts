/**
 * SAML 2.0 Service Provider Implementation
 * Handles enterprise SSO via SAML protocol (Okta, Azure AD, etc.)
 */

import { Strategy as SamlStrategy, type Profile, type VerifiedCallback } from "passport-saml";
import { storage } from "./storage";
import type { SsoProvider } from "@shared/schema";

export interface SamlUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}

/**
 * Create SAML strategy for a given provider
 */
export function createSamlStrategy(provider: SsoProvider) {
  if (provider.type !== 'saml') {
    throw new Error('Provider must be of type SAML');
  }

  if (!provider.samlEntryPoint || !provider.samlIssuer || !provider.samlCert) {
    throw new Error('Missing required SAML configuration');
  }

  const strategyOptions = {
    entryPoint: provider.samlEntryPoint,
    issuer: provider.samlEntityId || `aegis-auditor-${provider.id}`,
    callbackUrl: provider.samlCallbackUrl || `${process.env.APP_URL || 'http://localhost:5000'}/api/sso/saml/callback/${provider.id}`,
    cert: provider.samlCert,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    acceptedClockSkewMs: 5000,
    disableRequestedAuthnContext: true,
  };

  return new SamlStrategy(
    strategyOptions,
    async (profile: Profile | null | undefined, done: VerifiedCallback) => {
      try {
        if (!profile) {
          return done(new Error('No SAML profile received'));
        }
        const user = await processSamlProfile(profile, provider);
        done(null, user as any);
      } catch (error) {
        done(error as Error);
      }
    }
  );
}

/**
 * Process SAML profile and extract user information
 */
async function processSamlProfile(profile: Profile, provider: SsoProvider): Promise<SamlUser> {
  const email = profile.nameID || profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
  
  if (!email) {
    throw new Error('Email not found in SAML response');
  }

  // Extract user attributes
  const firstName = profile.givenName || profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'];
  const lastName = profile.surname || profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'];

  // Extract roles from IdP
  let roles: string[] = [];
  if (provider.roleAttributeName) {
    const roleAttr = (profile as any)[provider.roleAttributeName];
    if (roleAttr) {
      roles = Array.isArray(roleAttr) ? roleAttr : [roleAttr];
    }
  }

  // Map IdP roles to application roles
  const appRoles = mapRoles(roles, provider);

  return {
    id: email as string,
    email: email as string,
    firstName: firstName as string | undefined,
    lastName: lastName as string | undefined,
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

  // Default role if no mapping matches
  if (appRoles.length === 0) {
    appRoles.push('viewer');
  }

  return appRoles;
}

/**
 * Generate SAML metadata XML for Service Provider
 */
export function generateSamlMetadata(provider: SsoProvider): string {
  const entityId = provider.samlEntityId || `aegis-auditor-${provider.id}`;
  const acsUrl = provider.samlCallbackUrl || `${process.env.APP_URL || 'http://localhost:5000'}/api/sso/saml/callback/${provider.id}`;

  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService 
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
      Location="${acsUrl}" 
      index="0" />
  </SPSSODescriptor>
</EntityDescriptor>`;
}
