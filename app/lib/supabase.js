import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://umgacfgggjbmpplkdmqx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey && supabaseAnonKey !== "PASTE_YOUR_ANON_KEY_HERE"
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
