import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';
import { useNexusStore } from '@/application/store';
import { FULL_SUPABASE_SETUP_SQL } from '@/infrastructure/supabase/fullSetupSql';
import {
  getSupabaseConfig,
  resetSupabaseSchemaCache,
} from '@/infrastructure/supabase/supabaseClient';

interface DatabaseSetupModalProps {
  onClose: () => void;
}

export function DatabaseSetupModal({ onClose }: DatabaseSetupModalProps) {
  const { syncState, syncDiagnosisMessage, syncNowWithSupabase } = useNexusStore();
  const config = getSupabaseConfig();

  const [copiedSql, setCopiedSql] = useState(false);
  const [testingSync, setTestingSync] = useState(false);

  async function handleCopySql() {
    try {
      await navigator.clipboard.writeText(FULL_SUPABASE_SETUP_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3500);
    } catch {
      setCopiedSql(false);
    }
  }

  async function handleTestAndSync() {
    setTestingSync(true);
    resetSupabaseSchemaCache();
    await syncNowWithSupabase();
    setTestingSync(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-700 bg-nexus-black text-nexus-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-nexus-green" />
            <div>
              <h2 className="text-base font-bold">
                Conexão e Inicialização do Banco de Dados (Supabase)
              </h2>
              <p className="text-xs text-zinc-400">
                Diagnóstico de conectividade, criação de tabelas SQL e sincronização do catálogo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6 text-sm">
          {/* Status Card */}
          <div
            className={`rounded-lg border p-4 ${
              syncState === 'CLOUD_SYNCED'
                ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                : syncState === 'SCHEMA_MISSING'
                  ? 'border-amber-600/60 bg-amber-950/30 text-amber-200'
                  : 'border-zinc-700 bg-zinc-900/60 text-zinc-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {syncState === 'CLOUD_SYNCED' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-nexus-green" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {syncState === 'CLOUD_SYNCED'
                    ? 'Banco de Dados Conectado e Tabelas Sincronizadas!'
                    : syncState === 'SCHEMA_MISSING'
                      ? 'Projeto Conectado — Tabelas SQL Ainda Não Criadas no Supabase (Erro 404 PGRST205)'
                      : 'Status da Sincronização Supabase'}
                </p>
                <p className="text-xs opacity-90">
                  {syncDiagnosisMessage ??
                    'Verifique os passos abaixo para inicializar ou sincronizar seu projeto Supabase.'}
                </p>
                {config && (
                  <p className="pt-1 font-mono text-[11px] text-zinc-400">
                    Endpoint: <span className="text-zinc-200">{config.url}</span> • Projeto:{' '}
                    <span className="text-nexus-green">{config.projectRef ?? 'detectado'}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Guia Passo a Passo para Criar as Tabelas e Resolver o 404 */}
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-green">
              Como inicializar as tabelas no Supabase em 30 segundos
            </h3>
            <p className="text-xs text-zinc-300">
              Por segurança da API REST do Supabase (PostgREST), comandos{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-amber-300">CREATE TABLE</code>{' '}
              não são executados via navegador. Basta colar o script consolidado abaixo no{' '}
              <strong>SQL Editor</strong> do seu projeto:
            </p>

            <div className="grid gap-3 pt-1 sm:grid-cols-3">
              {/* Passo 1 */}
              <button
                type="button"
                onClick={() => void handleCopySql()}
                className="flex flex-col justify-between rounded-lg border border-nexus-green/50 bg-nexus-green-deep/30 p-3 text-left transition hover:bg-nexus-green-deep/50"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-nexus-green px-1.5 py-0.5 text-[10px] font-bold text-black">
                    PASSO 1
                  </span>
                  <Copy className="h-4 w-4 text-nexus-green" />
                </div>
                <div className="mt-2">
                  <p className="font-semibold text-white">
                    {copiedSql ? 'SQL Copiado! ✓' : 'Copiar SQL Completo'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-300">
                    Inclui 17 tabelas, RLS (anon + auth) e seeds (29 máquinas, 33 salas, 22 cursos)
                  </p>
                </div>
              </button>

              {/* Passo 2 */}
              <a
                href={config?.sqlEditorUrl ?? 'https://supabase.com/dashboard'}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col justify-between rounded-lg border border-zinc-700 bg-zinc-800/70 p-3 text-left transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-zinc-200">
                    PASSO 2
                  </span>
                  <ExternalLink className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="mt-2">
                  <p className="font-semibold text-white">Abrir SQL Editor</p>
                  <p className="mt-0.5 text-[11px] text-zinc-300">
                    Cole o script no painel do projeto{' '}
                    <span className="font-mono text-nexus-green">
                      {config?.projectRef ?? 'Supabase'}
                    </span>{' '}
                    e clique em <strong>Run</strong>
                  </p>
                </div>
              </a>

              {/* Passo 3 */}
              <button
                type="button"
                disabled={testingSync}
                onClick={() => void handleTestAndSync()}
                className="flex flex-col justify-between rounded-lg border border-emerald-600/50 bg-emerald-950/40 p-3 text-left transition hover:bg-emerald-900/50 disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    PASSO 3
                  </span>
                  <RefreshCw
                    className={`h-4 w-4 text-emerald-400 ${testingSync ? 'animate-spin' : ''}`}
                  />
                </div>
                <div className="mt-2">
                  <p className="font-semibold text-white">
                    {testingSync ? 'Verificando...' : 'Testar & Sincronizar'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-300">
                    Valida as tabelas criadas e sincroniza todo o catálogo em lote
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Preview do SQL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Script SQL Consolidado (<code>supabase/full_setup.sql</code>):
              </span>
              <button
                type="button"
                onClick={() => void handleCopySql()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-nexus-green hover:underline"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedSql ? 'Copiado para a área de transferência!' : 'Copiar tudo'}
              </button>
            </div>
            <pre className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300">
              {FULL_SUPABASE_SETUP_SQL}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3.5">
          <span className="text-xs text-zinc-400">
            Modo Local-First ativo: todas as operações funcionam mesmo antes da sincronização em
            nuvem.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

