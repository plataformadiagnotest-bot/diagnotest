import { revalidatePath } from "next/cache";

// Revalida la caché de las pantallas de preanalítica tras una mutación, para
// que el cambio propio se vea al instante (sin esperar el TTL de revalidate).
export function revalidarPreanalitica() {
  revalidatePath("/preanalitica");
  revalidatePath("/preanalitica/observados");
  revalidatePath("/preanalitica/controlados");
}
