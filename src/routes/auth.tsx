import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: TelaLogin,
});

function TelaLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message === "Invalid login credentials"
        ? "E-mail ou senha inválidos."
        : error.message);
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-[#f4f6f7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-md overflow-hidden border border-border bg-card shadow-sm">
        <header className="bg-[#0a4f4f] text-white px-5 py-4">
          <div className="text-[11px] uppercase tracking-widest text-white/60">SES • FGV</div>
          <div className="text-lg font-semibold leading-tight">ThermoTech SA</div>
          <div className="text-xs text-white/60">Simulador de Gestão</div>
        </header>
        <form onSubmit={entrar} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" autoComplete="current-password" required
              value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && (
            <div className="text-sm text-[#b23a4c] bg-[#fdecef] border border-[#f5c2cc] rounded px-3 py-2">
              {erro}
            </div>
          )}
          <Button type="submit" disabled={carregando} className="w-full bg-[#0a4f4f] hover:bg-[#0f6f6f]">
            {carregando ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Acesso restrito. Solicite credenciais ao administrador do curso.
          </p>
        </form>
      </div>
    </div>
  );
}
