// Mapeo de rol → página de inicio (landing) tras iniciar sesión.
// El Dashboard Operativo es exclusivo de dirección (dueño / super admin).

export const ROLES_DIRECCION = ["dueno", "super_admin"] as const;

export function esDireccion(rol: string | null | undefined): boolean {
  return !!rol && (ROLES_DIRECCION as readonly string[]).includes(rol);
}

export function landingPathForRole(rol: string | null | undefined): string {
  switch (rol) {
    case "personal_logistica":
      return "/inicio";
    case "jefe_logistica":
      return "/pedidos";
    case "preanalitica":
      return "/preanalitica";
    case "cobranzas":
      return "/cobranzas";
    case "dueno":
    case "super_admin":
      return "/dashboard";
    default:
      return "/login";
  }
}
