"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "../lib/supabase";

function getRedirectUrl(nextPath = "/") {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const startGoogle = async () => {
    if (!supabase) {
      setStatus("Supabase auth is not configured yet.");
      return;
    }

    setLoading(true);
    setStatus("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl("/"),
      },
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
    }
  };

  const sendMagicLink = async (event) => {
    event.preventDefault();

    if (!supabase) {
      setStatus("Supabase auth is not configured yet.");
      return;
    }

    setLoading(true);
    setStatus("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getRedirectUrl("/"),
      },
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setStatus("Check your email for the sign-in link.");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,76,150,0.32),_transparent_30%),linear-gradient(180deg,_#08111d_0%,_#0d1725_52%,_#081019_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-[#15467d] bg-[#0a1420]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white">
              <Image
                src="/cleanstep-logo-system.png"
                alt="Cleanstep logo"
                width={80}
                height={80}
                className="h-20 w-20 object-contain p-1"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#8cc4ff]">Cleanstep account</p>
              <h1 className="mt-2 text-3xl font-semibold">Fast sign-in, no hard signup</h1>
            </div>
          </div>

          <p className="mt-5 text-sm text-white/65">
            Continue with Google or enter your email and we will send you a sign-in link. When you
            click the link, you come straight back into the web app signed in.
          </p>

          <button
            onClick={startGoogle}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-[#0f4e93] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#145cae] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
          >
            Continue with Google
          </button>

          <form onSubmit={sendMagicLink} className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5">
            <label className="text-xs uppercase tracking-[0.22em] text-white/45">Email sign-in link</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-base text-white outline-none placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="mt-4 w-full rounded-2xl bg-[#d42828] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#b81f1f] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
            >
              Send Sign-In Link
            </button>
          </form>

          {status && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
              {status}
            </div>
          )}

          <Link href="/" className="mt-6 inline-flex text-sm text-[#8cc4ff]">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
