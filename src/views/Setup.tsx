"use client";

import { useEffect, useState, FormEvent } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { Crown, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * One-time bootstrap to create the first owner.
 * Disables itself once any active staff_profiles row exists.
 */
export default function Setup() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    void (async () => {
      const { count, error } = await supabase
        .from("staff_profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) {
        toast.error("Could not verify setup state: " + error.message);
        setAllowed(false);
      } else {
        setAllowed((count ?? 0) === 0);
      }
      setChecking(false);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // 1. create auth user (no email confirmation needed if disabled in Supabase dashboard)
    const { data: signup, error: signupErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    if (signupErr) {
      setSubmitting(false);
      toast.error(signupErr.message);
      return;
    }
    const uid = signup.user?.id;
    if (!uid) {
      setSubmitting(false);
      toast.error("Sign-up returned no user. Check Supabase auth settings (disable email confirmation for setup).");
      return;
    }

    // 2. ensure session (auto in dev, may need confirm in prod)
    if (!signup.session) {
      const { error: signinErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signinErr) {
        setSubmitting(false);
        toast.error(
          "Account created but couldn't sign in automatically — likely email confirmation is on. Confirm via email then sign in.",
        );
        return;
      }
    }

    // 3. insert staff_profiles row as owner
    const { error: profileErr } = await supabase.from("staff_profiles").insert({
      id: uid,
      full_name: fullName,
      email: email.trim(),
      role: "owner",
      is_active: true,
    });
    setSubmitting(false);
    if (profileErr) {
      toast.error("Profile insert failed: " + profileErr.message);
      return;
    }

    toast.success("Owner account created — welcome to Study2PR.");
    navigate("/dashboard", { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card-surface max-w-md w-full p-6 text-center">
          <ShieldCheck className="h-8 w-8 text-success mx-auto mb-3" />
          <h2 className="font-display text-2xl text-navy mb-2">Setup already complete</h2>
          <p className="text-sm text-muted-foreground mb-4">
            An active staff member already exists. New users must be added by an owner from HR / Team.
          </p>
          <Link to="/login" className="text-accent hover:underline text-sm">
            Go to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <span className="font-display text-2xl text-navy">Study2PR</span>
          </div>
          <h1 className="font-display text-3xl text-navy">Create owner account</h1>
          <p className="text-sm text-muted-foreground mt-1">One-time setup. Disables itself after first staff member.</p>
        </div>

        <form onSubmit={onSubmit} className="card-surface p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password (min 8 chars)</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
            {submitting ? "Creating…" : "Create owner & sign in"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tip: in Supabase Auth settings, disable "Confirm email" for instant sign-in during setup.
          </p>
        </form>
      </div>
    </div>
  );
}
