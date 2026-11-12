import { useState } from 'react';
import {
  Activity,
  BookOpen,
  Building2,
  CalendarCheck2,
  Database,
  RotateCcw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useNexusStore } from '@/application/store';
import { AuditAndConcurrencyView } from './components/AuditAndConcurrencyView';
import { CoursesCatalogView } from './components/CoursesCatalogView';
import { MachineInventoryView } from './components/MachineInventoryView';
import { RoomsTopologyView } from './components/RoomsTopologyView';
import { SchedulePlannerBoard } from './components/SchedulePlannerBoard';

type TabKey = 'PLANNER' | 'INVENTORY' | 'COURSES' | 'TOPOLOGY' | 'AUDIT';

export default function App() {
  const {
    machines,
    courses,
    rooms,
    allocations,
    operators,
    currentOperatorId,
    supabaseConnected,
    syncState,
    switchOperator,
    renameOperator,
    resetToSeed,
  } = useNexusStore();

  const [activeTab, setActiveTab] = useState<TabKey>('PLANNER');
  const [editingOperator, setEditingOperator] = useState(false);
  const [operatorDraftName, setOperatorDraftName] = useState('');

  const currentOperator =
    operators.find((op) => op.id === currentOperatorId) ?? operators[0];

  const activeMachines = machines.filter((m) => m.status === 'ACTIVE').length;
  const maintenanceMachines = machines.filter((m) => m.status === 'MAINTENANCE').length;
  const loanedMachines = machines.filter((m) => m.status === 'LOANED_TEMP').length;
  const zone1Rooms = rooms.filter((r) => r.zone === 1 && r.defaultEnabled).length;

  function startRenameOperator() {
    setOperatorDraftName(currentOperator?.name ?? '');
    setEditingOperator(true);
  }

  function saveOperatorName(e: React.FormEvent) {
    e.preventDefault();
    if (currentOperator && operatorDraftName.trim()) {
      renameOperator(currentOperator.id, operatorDraftName);
    }
    setEditingOperator(false);
  }

  return (
    <div className="min-h-screen bg-nexus-off text-nexus-surface">
      {/* Cabeçalho Institucional Nexus (§7.1: Preto #09090B + Verde #10B981 + Branco #FFFFFF) */}
      <header className="border-b border-zinc-800 bg-nexus-black px-6 py-4 text-nexus-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-principal.svg"
              alt="Academia Nexus"
              className="h-9 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Escala <span className="text-nexus-green">Nexus</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Sistema Inteligente de Alocação de Ultrassom • Academia Nexus
              </p>
            </div>
          </div>

          {/* Seletor de Operador Autenticado (Tarefa 1.9) + Status de Persistência (Tarefa 3.13) */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                syncState === 'CLOUD_SYNCED'
                  ? 'border-nexus-green bg-nexus-green-deep/40 text-nexus-green'
                  : syncState === 'PENDING_SYNC'
                    ? 'border-nexus-amber bg-amber-950/50 text-amber-300'
                    : 'border-zinc-700 bg-nexus-surface text-zinc-300'
              }`}
            >
              <Database className="h-3.5 w-3.5 text-nexus-green" />
              {syncState === 'CLOUD_SYNCED' && supabaseConnected
                ? 'Sincronizado (Supabase Realtime)'
                : syncState === 'PENDING_SYNC'
                  ? 'Sincronizando na Nuvem...'
                  : 'Local-First (Offline-Ready)'}
            </span>

            <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-nexus-surface px-2.5 py-1.5 text-xs">
              <UserCheck className="h-4 w-4 text-nexus-green" />
              <span className="text-zinc-400">Operador:</span>
              {!editingOperator ? (
                <>
                  <select
                    value={currentOperator?.id}
                    onChange={(e) => switchOperator(e.target.value)}
                    className="rounded bg-nexus-black px-2 py-0.5 font-medium text-nexus-white focus:outline-none"
                  >
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={startRenameOperator}
                    className="text-zinc-400 underline hover:text-nexus-white"
                  >
                    Renomear
                  </button>
                </>
              ) : (
                <form onSubmit={saveOperatorName} className="inline-flex items-center gap-1">
                  <input
                    value={operatorDraftName}
                    onChange={(e) => setOperatorDraftName(e.target.value)}
                    className="rounded border border-zinc-700 bg-nexus-black px-2 py-0.5 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="rounded bg-nexus-green px-2 py-0.5 font-medium text-white"
                  >
                    OK
                  </button>
                </form>
              )}
            </div>

            <button
              type="button"
              onClick={resetToSeed}
              title="Restaurar dados de fábrica do Seed (29 máquinas, 33 salas, 22 cursos)"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-nexus-surface px-2.5 py-1.5 text-xs text-zinc-300 hover:border-nexus-green hover:text-nexus-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar Seed
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-6">
        {/* Cards de Métricas do Topo (§7.1: Grafite Carbono #18181B) */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-nexus-surface p-4 text-nexus-white">
            <span className="text-xs uppercase text-zinc-400">Parque Ativo no Turno</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-nexus-green">
                {activeMachines + loanedMachines}
              </span>
              <span className="text-xs text-zinc-400">
                de {machines.length} máquinas ({loanedMachines} demo)
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-nexus-surface p-4 text-nexus-white">
            <span className="text-xs uppercase text-zinc-400">Em Manutenção</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  maintenanceMachines > 0 ? 'text-nexus-red' : 'text-zinc-200'
                }`}
              >
                {maintenanceMachines}
              </span>
              <span className="text-xs text-zinc-400">bloqueadas pelo motor e banco</span>
            </div>
          </div>

          <div className="rounded-lg bg-nexus-surface p-4 text-nexus-white">
            <span className="text-xs uppercase text-zinc-400">Consultórios & Laudo</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-nexus-white">{rooms.length}</span>
              <span className="text-xs text-nexus-green">{zone1Rooms} na Zona 1 (Laudo)</span>
            </div>
          </div>

          <div className="rounded-lg bg-nexus-surface p-4 text-nexus-white">
            <span className="text-xs uppercase text-zinc-400">Escala Semanal Ativa</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-nexus-white">{allocations.length}</span>
              <span className="text-xs text-zinc-400">
                alocações • {courses.length} cursos no catálogo
              </span>
            </div>
          </div>
        </section>

        {/* Navegação de Abas */}
        <nav className="flex flex-wrap gap-2 border-b border-nexus-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('PLANNER')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === 'PLANNER'
                ? 'bg-nexus-black text-nexus-white'
                : 'bg-nexus-white text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <CalendarCheck2 className="h-4 w-4 text-nexus-green" />
            1. Planejador & Grade da Escala
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INVENTORY')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === 'INVENTORY'
                ? 'bg-nexus-black text-nexus-white'
                : 'bg-nexus-white text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <Activity className="h-4 w-4 text-nexus-green" />
            2. Inventário de Máquinas ({machines.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COURSES')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === 'COURSES'
                ? 'bg-nexus-black text-nexus-white'
                : 'bg-nexus-white text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <BookOpen className="h-4 w-4 text-nexus-green" />
            3. Catálogo de Cursos & Regras ({courses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TOPOLOGY')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === 'TOPOLOGY'
                ? 'bg-nexus-black text-nexus-white'
                : 'bg-nexus-white text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <Building2 className="h-4 w-4 text-nexus-green" />
            4. Consultórios & Zonas de Laudo ({rooms.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUDIT')}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === 'AUDIT'
                ? 'bg-nexus-black text-nexus-white'
                : 'bg-nexus-white text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-nexus-green" />
            5. Telemetria, Pesos & Auditoria
          </button>
        </nav>

        {activeTab === 'PLANNER' && <SchedulePlannerBoard />}
        {activeTab === 'INVENTORY' && <MachineInventoryView />}
        {activeTab === 'COURSES' && <CoursesCatalogView />}
        {activeTab === 'TOPOLOGY' && <RoomsTopologyView />}
        {activeTab === 'AUDIT' && <AuditAndConcurrencyView />}
      </main>
    </div>
  );
}
