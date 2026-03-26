/** Role weights: owner > admin > developer > viewer ≈ auditor */

const ROLE_WEIGHT: Record<string, number> = {
  owner: 100,
  admin: 80,
  developer: 60,
  viewer: 30,
  auditor: 30,
};

export function organizationRoleWeight(role: string | undefined): number {
  if (!role) return 0;
  return ROLE_WEIGHT[role] ?? 0;
}

/** Create/edit/delete scans and findings under an org-scoped scan */
export function organizationRoleCanWriteScans(role: string | undefined): boolean {
  return organizationRoleWeight(role) >= 60;
}
