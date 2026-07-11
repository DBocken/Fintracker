import { createClient } from '@supabase/supabase-js';

// Der anon/publishable Key ist PUBLIC BY DESIGN: Er landet ohnehin im JS-Bundle;
// Zugriffsschutz erzwingt ausschließlich Supabase Row Level Security serverseitig.
// Env-first, damit Preview-/Fremd-Deployments ohne Codeänderung eine andere
// Instanz nutzen können und der Key rotierbar bleibt; der Fallback hält lokale
// Builds & Tests ohne .env lauffähig. NIE einen Service-Role-Key eintragen —
// der Wächter-Test src/security/supabase-env.security.test.ts prüft das.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://pbopyawkxxrluhofjtub.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib3B5YXdreHhybHVob2ZqdHViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTAyNjUsImV4cCI6MjA3OTU4NjI2NX0.ilTTqmu5CQUDeYxRWUmXcKUIolnFdgUGOtyrzg5sqNM";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
