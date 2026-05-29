import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con privilegios de administración (service role key).
 * SOLO debe usarse en el servidor (route handlers / server actions).
 * NUNCA importar esto desde un componente cliente: expondría la clave maestra.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL en el entorno"
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
