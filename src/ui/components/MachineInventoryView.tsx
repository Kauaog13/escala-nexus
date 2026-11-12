import { useState } from 'react';
import { Plus, RotateCcw, Search, Trash2, Wrench } from 'lucide-react';
import { useNexusStore } from '@/application/store';
import type {
  FloorNumber,
  Machine,
  MachineFamily,
  MachineStatus,
  MachineTier,
  MobilityWeight,
  ProbeType,
} from '@/domain/types';

const FAMILY_LABELS: Record<MachineFamily, string> = {
  VOLUSON: 'GE Voluson (Mulher)',
  SAMSUNG_V: 'Samsung Linha V / RS',
  RESONA: 'Mindray Resona',
  LOGIQ: 'GE Logiq (Interna)',
  CONSONA: 'Mindray Consona',
  CANON: 'Canon Aplio',
  ELITE: 'SonoScape Elite',
  VINNO: 'Vinno',
  PORTATIL: 'Portátil / POCUS',
};

const MOBILITY_LABELS: Record<MobilityWeight, string> = {
  HEAVY: 'Pesado (Evitar escada)',
  MEDIUM: 'Móvel Padrão',
  LIGHT: 'Móvel Leve',
  PORTABLE: 'Portátil de Mão',
};

const STATUS_BADGE: Record<
  MachineStatus,
  { label: string; activeClass: string; inactiveClass: string }
> = {
  ACTIVE: {
    label: 'Ativo',
    activeClass: 'bg-nexus-green text-nexus-white border-nexus-green',
    inactiveClass: 'bg-nexus-white text-zinc-600 border-nexus-border hover:bg-nexus-green-light',
  },
  MAINTENANCE: {
    label: 'Manutenção',
    activeClass: 'bg-nexus-red text-nexus-white border-nexus-red',
    inactiveClass: 'bg-nexus-white text-zinc-600 border-nexus-border hover:bg-red-50',
  },
  LOANED_TEMP: {
    label: 'Empréstimo/Demo',
    activeClass: 'bg-nexus-amber text-nexus-black border-nexus-amber font-semibold',
    inactiveClass: 'bg-nexus-white text-zinc-600 border-nexus-border hover:bg-amber-50',
  },
};

