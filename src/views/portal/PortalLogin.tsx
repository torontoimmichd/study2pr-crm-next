"use client";

/**
 * PortalLogin.tsx
 * Client-facing login page (passwordless OTP via email).
 * Accessible at /portal/login — completely separate from staff login.
 */

import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Crown, Mail, KeyRound, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";

type Step = "email" | "otp";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false }, // only existing users may log in
    });
    setBusy(false);
    if (error) {
      // "User not found" — we show a friendly message instead of exposing the detail
      if (error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("invalid")) {
        toast.error("No portal account found for this email. Please contact your advisor.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Check your email — a 6-digit code has been sent.");
    setStep("otp");
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid or expired code. Try again or request a new one.");
      return;
    }
    // After login, redirect to portal dashboard
    navigate("/portal/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gold shadow-lg mb-4">
            <Crown className="h-7 w-7 text-gold-foreground" />
          </div>
          <h1 className="font-display text-3xl text-navy">Study2PR</h1>
          <p className="text-muted-foreground mt-1 text-sm">Client Portal</p>
        </div>

        <div className="card-surface p-8 space-y-6">
          {step === "email" ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-display text-xl text-navy">Sign in to your portal</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the email address your advisor has on file. We'll send you a one-time code.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="portal-email">Your email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="portal-email"
                    type="email"
                    className="pl-9"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                {busy ? "Sending…" : <>Send code <ArrowRight className="h-4 w-4 ml-1.5" /></>}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-display text-xl text-navy">Enter your code</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="portal-otp">6-digit code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="portal-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="pl-9 text-center tracking-[0.3em] text-lg font-mono"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button type="submit" disabled={busy || otp.length < 6} className="w-full bg-primary hover:bg-primary/90">
                {busy ? "Verifying…" : <>Sign in <ArrowRight className="h-4 w-4 ml-1.5" /></>}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Having trouble? Contact your advisor directly.
        </p>
      </div>
    </div>
  );
}
