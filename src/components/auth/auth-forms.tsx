"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction, type AuthFormState } from "@/app/(auth)/actions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bn } from "@/lib/i18n/bn";
import { PRIVACY_PATH, TERMS_PATH } from "@/lib/legal/content";

const IDLE: AuthFormState = { status: "idle" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-destructive">
      {message}
    </p>
  );
}

function withNext(path: string, next: string): string {
  return next === "/account" ? path : `${path}?next=${encodeURIComponent(next)}`;
}

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, IDLE);
  const message = state.message ?? (state.status === "idle" ? initialError : undefined);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {message ? (
        <Alert variant="error" role="alert">
          {message}
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="login-email">{bn.auth.email}</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          defaultValue={state.values?.email}
          aria-invalid={state.errors?.email ? true : undefined}
          aria-describedby={state.errors?.email ? "login-email-error" : undefined}
          className="mt-1.5"
        />
        <FieldError id="login-email-error" message={state.errors?.email} />
      </div>

      <div>
        <Label htmlFor="login-password">{bn.auth.password}</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.errors?.password ? true : undefined}
          aria-describedby={state.errors?.password ? "login-password-error" : undefined}
          className="mt-1.5"
        />
        <FieldError id="login-password-error" message={state.errors?.password} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? bn.auth.loginPending : bn.auth.loginButton}
      </Button>

      <p className="text-sm text-slate">
        {bn.auth.noAccount}{" "}
        <Link href={withNext("/signup", next)} className="font-bold text-primary underline underline-offset-4">
          {bn.auth.signupButton}
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signupAction, IDLE);

  if (state.status === "check_email") {
    return (
      <Alert variant="success" role="status">
        <AlertTitle>{bn.auth.checkEmailTitle}</AlertTitle>
        <p className="mt-1">{bn.auth.checkEmail}</p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.message ? (
        <Alert variant="error" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="signup-name">{bn.auth.name}</Label>
        <Input
          id="signup-name"
          name="displayName"
          type="text"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={state.values?.displayName}
          aria-invalid={state.errors?.displayName ? true : undefined}
          aria-describedby={state.errors?.displayName ? "signup-name-error" : undefined}
          className="mt-1.5"
        />
        <FieldError id="signup-name-error" message={state.errors?.displayName} />
      </div>

      <div>
        <Label htmlFor="signup-email">{bn.auth.email}</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          defaultValue={state.values?.email}
          aria-invalid={state.errors?.email ? true : undefined}
          aria-describedby={state.errors?.email ? "signup-email-error" : undefined}
          className="mt-1.5"
        />
        <FieldError id="signup-email-error" message={state.errors?.email} />
      </div>

      <div>
        <Label htmlFor="signup-password">{bn.auth.password}</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          aria-invalid={state.errors?.password ? true : undefined}
          aria-describedby={state.errors?.password ? "signup-password-error" : "signup-password-hint"}
          className="mt-1.5"
        />
        {state.errors?.password ? (
          <FieldError id="signup-password-error" message={state.errors.password} />
        ) : (
          <p id="signup-password-hint" className="mt-1.5 text-sm text-slate">
            {bn.auth.passwordHint}
          </p>
        )}
      </div>

      <p className="text-sm text-slate">
        {bn.legal.signupAgree.before}{" "}
        <Link href={TERMS_PATH} target="_blank" className="font-bold text-primary underline underline-offset-4">
          {bn.legal.termsLink}
          <span className="sr-only"> {bn.legal.opensNewTab}</span>
        </Link>{" "}
        {bn.legal.signupAgree.and}{" "}
        <Link href={PRIVACY_PATH} target="_blank" className="font-bold text-primary underline underline-offset-4">
          {bn.legal.privacyLink}
          <span className="sr-only"> {bn.legal.opensNewTab}</span>
        </Link>{" "}
        {bn.legal.signupAgree.after}
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? bn.auth.signupPending : bn.auth.signupButton}
      </Button>

      <p className="text-sm text-slate">
        {bn.auth.haveAccount}{" "}
        <Link href={withNext("/login", next)} className="font-bold text-primary underline underline-offset-4">
          {bn.auth.loginButton}
        </Link>
      </p>
    </form>
  );
}
