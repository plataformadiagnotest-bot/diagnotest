import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { landingPathForRole } from "@/lib/utils/roles";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  redirect(landingPathForRole(profile?.rol));
}
