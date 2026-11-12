import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useNexusStore } from '@/application/store';
import type { Course, CourseType, PriorityLevel, RuleQuality } from '@/domain/types';

const QUALITY_OPTIONS: { value: RuleQuality | null; label: string; badgeClass: string }[] = [
  {
    value: 'IDEAL',
    label: '1ª Opção (Ideal)',
    badgeClass: 'bg-nexus-green text-nexus-white border-nexus-green font-semibold',
  },
  {
    value: 'SECONDARY',
    label: '2ª Opção',
    badgeClass: 'bg-nexus-green-light text-nexus-green-deep border-nexus-green font-medium',
  },
  {
    value: 'CONTINGENCY',
    label: 'Contingência',
    badgeClass: 'bg-amber-100 text-amber-900 border-nexus-amber font-medium',
  },
  {
    value: null,
    label: 'Não usar',
    badgeClass: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  },
];

export function CoursesCatalogView() {
  const { courses, machines, courseRules, upsertCourse, deleteCourse, setCourseMachineRule } =
    useNexusStore();

  const [typeFilter, setTypeFilter] = useState<CourseType | 'ALL'>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id ?? 'pg-us-ecof',
  );
  const [showNewCourse, setShowNewCourse] = useState(false);

  const [newId, setNewId] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newType, setNewType] = useState<CourseType>('MODULAR');
  const [newWorkload, setNewWorkload] = useState(30);
  const [newPriority, setNewPriority] = useState<PriorityLevel>(2);
  const [newRank, setNewRank] = useState(15);
  const [newManual, setNewManual] = useState(false);
  const [newManualReason, setNewManualReason] = useState('');

  const filteredCourses = courses.filter((c) =>
    typeFilter === 'ALL' ? true : c.type === typeFilter,
  );

  const selectedCourse: Course | undefined =
    courses.find((c) => c.id === selectedCourseId) ?? filteredCourses[0];

  const rulesForSelected = new Map(
    courseRules
      .filter((r) => r.courseId === selectedCourse?.id)
      .map((r) => [r.machineId, r.quality]),
  );

  function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!newId.trim() || !newShortName.trim()) return;
    const createdId = newId.trim().toLowerCase();
    upsertCourse({
      id: createdId,
      shortName: newShortName.trim(),
      fullName: newFullName.trim() || newShortName.trim(),
      type: newType,
      workloadHours: newWorkload,
      priorityLevel: newPriority,
      requiresManual: newManual,
      manualReason: newManual ? newManualReason.trim() || 'Validação manual exigida' : undefined,
      surrenderRank: newRank,
    });
    setSelectedCourseId(createdId);
    setShowNewCourse(false);
    setNewId('');
    setNewShortName('');
    setNewFullName('');
  }

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nexus-border bg-nexus-white p-4">
        <div className="flex items-center gap-2">
          {(['ALL', 'POS', 'MODULAR'] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setTypeFilter(tp)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                typeFilter === tp
                  ? 'border-nexus-black bg-nexus-black text-nexus-white'
                  : 'border-nexus-border bg-nexus-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {tp === 'ALL'
                ? `Todos os Cursos (${courses.length})`
                : tp === 'POS'
                  ? `Pós-Graduação (${courses.filter((c) => c.type === 'POS').length})`
                  : `Cursos Modulares (${courses.filter((c) => c.type === 'MODULAR').length})`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowNewCourse((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-nexus-green px-3.5 py-2 text-sm font-medium text-nexus-white hover:bg-nexus-green-dark"
        >
          <Plus className="h-4 w-4" />
          {showNewCourse ? 'Fechar Cadastro' : 'Cadastrar Novo Curso'}
        </button>
      </div>

      {showNewCourse && (
        <form
          onSubmit={handleCreateCourse}
          className="rounded-lg border-2 border-nexus-green bg-nexus-white p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-nexus-black">
            Novo Curso no Catálogo Nexus
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700">ID Único</label>
              <input
                required
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="mod-fetal-avancado"
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Sigla / Nome no WhatsApp
              </label>
              <input
                required
                value={newShortName}
                onChange={(e) => setNewShortName(e.target.value)}
                placeholder="PG US ECOF"
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-700">Nome Completo</label>
              <input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Pós-Graduação em Ecocardiografia Fetal"
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Categoria</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CourseType)}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              >
                <option value="POS">Pós-Graduação</option>
                <option value="MODULAR">Modular / Intensivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Prioridade Clínica</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value) as PriorityLevel)}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              >
                <option value={1}>Prioridade 1 (Máxima)</option>
                <option value={2}>Prioridade 2 (Alta)</option>
                <option value={3}>Prioridade 3 (Base)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Ordem de Rendição (DEC-D)
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={newRank}
                onChange={(e) => setNewRank(Number(e.target.value))}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Carga Horária (h)</label>
              <input
                type="number"
                value={newWorkload}
                onChange={(e) => setNewWorkload(Number(e.target.value))}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={newManual}
                onChange={(e) => setNewManual(e.target.checked)}
              />
              Exige Controle Manual (RN08 — sondas ou softwares específicos)
            </label>
            {newManual && (
              <input
                value={newManualReason}
                onChange={(e) => setNewManualReason(e.target.value)}
                placeholder="Motivo do controle manual (ex: exige sonda setorial neonatal)"
                className="flex-1 rounded border border-nexus-border px-2.5 py-1 text-xs"
              />
            )}
            <button
              type="submit"
              className="rounded-md bg-nexus-black px-4 py-2 text-sm font-medium text-nexus-white hover:bg-nexus-surface"
            >
              Salvar Curso
            </button>
          </div>
        </form>
      )}

      {/* Layout Mestre-Detalhe: Lista de Cursos à esquerda e Matriz de Máquinas à direita */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-5">
          {filteredCourses.map((c) => {
            const isSelected = c.id === selectedCourse?.id;
            const idealCount = courseRules.filter(
              (r) => r.courseId === c.id && r.quality === 'IDEAL',
            ).length;
            const secondaryCount = courseRules.filter(
              (r) => r.courseId === c.id && r.quality === 'SECONDARY',
            ).length;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  isSelected
                    ? 'border-2 border-nexus-green bg-nexus-green-light/40'
                    : 'border-nexus-border bg-nexus-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-nexus-black px-1.5 py-0.5 font-mono text-xs text-nexus-white">
                        #{c.surrenderRank}
                      </span>
                      <span className="font-semibold text-nexus-black">{c.shortName}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">{c.fullName}</p>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      c.priorityLevel === 1
                        ? 'bg-nexus-green-dark text-nexus-white'
                        : c.priorityLevel === 2
                          ? 'bg-zinc-800 text-nexus-white'
                          : 'bg-zinc-200 text-zinc-800'
                    }`}
                  >
                    Prioridade {c.priorityLevel}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-nexus-green-deep">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {idealCount} 1ª opção
                    </span>
                    <span className="text-zinc-500">• {secondaryCount} 2ª opção</span>
                  </div>

                  {c.requiresManual && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                      <AlertTriangle className="h-3 w-3" /> Controle Manual
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Matriz de Máquinas Preferenciais do Curso Selecionado */}
        <div className="lg:col-span-7">
          {selectedCourse && (
            <div className="rounded-lg border border-nexus-border bg-nexus-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-nexus-border pb-3">
                <div>
                  <h3 className="text-base font-semibold text-nexus-black">
                    Matriz de Máquinas — {selectedCourse.shortName}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Defina quais aparelhos são 1ª Opção (100 pts), 2ª Opção (60 pts) ou Contingência
                    (20 pts) para este curso (Hipótese H2).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => deleteCourse(selectedCourse.id)}
                  className="inline-flex items-center gap-1 rounded border border-nexus-border px-2.5 py-1 text-xs text-zinc-600 hover:border-nexus-red hover:bg-red-50 hover:text-nexus-red"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir Curso
                </button>
              </div>

              {/* Edição rápida de prioridade, ordem de rendição e modo manual */}
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Prioridade Clínica
                  </label>
                  <select
                    value={selectedCourse.priorityLevel}
                    onChange={(e) =>
                      upsertCourse({
                        ...selectedCourse,
                        priorityLevel: Number(e.target.value) as PriorityLevel,
                      })
                    }
                    className="mt-1 w-full rounded border border-nexus-border bg-white px-2 py-1 text-xs"
                  >
                    <option value={1}>Prioridade 1 (Máxima)</option>
                    <option value={2}>Prioridade 2 (Alta)</option>
                    <option value={3}>Prioridade 3 (Base)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Ordem de Rendição (#)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={selectedCourse.surrenderRank}
                    onChange={(e) =>
                      upsertCourse({
                        ...selectedCourse,
                        surrenderRank: Number(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded border border-nexus-border bg-white px-2 py-1 text-xs"
                  />
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-800">
                    <input
                      type="checkbox"
                      checked={selectedCourse.requiresManual}
                      onChange={(e) =>
                        upsertCourse({
                          ...selectedCourse,
                          requiresManual: e.target.checked,
                        })
                      }
                    />
                    Exige Controle Manual
                  </label>
                </div>
              </div>

              {/* Lista das 29+ máquinas para marcação em 1 clique */}
              <div className="mt-4 max-h-[520px] divide-y divide-nexus-border overflow-y-auto rounded border border-nexus-border">
                {machines.map((m) => {
                  const currentQuality = rulesForSelected.get(m.id) ?? null;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-zinc-50"
                    >
                      <div>
                        <span className="font-semibold text-nexus-black">{m.internalLabel}</span>{' '}
                        <span className="text-zinc-500">
                          ({m.brand} • Tier {m.tier})
                        </span>
                      </div>

                      <div className="inline-flex flex-wrap gap-1">
                        {QUALITY_OPTIONS.map((opt) => {
                          const active = currentQuality === opt.value;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() =>
                                setCourseMachineRule(selectedCourse.id, m.id, opt.value)
                              }
                              className={`rounded border px-2 py-0.5 transition ${
                                active
                                  ? opt.badgeClass
                                  : 'border-nexus-border bg-white text-zinc-500 hover:bg-zinc-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

