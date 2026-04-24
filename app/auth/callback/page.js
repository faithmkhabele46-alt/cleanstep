"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    async function finishAuth() {
      if (!supabase) {
        setMessage("Supabase auth is not configured yet.");
        return;
      }

      const code = params.get("code");
      const nextPath = params.get("next") || "/";

      if (!code) {
        setMessage("No sign-in code was found.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace(nextPath);
    }

    finishAuth();
  }, [params, router]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,76,150,0.32),_transparent_30%),linear-gradient(180deg,_#08111d_0%,_#0d1725_52%,_#081019_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-[#15467d] bg-[#0a1420]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mb-5 overflow-hidden rounded-3xl border border-white/10 bg-white w-fit">
            <Image
              src="/cleanstep-logo-system.png"
              alt="Cleanstep logo"
              width={84}
              height={84}
              className="h-20 w-20 object-contain p-1"
            />
          </div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#8cc4ff]">Cleanstep account</p>
          <h1 className="mt-3 text-3xl font-semibold">Finishing sign-in</h1>
          <p className="mt-4 text-sm text-white/65">{message}</p>
        </div>
      </div>
    </main>
  );
}
