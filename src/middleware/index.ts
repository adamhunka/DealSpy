import type { MiddlewareHandler } from "astro";

import { supabaseClient } from "../db/supabase.client.ts";
import { checkAdminAccess } from "../lib/helpers/auth.helper.ts";

export const onRequest: MiddlewareHandler = async (context, next) => {
  context.locals.supabase = supabaseClient;

  // Sprawdź czy ścieżka wymaga autoryzacji admina
  const path = context.url.pathname;
  const isAdminRoute = path.startsWith("/admin");
  const isLoginPage = path === "/admin/login";

  // Jeśli to route admina (ale nie strona logowania), sprawdź autoryzację
  if (isAdminRoute && !isLoginPage) {
    const { isAdmin } = await checkAdminAccess(context.locals.supabase);

    if (!isAdmin) {
      // Zapisz docelowy URL do przekierowania po logowaniu
      const redirectUrl = encodeURIComponent(path);
      return context.redirect(`/admin/login?redirect=${redirectUrl}`);
    }
  }

  return next();
};
