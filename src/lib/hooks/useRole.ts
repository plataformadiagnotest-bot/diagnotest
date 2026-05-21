"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types";

export function useRole() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    load();
  }, []);

  const can = (...roles: UserRole[]) =>
    profile ? roles.includes(profile.rol) : false;

  const isPersonal = () => can("personal_logistica");
  const isJefe = () => can("jefe_logistica", "super_admin");
  const isAdmin = () => can("super_admin");
  const canApprove = () => can("jefe_logistica", "dueno", "super_admin");

  return { profile, loading, can, isPersonal, isJefe, isAdmin, canApprove };
}
