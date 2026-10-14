export type AppRole = 'farmer' | 'buyer' | 'inspector' | 'supervisor';
export function hasRole(actual: string | null | undefined, required: AppRole): boolean {
  if (!actual) return false;
  if (required === 'inspector') return actual === 'inspector' || actual === 'supervisor';
  return actual === required;
}
export function roleHome(role: AppRole, locale = 'en'): string {
  const prefix = ['en', 'hi', 'mr'].includes(locale) ? locale : 'en';
  if (role === 'farmer') return `/${prefix}/farmer/lots`;
  if (role === 'buyer') return `/${prefix}/buyer/marketplace`;
  if (role === 'supervisor') return `/${prefix}/inspector/supervisor-audit`;
  return `/${prefix}/inspector/dashboard`;
}
export function resolvePostLoginPath(role: AppRole, locale = 'en', nextPath?: string | null): string {
  const prefix = ['en', 'hi', 'mr'].includes(locale) ? locale : 'en';
  if (!nextPath || typeof nextPath !== 'string' || !nextPath.startsWith('/') || nextPath.includes('//') || nextPath.includes('\\')) {
    return roleHome(role, prefix);
  }
  const match = nextPath.match(/^\/(en|hi|mr)\/(farmer|buyer|inspector)(\/[a-zA-Z0-9/_-]*)?$/);
  if (!match) return roleHome(role, prefix);
  const section = match[2] as 'farmer' | 'buyer' | 'inspector';
  const rest = match[3] ?? '';
  const fullNormalized = `/${prefix}/${section}${rest}`;
  if (fullNormalized === `/${prefix}/inspector/supervisor-audit` || fullNormalized.startsWith(`/${prefix}/inspector/supervisor-audit/`)) {
    return role === 'supervisor' ? fullNormalized : roleHome(role, prefix);
  }
  if (fullNormalized === `/${prefix}/inspector/disputes` || fullNormalized.startsWith(`/${prefix}/inspector/disputes/`)) {
    return ['farmer', 'buyer', 'inspector', 'supervisor'].includes(role) ? fullNormalized : roleHome(role, prefix);
  }
  if (section === 'inspector') {
    return role === 'inspector' || role === 'supervisor' ? fullNormalized : roleHome(role, prefix);
  }
  return role === section ? fullNormalized : roleHome(role, prefix);
}
