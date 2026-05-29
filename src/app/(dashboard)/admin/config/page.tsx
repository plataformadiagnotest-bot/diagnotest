import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { UsuariosManager, type UsuarioRow } from "@/components/admin/UsuariosManager";

export default async function ConfigPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (me?.rol !== "super_admin") redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nombre, email, rol, activo")
    .order("nombre");

  return (
    <div>
      <Topbar title="Configuración" />
      <div className="p-6">
        <UsuariosManager usuarios={(profiles ?? []) as UsuarioRow[]} />
      </div>
    </div>
  );
}