export function MachineInventoryView() {
  const {
    machines,
    probes,
    initialFloors,
    setMachineStatus,
    toggleMachineProbe,
    setInitialMachineFloor,
    upsertMachine,
    deleteMachine,
  } = useNexusStore();

  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<MachineFamily | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);

  const [formId, setFormId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formBrand, setFormBrand] = useState('GE');
  const [formFamily, setFormFamily] = useState<MachineFamily>('VOLUSON');
  const [formTier, setFormTier] = useState<MachineTier>(2);
  const [formMobility, setFormMobility] = useState<MobilityWeight>('MEDIUM');
  const [formStatus, setFormStatus] = useState<MachineStatus>('ACTIVE');
  const [formProbes, setFormProbes] = useState<ProbeType[]>(['CONVEXO', 'LINEAR']);
  const [formNotes, setFormNotes] = useState('');

  const filteredMachines = machines.filter((m) => {
    if (familyFilter !== 'ALL' && m.family !== familyFilter) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        m.id.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.internalLabel.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function startEdit(m: Machine) {
    setFormId(m.id);
    setFormCode(m.code);
    setFormLabel(m.internalLabel);
    setFormBrand(m.brand);
    setFormFamily(m.family);
    setFormTier(m.tier);
    setFormMobility(m.mobility);
    setFormStatus(m.status);
    setFormProbes(m.probes);
    setFormNotes(m.notes ?? '');
    setShowForm(true);
  }

  function resetForm() {
    setFormId('');
    setFormCode('');
    setFormLabel('');
    setFormBrand('GE');
    setFormFamily('VOLUSON');
    setFormTier(2);
    setFormMobility('MEDIUM');
    setFormStatus('ACTIVE');
    setFormProbes(['CONVEXO', 'LINEAR']);
    setFormNotes('');
    setShowForm(false);
  }

  function handleSaveMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!formId.trim() || !formCode.trim()) return;
    upsertMachine({
      id: formId.trim().toLowerCase(),
      code: formCode.trim().toUpperCase(),
      internalLabel: formLabel.trim() || formCode.trim().toUpperCase(),
      brand: formBrand.trim() || 'Fabricante',
      family: formFamily,
      tier: formTier,
      mobility: formMobility,
      probes: formProbes,
      status: formStatus,
      notes: formNotes.trim() || undefined,
    });
    resetForm();
  }

  function toggleFormProbe(probeId: ProbeType) {
    setFormProbes((prev) =>
      prev.includes(probeId) ? prev.filter((p) => p !== probeId) : [...prev, probeId],
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros e botão de Novo Aparelho */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nexus-border bg-nexus-white p-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código (V6, Signature, Totus) ou marca..."
              className="w-full rounded-md border border-nexus-border py-1.5 pl-9 pr-3 text-sm focus:border-nexus-green focus:outline-none"
            />
          </div>

          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value as MachineFamily | 'ALL')}
            className="rounded-md border border-nexus-border bg-nexus-white px-3 py-1.5 text-sm"
          >
            <option value="ALL">Todas as Famílias</option>
            {Object.entries(FAMILY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MachineStatus | 'ALL')}
            className="rounded-md border border-nexus-border bg-nexus-white px-3 py-1.5 text-sm"
          >
            <option value="ALL">Todos os Status ({machines.length})</option>
            <option value="ACTIVE">
              Ativos ({machines.filter((m) => m.status === 'ACTIVE').length})
            </option>
            <option value="MAINTENANCE">
              Em Manutenção ({machines.filter((m) => m.status === 'MAINTENANCE').length})
            </option>
            <option value="LOANED_TEMP">
              Empréstimo/Demo ({machines.filter((m) => m.status === 'LOANED_TEMP').length})
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-nexus-green px-3.5 py-2 text-sm font-medium text-nexus-white transition hover:bg-nexus-green-dark"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Fechar Formulário' : 'Novo Aparelho / Demo'}
        </button>
      </div>

      {/* Formulário de Criação / Edição */}
      {showForm && (
        <form
          onSubmit={handleSaveMachine}
          className="rounded-lg border-2 border-nexus-green bg-nexus-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nexus-black">
              Cadastrar ou Editar Equipamento de Ultrassom
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-nexus-black"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                ID Único (ex: demo-ge-01)
              </label>
              <input
                required
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="v6-05 ou demo-01"
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Código WhatsApp (ex: V6)
              </label>
              <input
                required
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="V6"
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Rótulo Interno (ex: V6 #05)
              </label>
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="V6 #05"
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Fabricante</label>
              <input
                required
                value={formBrand}
                onChange={(e) => setFormBrand(e.target.value)}
                placeholder="GE, Samsung, Mindray..."
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Família Clínica</label>
              <select
                value={formFamily}
                onChange={(e) => setFormFamily(e.target.value as MachineFamily)}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              >
                {Object.entries(FAMILY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Nível (Tier)</label>
              <select
                value={formTier}
                onChange={(e) => setFormTier(Number(e.target.value) as MachineTier)}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              >
                <option value={1}>Tier 1 — Premium / Topo</option>
                <option value={2}>Tier 2 — Intermediário</option>
                <option value={3}>Tier 3 — Base / Contingência</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Mobilidade Física</label>
              <select
                value={formMobility}
                onChange={(e) => setFormMobility(e.target.value as MobilityWeight)}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              >
                {Object.entries(MOBILITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Status Inicial</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as MachineStatus)}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="LOANED_TEMP">Empréstimo / Demo</option>
                <option value="MAINTENANCE">Em Manutenção</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <span className="block text-xs font-medium text-zinc-700">
              Sondas e Softwares Ativos
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {probes.map((p) => {
                const selected = formProbes.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleFormProbe(p.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      selected
                        ? 'border-nexus-green bg-nexus-green-light font-medium text-nexus-green-deep'
                        : 'border-nexus-border bg-nexus-white text-zinc-600'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Observações opcionais (ex: Empréstimo GE para curso de Fígado)"
              className="flex-1 rounded border border-nexus-border px-2.5 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-nexus-black px-4 py-2 text-sm font-medium text-nexus-white hover:bg-nexus-surface"
            >
              Salvar Equipamento
            </button>
          </div>
        </form>
      )}

      {/* Tabela de Inventário com alteração de Status e Sondas em 1 clique */}
      <div className="overflow-x-auto rounded-lg border border-nexus-border bg-nexus-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-nexus-border bg-nexus-surface text-xs uppercase text-nexus-white">
              <th className="px-3 py-2.5">Aparelho (ID Único)</th>
              <th className="px-3 py-2.5">Família / Tier</th>
              <th className="px-3 py-2.5">Mobilidade & Andar Inicial (DEC-C)</th>
              <th className="px-3 py-2.5">Sondas e Recursos (1 clique)</th>
              <th className="px-3 py-2.5">Status Operacional (1 clique)</th>
              <th className="px-3 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nexus-border">
            {filteredMachines.map((m) => {
              const currentFloor: FloorNumber = initialFloors[m.id] ?? 1;
              return (
                <tr
                  key={m.id}
                  className={
                    m.status === 'MAINTENANCE'
                      ? 'bg-red-50/50'
                      : m.status === 'LOANED_TEMP'
                        ? 'bg-amber-50/40'
                        : 'hover:bg-zinc-50'
                  }
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-nexus-black">{m.internalLabel}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                        {m.id}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {m.brand} • WhatsApp: <strong className="text-zinc-700">{m.code}</strong>
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="font-medium text-zinc-800">{FAMILY_LABELS[m.family]}</div>
                    <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                      Tier {m.tier}
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="text-xs text-zinc-700">{MOBILITY_LABELS[m.mobility]}</div>
                    <div className="mt-1 inline-flex rounded border border-nexus-border bg-zinc-50 p-0.5 text-xs">
                      {([1, 2] as FloorNumber[]).map((fl) => (
                        <button
                          key={fl}
                          type="button"
                          onClick={() => setInitialMachineFloor(m.id, fl)}
                          className={`rounded px-2 py-0.5 transition ${
                            currentFloor === fl
                              ? 'bg-nexus-black font-medium text-nexus-white'
                              : 'text-zinc-600 hover:text-nexus-black'
                          }`}
                        >
                          {fl}º Andar
                        </button>
                      ))}
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {probes.map((p) => {
                        const active = m.probes.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleMachineProbe(m.id, p.id)}
                            title="Clique para ativar/desativar sonda neste aparelho"
                            className={`rounded border px-2 py-0.5 text-xs transition ${
                              active
                                ? 'border-nexus-green bg-nexus-green-light font-medium text-nexus-green-deep'
                                : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="inline-flex gap-1">
                      {(['ACTIVE', 'MAINTENANCE', 'LOANED_TEMP'] as MachineStatus[]).map((st) => {
                        const cfg = STATUS_BADGE[st];
                        const isCurrent = m.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setMachineStatus(m.id, st)}
                            className={`rounded border px-2 py-1 text-xs transition ${
                              isCurrent ? cfg.activeClass : cfg.inactiveClass
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        title="Editar aparelho"
                        className="rounded border border-nexus-border p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-nexus-black"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMachine(m.id)}
                        title="Remover aparelho"
                        className="rounded border border-nexus-border p-1.5 text-zinc-500 hover:border-nexus-red hover:bg-red-50 hover:text-nexus-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

