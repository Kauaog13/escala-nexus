import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  CalendarPlus,
  Check,
  Copy,
  CopyPlus,
  Download,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Undo2,
  Wrench,
  X,
} from 'lucide-react';
import { useNexusStore } from '@/application/store';
import {
  buildShiftTransitionReport,
  formatWeekWhatsAppText,
} from '@/domain/export/whatsappAndLogistics';
import type { ScheduleStatus, ShiftDemand } from '@/domain/types';
import { AVAILABLE_WEEK_SHIFTS } from '@/infrastructure/local/localDatabase';
import { FloorMapContainer } from './FloorMapContainer';

export function SchedulePlannerBoard() {
  const {
    schedules,
    shifts,
    demands,
    allocations,
    explanations,
    bottlenecksByShiftId,
    floorMovesByShiftId,
    disabledRoomsByShiftId,
    machines,
    rooms,
    courses,
    lastCalculationMs,
    lastRecalcDiff,
    undoStack,
    pendingSwapPrompt,
    pendingMaintenanceProposal,
    generateWeekSchedule,
    dismissRecalcDiff,
    addShiftToSchedule,
    removeShiftFromSchedule,
    upsertShiftDemand,
    upsertFullDayDemand,
    removeShiftDemand,
    cloneScheduleForNextWeek,
    suggestRoomsForCourseInShift,
    toggleDisabledRoomInShift,
    assignOrSwapMachineInRoom,
    confirmPendingSwap,
    cancelPendingSwap,
    togglePinAllocation,
    quarantineMachineInShift,
    applyPendingMaintenanceProposal,
    dismissPendingMaintenanceProposal,
    undoLastAction,
    updateScheduleMetadata,
  } = useNexusStore();

  const [activeShiftId, setActiveShiftId] = useState<string>(
    shifts[2]?.id ?? shifts[0]?.id ?? 'shift-sabado-manha',
  );
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [newShiftKeyToAdd, setNewShiftKeyToAdd] = useState<string>('QUINTA_MANHA');
  const [cloneTitleFeedback, setCloneTitleFeedback] = useState<string | null>(null);

  // Estado do formulário de Lançar/Editar Curso no Turno
  const [selectedCourseId, setSelectedCourseId] = useState<string>('pg-us-ecof');
  const [launchRegime, setLaunchRegime] = useState<'SINGLE_SHIFT' | 'FULL_DAY'>('SINGLE_SHIFT');
  const [studentsCount, setStudentsCount] = useState<number>(12);
  const [customRoomsCount, setCustomRoomsCount] = useState<number>(6);
  const [extraMachine, setExtraMachine] = useState<boolean>(false);
  const [chosenRoomsDraft, setChosenRoomsDraft] = useState<string[]>(() =>
    suggestRoomsForCourseInShift('shift-sabado-manha', 'pg-us-ecof', 6),
  );
  const [manualMachinesDraft, setManualMachinesDraft] = useState<string[]>([]);
  const [showRoomPicker, setShowRoomPicker] = useState<boolean>(false);

  const schedule = schedules[0];
  const activeShiftIndex = shifts.findIndex((s) => s.id === activeShiftId);
  const activeShift = shifts[activeShiftIndex] ?? shifts[0]!;
  const previousShift = activeShiftIndex > 0 ? shifts[activeShiftIndex - 1] : undefined;

  const shiftDemands = demands.filter((d) => d.shiftId === activeShift.id);
  const shiftAllocations = allocations.filter((a) => a.shiftId === activeShift.id);
  const shiftBottlenecks = bottlenecksByShiftId[activeShift.id] ?? [];
  const shiftFloorMoves = floorMovesByShiftId[activeShift.id] ?? [];
  const disabledRooms = new Set(disabledRoomsByShiftId[activeShift.id] ?? []);

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const machinesById = new Map(machines.map((m) => [m.id, m]));

  const selectedCourseObj = coursesById.get(selectedCourseId);
  const activeShiftKeys = new Set(shifts.map((s) => s.shiftKey));
  const addableShiftTemplates = AVAILABLE_WEEK_SHIFTS.filter(
    (t) => !activeShiftKeys.has(t.shiftKey),
  );

  function handleStudentsChange(val: number) {
    const clean = Math.max(1, val);
    const calcRooms = Math.ceil(clean / 2);
    setStudentsCount(clean);
    setCustomRoomsCount(calcRooms);
    setChosenRoomsDraft(
      suggestRoomsForCourseInShift(activeShift.id, selectedCourseId, calcRooms),
    );
  }

  function handleCourseSelect(courseId: string) {
    setSelectedCourseId(courseId);
    const suggested = suggestRoomsForCourseInShift(
      activeShift.id,
      courseId,
      customRoomsCount,
    );
    setChosenRoomsDraft(suggested);
    setManualMachinesDraft([]);
  }

  function handleRoomsCountChange(val: number) {
    const clean = Math.max(1, Math.min(29, val));
    setCustomRoomsCount(clean);
    setChosenRoomsDraft(
      suggestRoomsForCourseInShift(activeShift.id, selectedCourseId, clean),
    );
  }

  function toggleDraftRoom(roomId: string) {
    setChosenRoomsDraft((prev) =>
      prev.includes(roomId) ? prev.filter((r) => r !== roomId) : [...prev, roomId],
    );
  }

  function toggleDraftManualMachine(machineId: string) {
    setManualMachinesDraft((prev) =>
      prev.includes(machineId)
        ? prev.filter((m) => m !== machineId)
        : [...prev, machineId],
    );
  }

  function handleAddOrUpdateDemand(e: React.FormEvent) {
    e.preventDefault();
    const existing = shiftDemands.find((d) => d.courseId === selectedCourseId);
    const payload: ShiftDemand = {
      id: existing?.id ?? `dem-${activeShift.id}-${selectedCourseId}`,
      shiftId: activeShift.id,
      courseId: selectedCourseId,
      studentsCount,
      roomsRequired: customRoomsCount,
      chosenRooms: chosenRoomsDraft,
      extraMachine,
      manualMachineIds:
        manualMachinesDraft.length > 0 ? manualMachinesDraft : undefined,
    };

    if (launchRegime === 'FULL_DAY') {
      upsertFullDayDemand(payload);
    } else {
      upsertShiftDemand(payload);
    }
  }

  function handleAddShift() {
    if (!newShiftKeyToAdd) return;
    const addedId = addShiftToSchedule(newShiftKeyToAdd);
    setActiveShiftId(addedId);
    const remaining = AVAILABLE_WEEK_SHIFTS.find(
      (t) => t.shiftKey !== newShiftKeyToAdd && !activeShiftKeys.has(t.shiftKey),
    );
    if (remaining) {
      setNewShiftKeyToAdd(remaining.shiftKey);
    }
  }

  function handleCloneNextWeek() {
    const nextTitle = `Próximo FDS (Herdado de ${schedule?.title ?? 'Escala Anterior'})`;
    cloneScheduleForNextWeek(nextTitle);
    setCloneTitleFeedback(
      'Escala clonada! O andar final das máquinas no último turno foi herdado como ponto de partida (DEC-C / RF08).',
    );
    setTimeout(() => setCloneTitleFeedback(null), 5000);
  }

  // Relatório de Transição entre o Turno Anterior e o Turno Atual (RF06)
  const transitionReport = previousShift
    ? buildShiftTransitionReport({
        fromShift: previousShift,
        toShift: activeShift,
        fromAllocations: allocations.filter((a) => a.shiftId === previousShift.id),
        toAllocations: shiftAllocations,
        toDemands: shiftDemands,
        machines,
        rooms,
        courses,
      })
    : null;

  // Texto completo de exportação para o WhatsApp (RF07)
  const whatsappText = formatWeekWhatsAppText({
    title: schedule?.title ?? 'FDS NEXUS',
    shifts: shifts.map((s) => ({
      shift: s,
      demands: demands.filter((d) => d.shiftId === s.id),
      allocations: allocations.filter((a) => a.shiftId === s.id),
      courses,
      rooms,
      machines,
    })),
    footerNote: schedule?.footerNote,
  });

  async function handleCopyWhatsApp() {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } catch {
      // Fallback silencioso
    }
  }

  function handleDownloadTxt() {
    const blob = new Blob([whatsappText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-nexus-${(schedule?.title ?? 'fds').toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Barra de Controle da Escala, Título Editável, Clonagem RF08 e Seletor de Turnos Flexíveis (RN01) */}
      <div className="space-y-3 rounded-lg border border-nexus-border bg-nexus-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nexus-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-zinc-600">Título da Escala:</label>
            <input
              value={schedule?.title ?? ''}
              onChange={(e) => updateScheduleMetadata({ title: e.target.value })}
              className="rounded border border-nexus-border bg-zinc-50 px-2.5 py-1 text-xs font-bold text-nexus-black"
            />
            {schedule?.basedOnId && (
              <span className="rounded bg-nexus-green-light px-2 py-0.5 text-[11px] font-semibold text-nexus-green-deep">
                Andar Inicial Herdado (DEC-C)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-600">
              Cálculo: {lastCalculationMs} ms
            </span>

            <select
              value={schedule?.status ?? 'DRAFT'}
              onChange={(e) =>
                updateScheduleMetadata({ status: e.target.value as ScheduleStatus })
              }
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                schedule?.status === 'PUBLISHED'
                  ? 'border-nexus-green bg-nexus-green-light text-nexus-green-deep'
                  : schedule?.status === 'CHANGED'
                    ? 'border-nexus-amber bg-amber-100 text-amber-900'
                    : 'border-nexus-border bg-white text-zinc-700'
              }`}
            >
              <option value="DRAFT">Status: Rascunho</option>
              <option value="PUBLISHED">Status: Oficial Publicada</option>
              <option value="CHANGED">Status: Alterada em Andamento</option>
            </select>

            <button
              type="button"
              onClick={handleCloneNextWeek}
              title="Clonar escala para o próximo FDS herdando o andar final das máquinas do último turno (RF08 / DEC-C)"
              className="inline-flex items-center gap-1.5 rounded-md border border-nexus-border bg-white px-3 py-1.5 text-xs font-semibold text-nexus-black hover:bg-zinc-50"
            >
              <CopyPlus className="h-3.5 w-3.5 text-nexus-green" /> Clonar p/ Próximo FDS (RF08)
            </button>

            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={undoLastAction}
              className="inline-flex items-center gap-1 rounded-md border border-nexus-border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" /> Desfazer ({undoStack.length})
            </button>

            <button
              type="button"
              onClick={generateWeekSchedule}
              className="inline-flex items-center gap-1.5 rounded-md bg-nexus-green px-3.5 py-1.5 text-xs font-semibold text-nexus-white hover:bg-nexus-green-dark"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Recalcular Escala
            </button>
          </div>
        </div>

        {cloneTitleFeedback && (
          <div className="rounded border border-nexus-green bg-nexus-green-light px-3 py-2 text-xs font-semibold text-nexus-green-deep">
            {cloneTitleFeedback}
          </div>
        )}

        {lastRecalcDiff !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-nexus-green bg-nexus-green-light/60 px-3 py-2 text-xs text-nexus-green-deep">
            <div>
              {lastRecalcDiff.length === 0 ? (
                <span className="font-semibold">
                  Diff do Recálculo (§5.5): Nenhuma sala precisou mudar (100% de estabilidade
                  mantida).
                </span>
              ) : (
                <div>
                  <span className="font-bold">
                    Diff do Recálculo (§5.5): {lastRecalcDiff.length} sala(s) alterada(s):
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {lastRecalcDiff.slice(0, 8).map((item) => (
                      <span
                        key={`${item.shiftId}-${item.roomId}`}
                        className="rounded border border-nexus-green bg-white px-2 py-0.5 text-nexus-black"
                      >
                        [{item.shiftLabel}] {item.roomId}: {item.fromMachineLabel} →{' '}
                        <strong>{item.toMachineLabel}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={dismissRecalcDiff}
              className="rounded border border-nexus-green bg-white px-2 py-0.5 text-[11px] font-medium text-nexus-green-deep hover:bg-nexus-green-light"
            >
              Fechar Diff
            </button>
          </div>
        )}

        {/* Abas de Turnos da Semana + Adição de Dia/Turno Extra (Segunda a Domingo — RN01) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {shifts.map((s) => {
              const count = allocations.filter((a) => a.shiftId === s.id).length;
              const isCurrent = s.id === activeShift.id;
              return (
                <div key={s.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveShiftId(s.id)}
                    className={`rounded-l-md border px-3.5 py-2 text-xs font-semibold transition ${
                      isCurrent
                        ? 'border-nexus-black bg-nexus-black text-nexus-white shadow-sm'
                        : 'border-nexus-border bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {s.label}{' '}
                    <span
                      className={`ml-1 rounded px-1.5 py-0.5 text-[11px] ${
                        isCurrent
                          ? 'bg-nexus-green text-nexus-white'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {count} salas
                    </span>
                  </button>
                  {shifts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const fallbackShift = shifts.find((other) => other.id !== s.id);
                        removeShiftFromSchedule(s.id);
                        if (isCurrent && fallbackShift) {
                          setActiveShiftId(fallbackShift.id);
                        }
                      }}
                      title={`Remover turno ${s.label}`}
                      className={`rounded-r-md border border-l-0 px-1.5 py-2 text-xs ${
                        isCurrent
                          ? 'border-nexus-black bg-nexus-surface text-zinc-300 hover:text-white'
                          : 'border-nexus-border bg-zinc-100 text-zinc-500 hover:text-nexus-red'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {addableShiftTemplates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={newShiftKeyToAdd}
                onChange={(e) => setNewShiftKeyToAdd(e.target.value)}
                className="rounded border border-nexus-border bg-zinc-50 px-2 py-1.5 text-xs font-medium text-zinc-700"
              >
                {addableShiftTemplates.map((t) => (
                  <option key={t.shiftKey} value={t.shiftKey}>
                    + {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddShift}
                className="inline-flex items-center gap-1 rounded border border-nexus-border bg-white px-2.5 py-1.5 text-xs font-semibold text-nexus-black hover:bg-zinc-50"
              >
                <CalendarPlus className="h-3.5 w-3.5 text-nexus-green" /> Adicionar Turno (RN01)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prompt de Permuta Automática em Conflito de Patrimônio (RN10) */}
      {pendingSwapPrompt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-nexus-amber bg-amber-50 p-4 text-xs text-amber-950 shadow">
          <div className="flex items-center gap-2.5">
            <ArrowDownUp className="h-5 w-5 shrink-0 text-nexus-amber" />
            <div>
              <p className="font-bold">
                Trava Anti-Duplicidade (RN10): O aparelho{' '}
                {machinesById.get(pendingSwapPrompt.newMachineId)?.internalLabel} já está alocado no
                consultório {pendingSwapPrompt.conflictRoomId} neste turno!
              </p>
              <p className="text-amber-800">
                Deseja <strong>permutar (trocar)</strong> os aparelhos entre as salas{' '}
                <strong>{pendingSwapPrompt.targetRoomId}</strong> e{' '}
                <strong>{pendingSwapPrompt.conflictRoomId}</strong>?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmPendingSwap}
              className="rounded bg-nexus-black px-3.5 py-1.5 font-semibold text-nexus-white hover:bg-nexus-surface"
            >
              Confirmar Permuta entre Salas
            </button>
            <button
              type="button"
              onClick={cancelPendingSwap}
              className="rounded border border-amber-400 bg-white px-3 py-1.5 font-medium text-amber-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Prompt de Quarentena de Máquina com Proposta de Menor Mudança (DEC-E) */}
      {pendingMaintenanceProposal && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-nexus-red bg-red-50 p-4 text-xs text-red-950 shadow">
          <div className="flex items-center gap-2.5">
            <Wrench className="h-5 w-5 shrink-0 text-nexus-red" />
            <div>
              <p className="font-bold">{pendingMaintenanceProposal.alertMessagePt}</p>
              <p className="mt-0.5 font-mono text-[11px] text-red-800">
                Nota sugerida: {pendingMaintenanceProposal.footerNoteSuggestionPt}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyPendingMaintenanceProposal}
              className="rounded bg-nexus-red px-3.5 py-1.5 font-semibold text-white hover:bg-red-700"
            >
              Confirmar Menor Mudança (DEC-E)
            </button>
            <button
              type="button"
              onClick={dismissPendingMaintenanceProposal}
              className="rounded border border-red-300 bg-white px-3 py-1.5 font-medium text-red-900"
            >
              Cancelar / Trocar Manualmente
            </button>
          </div>
        </div>
      )}

      {/* Alertas de Gargalos e Banner de Transporte entre Andares */}
      {(shiftBottlenecks.length > 0 || shiftFloorMoves.length > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shiftBottlenecks.map((bn) => (
            <div
              key={bn.id}
              className={`rounded-lg border p-3 text-xs ${
                bn.severity === 'CRITICAL'
                  ? 'border-nexus-red bg-red-50 text-red-950'
                  : 'border-nexus-amber bg-amber-50 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{bn.messagePt}</span>
              </div>
              <ul className="mt-1 list-disc pl-5 text-[11px] opacity-90">
                {bn.suggestedActionsPt.map((act) => (
                  <li key={act}>{act}</li>
                ))}
              </ul>
            </div>
          ))}

          {shiftFloorMoves.length > 0 && (
            <div className="rounded-lg border border-nexus-green bg-nexus-green-light p-3 text-xs text-nexus-green-deep">
              <p className="font-semibold">
                Logística de Pavimento neste Turno: {shiftFloorMoves.length} aparelho(s) mudam de
                andar
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {shiftFloorMoves.map((mv) => (
                  <span
                    key={mv.machineId}
                    className="inline-flex items-center gap-1 rounded border border-nexus-green bg-white px-2 py-0.5 font-medium text-nexus-black"
                  >
                    {mv.machineLabel}: {mv.fromFloor}º → {mv.toFloor}º ({mv.toRoomId})
                    {mv.mobility === 'HEAVY' && (
                      <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-900">
                        PESADO
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Painel de Lançamento de Curso no Turno + Lista de Cursos Ativos no Turno */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <form
          onSubmit={handleAddOrUpdateDemand}
          className="space-y-3 rounded-lg border border-nexus-border bg-nexus-white p-4 lg:col-span-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nexus-black">
              Lançar / Atualizar Curso em {activeShift.label}
            </h3>
            <span className="text-[11px] text-zinc-500">Fórmula: ⌈alunos / 2⌉</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-zinc-700">Curso da Semana</label>
              <select
                value={selectedCourseId}
                onChange={(e) => handleCourseSelect(e.target.value)}
                className="mt-1 w-full rounded border border-nexus-border bg-white px-2.5 py-1.5 text-xs font-medium"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.surrenderRank} — {c.shortName} (Prioridade {c.priorityLevel}
                    {c.requiresManual ? ' • Manual' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-zinc-700">
                Regime de Horário do Curso (RN01 e RN06)
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLaunchRegime('SINGLE_SHIFT')}
                  className={`rounded border px-2.5 py-1.5 text-xs font-semibold transition ${
                    launchRegime === 'SINGLE_SHIFT'
                      ? 'border-nexus-black bg-nexus-black text-white'
                      : 'border-nexus-border bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Apenas {activeShift.label}
                </button>
                <button
                  type="button"
                  onClick={() => setLaunchRegime('FULL_DAY')}
                  className={`rounded border px-2.5 py-1.5 text-xs font-semibold transition ${
                    launchRegime === 'FULL_DAY'
                      ? 'border-nexus-green bg-nexus-green text-white'
                      : 'border-nexus-border bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Dia Todo (Manhã + Tarde — RN06)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Nº de Alunos</label>
              <input
                type="number"
                min={1}
                max={60}
                value={studentsCount}
                onChange={(e) => handleStudentsChange(Number(e.target.value))}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Salas Exigidas</label>
              <input
                type="number"
                min={1}
                max={29}
                value={customRoomsCount}
                onChange={(e) => handleRoomsCountChange(Number(e.target.value))}
                className="mt-1 w-full rounded border border-nexus-border px-2.5 py-1.5 text-xs font-semibold"
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={extraMachine}
                  onChange={(e) => setExtraMachine(e.target.checked)}
                />
                +1 Auditório
              </label>
            </div>
          </div>

          {/* Bloco de Salas Sugerido (DEC-B) e Seletor de Salas do Operador (DEC-A) */}
          <div className="rounded border border-nexus-border bg-zinc-50 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-800">
                Salas do Curso ({chosenRoomsDraft.length} selecionadas):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setChosenRoomsDraft(
                      suggestRoomsForCourseInShift(
                        activeShift.id,
                        selectedCourseId,
                        customRoomsCount,
                      ),
                    )
                  }
                  className="inline-flex items-center gap-1 text-nexus-green-dark hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Sugerir Zonas (DEC-B)
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoomPicker((v) => !v)}
                  className="font-medium text-nexus-black underline"
                >
                  {showRoomPicker ? 'Ocultar Mapa' : 'Escolher Salas (DEC-A)'}
                </button>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1">
              {chosenRoomsDraft.map((rId) => (
                <span
                  key={rId}
                  className="rounded bg-nexus-black px-2 py-0.5 font-mono text-[11px] text-nexus-white"
                >
                  {rId}
                </span>
              ))}
            </div>

            {showRoomPicker && (
              <div className="mt-2.5 grid grid-cols-6 gap-1 border-t border-nexus-border pt-2">
                {rooms.map((r) => {
                  const picked = chosenRoomsDraft.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleDraftRoom(r.id)}
                      className={`rounded border px-1.5 py-1 font-mono text-[11px] transition ${
                        picked
                          ? 'border-nexus-green bg-nexus-green font-bold text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {r.id}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seleção Manual de Máquinas quando o curso exige Controle Manual (RN08) */}
          {selectedCourseObj?.requiresManual && (
            <div className="rounded border border-nexus-amber bg-amber-50 p-2.5 text-xs">
              <p className="font-semibold text-amber-950">
                Controle Manual Obrigatório (RN08): escolha os aparelhos desta turma
              </p>
              <div className="mt-1.5 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {machines
                  .filter((m) => m.status !== 'MAINTENANCE')
                  .map((m) => {
                    const chosen = manualMachinesDraft.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleDraftManualMachine(m.id)}
                        className={`rounded border px-2 py-0.5 text-[11px] ${
                          chosen
                            ? 'border-nexus-black bg-nexus-black font-semibold text-white'
                            : 'border-amber-300 bg-white text-amber-950'
                        }`}
                      >
                        {m.internalLabel}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-nexus-green px-4 py-2 text-xs font-semibold text-nexus-white hover:bg-nexus-green-dark"
          >
            <Plus className="h-4 w-4" />{' '}
            {launchRegime === 'FULL_DAY'
              ? 'Lançar Curso no Dia Todo (Manhã + Tarde)'
              : 'Lançar Curso e Distribuir Máquinas'}
          </button>
        </form>

        {/* Cursos Ativos no Turno Atual */}
        <div className="rounded-lg border border-nexus-border bg-nexus-white p-4 lg:col-span-7">
          <h3 className="text-sm font-semibold text-nexus-black">
            Turmas Ativas em {activeShift.label} ({shiftDemands.length} cursos •{' '}
            {shiftAllocations.length} salas alocadas)
          </h3>

          {shiftDemands.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-500">
              Nenhum curso lançado neste turno. Utilize o formulário ao lado para adicionar uma
              turma.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {shiftDemands.map((d) => {
                const course = coursesById.get(d.courseId);
                const courseAllocs = shiftAllocations.filter((a) => a.demandId === d.id);
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-nexus-border bg-zinc-50/70 p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-nexus-black px-1.5 py-0.5 font-mono text-[11px] text-white">
                          #{course?.surrenderRank ?? '—'}
                        </span>
                        <span className="font-bold text-nexus-black">
                          {course?.shortName ?? d.courseId}
                        </span>
                        <span className="text-zinc-500">
                          ({d.studentsCount} alunos → {d.roomsRequired} salas)
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {courseAllocs.map((a) => {
                          const m = machinesById.get(a.machineId);
                          return (
                            <span
                              key={a.id}
                              className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                                a.matchQuality === 'IDEAL'
                                  ? 'border-nexus-green bg-nexus-green-light font-semibold text-nexus-green-deep'
                                  : a.matchQuality === 'CONTINGENCY'
                                    ? 'border-nexus-amber bg-amber-100 text-amber-950'
                                    : 'border-zinc-300 bg-white text-zinc-800'
                              }`}
                            >
                              {a.roomId}: {m?.internalLabel ?? a.machineId}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeShiftDemand(d.id)}
                      className="inline-flex items-center gap-1 rounded border border-nexus-border bg-white px-2.5 py-1 text-zinc-600 hover:border-nexus-red hover:bg-red-50 hover:text-nexus-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Container Desacoplado: Grade Operacional + Planta Radial Interativa com Drag-and-Drop (§9 e Tarefa 4.6) */}
      <FloorMapContainer
        shiftId={activeShift.id}
        rooms={rooms}
        shiftAllocations={shiftAllocations}
        shiftDemands={shiftDemands}
        machines={machines}
        courses={courses}
        explanations={explanations}
        disabledRooms={disabledRooms}
        onAssignOrSwapMachine={assignOrSwapMachineInRoom}
        onTogglePinAllocation={togglePinAllocation}
        onQuarantineMachine={quarantineMachineInShift}
        onToggleDisabledRoom={toggleDisabledRoomInShift}
      />

      {/* Relatório de Transição entre Turnos (RF06) & Exportação Oficial WhatsApp (RF07) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-nexus-border bg-nexus-white p-4 lg:col-span-5">
          <h3 className="text-sm font-bold text-nexus-black">
            Relatório de Logística entre Turnos (RF06)
          </h3>
          {!transitionReport ? (
            <p className="mt-2 text-xs text-zinc-500">
              Este é o primeiro turno da semana. O ponto de partida das máquinas vem do Snapshot
              Inicial configurado no inventário ou herdado da escala anterior (DEC-C).
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-xs">
              <p className="font-medium text-zinc-700">
                Comparando <strong>{transitionReport.fromShiftLabel}</strong> →{' '}
                <strong>{transitionReport.toShiftLabel}</strong>:
              </p>

              <div className="rounded border border-nexus-green bg-nexus-green-light/50 p-2.5">
                <p className="font-semibold text-nexus-green-deep">
                  Permanecem na mesma sala ({transitionReport.stayingInSameRoom.length} máquinas —
                  zero transporte):
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {transitionReport.stayingInSameRoom.map((item) => (
                    <span
                      key={item.machineId}
                      className="rounded bg-nexus-surface px-2 py-0.5 font-mono text-[11px] text-emerald-400"
                    >
                      {item.roomId}: {item.machineLabel}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded border border-nexus-border bg-zinc-50 p-2.5">
                <p className="font-semibold text-zinc-800">
                  Mudam de sala no mesmo andar ({transitionReport.movingWithinSameFloor.length}):
                </p>
                {transitionReport.movingWithinSameFloor.length === 0 ? (
                  <p className="mt-1 text-zinc-500">Nenhuma movimentação horizontal.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {transitionReport.movingWithinSameFloor.map((m) => (
                      <li key={m.machineId}>
                        {m.machineLabel}: {m.fromRoomId} → {m.toRoomId} ({m.courseShortName})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded border border-nexus-amber bg-amber-50 p-2.5">
                <p className="font-semibold text-amber-950">
                  Transporte entre andares ({transitionReport.movingBetweenFloors.length}):
                </p>
                {transitionReport.movingBetweenFloors.length === 0 ? (
                  <p className="mt-1 text-amber-800">Zero transporte vertical neste turno!</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-amber-950">
                    {transitionReport.movingBetweenFloors.map((m) => (
                      <li key={m.machineId}>
                        {m.machineLabel}: {m.fromFloor}º Andar ({m.fromRoomId}) → {m.toFloor}º
                        Andar ({m.toRoomId})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Painel de Exportação Oficial no Padrão WhatsApp da Nexus (RF07 e RN11) */}
        <div className="rounded-lg border border-nexus-border bg-nexus-black p-4 text-nexus-white lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-nexus-white">
                Exportação Oficial WhatsApp Nexus (RF07)
              </h3>
              <p className="text-xs text-zinc-400">
                Inclui tag automática <code>*2° ANDAR*</code>, códigos limpos e nota operacional de
                rodapé
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-md bg-nexus-green px-3.5 py-1.5 text-xs font-semibold text-nexus-white hover:bg-nexus-green-dark"
              >
                {copiedWhatsApp ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar WhatsApp (1 clique)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-nexus-surface px-3 py-1.5 text-xs text-zinc-200 hover:border-nexus-green"
              >
                <Download className="h-3.5 w-3.5" /> .txt
              </button>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs text-zinc-400">
              Nota Operacional de Rodapé (RN11 — editável):
            </label>
            <textarea
              rows={2}
              value={schedule?.footerNote ?? ''}
              onChange={(e) => updateScheduleMetadata({ footerNote: e.target.value })}
              placeholder="*ALTERAÇÃO DESCENDO GIOB PARA O PRIMEIRO ANDAR LOGO NO SÁBADO À TARDE...*"
              className="mt-1 w-full rounded border border-zinc-700 bg-nexus-surface p-2 font-mono text-xs text-emerald-300 focus:border-nexus-green focus:outline-none"
            />
          </div>

          <pre className="mt-3 max-h-72 overflow-y-auto rounded border border-zinc-800 bg-nexus-surface p-3 font-mono text-xs leading-relaxed text-zinc-100">
            {whatsappText}
          </pre>
        </div>
      </div>
    </div>
  );
}
