import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EstadoPlano } from "@/lib/engine";

type Plano = {
  id: string;
  nome: string;
  atualizado_em: string;
};

export function PlanosBar({
  S, planoId, planoNome, dirty,
  onCarregar, onNovoPlano, onSalvo,
}: {
  S: EstadoPlano;
  planoId: string | null;
  planoNome: string | null;
  dirty: boolean;
  onCarregar: (id: string, nome: string, estado: EstadoPlano) => void;
  onNovoPlano: () => void;
  onSalvo: (id: string, nome: string) => void;
}) {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [dlgSalvarComo, setDlgSalvarComo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregandoLista(true);
    const { data, error } = await supabase
      .from("planos_ses")
      .select("id, nome, atualizado_em")
      .order("atualizado_em", { ascending: false });
    setCarregandoLista(false);
    if (error) {
      toast.error("Erro ao carregar planos: " + error.message);
      return;
    }
    setPlanos(data ?? []);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  async function salvarComo() {
    const nome = nomeNovo.trim();
    if (!nome) { toast.error("Informe um nome."); return; }
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("planos_ses")
      .insert({ nome, estado: S as never, user_id: u.user!.id })
      .select("id, nome")
      .single();
    setSalvando(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(`Plano "${data.nome}" salvo.`);
    setDlgSalvarComo(false);
    setNomeNovo("");
    onSalvo(data.id, data.nome);
    recarregar();
  }

  async function salvar() {
    if (!planoId) { setDlgSalvarComo(true); return; }
    setSalvando(true);
    const { error } = await supabase
      .from("planos_ses")
      .update({ estado: S as never, atualizado_em: new Date().toISOString() })
      .eq("id", planoId);
    setSalvando(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Plano atualizado.");
    onSalvo(planoId, planoNome ?? "");
    recarregar();
  }

  async function carregar(id: string, nome: string) {
    const { data, error } = await supabase
      .from("planos_ses")
      .select("estado")
      .eq("id", id)
      .single();
    if (error || !data) { toast.error("Erro ao carregar: " + (error?.message ?? "")); return; }
    onCarregar(id, nome, data.estado as unknown as EstadoPlano);
    toast.success(`Plano "${nome}" carregado.`);
  }

  async function confirmarExcluir() {
    if (!excluirId) return;
    const id = excluirId;
    setExcluirId(null);
    const { error } = await supabase.from("planos_ses").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Plano excluído.");
    if (id === planoId) onNovoPlano();
    recarregar();
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const excluindoPlano = planos.find((p) => p.id === excluirId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 min-w-0 pr-1">
        <span className="text-[10px] uppercase tracking-wide text-white/60 hidden sm:inline">Plano</span>
        <span className={cn(
          "text-xs sm:text-sm font-medium truncate max-w-[160px] sm:max-w-[240px]",
          planoNome ? "text-white" : "text-white/60 italic",
        )}>
          {planoNome ?? "sem título"}
        </span>
        {dirty && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
            não salvo
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Button size="sm" variant="secondary" className="h-8"
          onClick={salvar} disabled={salvando || (!dirty && !!planoId)}>
          Salvar
        </Button>
        <Button size="sm" variant="secondary" className="h-8"
          onClick={() => { setNomeNovo(planoNome ? `${planoNome} (cópia)` : ""); setDlgSalvarComo(true); }}
          disabled={salvando}>
          Salvar como…
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="h-8">Meus planos ▾</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-auto">
            <DropdownMenuLabel>Planos salvos</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onNovoPlano}>
              + Novo plano (base)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {carregandoLista && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Carregando…</div>
            )}
            {!carregandoLista && planos.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum plano salvo.</div>
            )}
            {planos.map((p) => (
              <div key={p.id} className={cn(
                "flex items-center gap-1 px-2 py-1 rounded",
                p.id === planoId && "bg-muted",
              )}>
                <button
                  className="flex-1 text-left text-sm min-w-0"
                  onClick={() => carregar(p.id, p.nome)}
                >
                  <div className="truncate font-medium">{p.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(p.atualizado_em).toLocaleString("pt-BR")}
                  </div>
                </button>
                <button
                  className="text-xs text-[#b23a4c] hover:underline px-1.5"
                  onClick={() => setExcluirId(p.id)}
                  aria-label={`Excluir ${p.nome}`}
                >
                  excluir
                </button>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="ghost" className="h-8 text-white/80 hover:text-white hover:bg-white/10"
          onClick={sair}>
          Sair
        </Button>
      </div>

      <Dialog open={dlgSalvarComo} onOpenChange={setDlgSalvarComo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar plano como…</DialogTitle>
            <DialogDescription>Dê um nome para este plano. Você poderá carregá-lo depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nome-plano">Nome</Label>
            <Input id="nome-plano" value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="ex.: Cenário conservador"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") salvarComo(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgSalvarComo(false)}>Cancelar</Button>
            <Button onClick={salvarComo} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano <strong>{excluindoPlano?.nome}</strong> será removido definitivamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-[#b23a4c] hover:bg-[#912e3d]">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
