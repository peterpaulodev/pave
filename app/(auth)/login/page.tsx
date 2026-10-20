"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false);

  async function handleGoogleSignIn() {
    setSigningInWithGoogle(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
    if (error) {
      setSigningInWithGoogle(false);
      toast.error("Não foi possível continuar com o Google. Tente novamente.");
    }
    // On success the browser navigates away to the OAuth provider, so there
    // is no "success" state to handle here.
  }

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    setSendingLink(true);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/",
    });
    setSendingLink(false);

    if (error) {
      toast.error("Não foi possível enviar o link. Tente novamente.");
      return;
    }
    setLinkSent(true);
  }

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar no Pave</CardTitle>
          <CardDescription>
            Controle seus gastos com o método 50/30/20.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            type="button"
            className="min-h-11 w-full"
            onClick={handleGoogleSignIn}
            disabled={signingInWithGoogle}
          >
            {signingInWithGoogle ? "Redirecionando…" : "Continuar com Google"}
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>

          {linkSent ? (
            <p className="text-sm text-muted-foreground">
              Enviamos um link de acesso para <strong>{email}</strong>.
              Confira sua caixa de entrada.
            </p>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className="min-h-11"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <Button
                type="submit"
                variant="outline"
                className="min-h-11 w-full"
                disabled={sendingLink}
              >
                {sendingLink ? "Enviando…" : "Enviar link por e-mail"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
