import { useState } from 'react';
import {
  GripVertical,
  HelpCircle,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Monitor,
  Unlock,
  Wrench,
} from 'lucide-react';
import type {
  Allocation,
  AllocationExplanation,
  ConsultingRoom,
  Course,
  Machine,
  ShiftDemand,
} from '@/domain/types';

export interface FloorMapContainerProps {
  shiftId: string;
  rooms: ConsultingRoom[];
  shiftAllocations: Allocation[];
  shiftDemands: ShiftDemand[];
  machines: Machine[];
  courses: Course[];
  explanations: AllocationExplanation[];
  disabledRooms: Set<string>;
  onAssignOrSwapMachine: (shiftId: string, roomId: string, machineId: string) => void;
  onTogglePinAllocation: (shiftId: string, roomId: string) => void;
  onQuarantineMachine: (shiftId: string, machineId: string) => void;
  onToggleDisabledRoom: (shiftId: string, roomId: string) => void;
}

export function FloorMapContainer({
  shiftId,
  rooms,
  shiftAllocations,
  shiftDemands,
  machines,
  courses,
  explanations,
  disabledRooms,
  onAssignOrSwapMachine,
  onTogglePinAllocation,
  onQuarantineMachine,
  onToggleDisabledRoom,
}: FloorMapContainerProps) {
  const [viewMode, setViewMode] = useState<'GRID' | 'RADIAL_MAP'>('GRID');
  const [expandedExplainRoomId, setExpandedExplainRoomId] = useState<string | null>(null);
  const [draggedMachine, setDraggedMachine] = useState<{
    fromRoomId: string;
    machineId: string;
  } | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);

  const allocByRoomId = new Map(shiftAllocations.map((a) => [a.roomId, a]));
  const machinesById = new Map(machines.map((m) => [m.id, m]));
  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const explanationsByAllocId = new Map(explanations.map((e) => [e.allocationId, e]));

  function handleDragStart(e: React.DragEvent, fromRoomId: string, machineId: string) {
    setDraggedMachine({ fromRoomId, machineId });
    e.dataTransfer.setData('text/plain', JSON.stringify({ fromRoomId, machineId }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, roomId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRoomId !== roomId) {
      setDragOverRoomId(roomId);
    }
  }

  function handleDrop(e: React.DragEvent, targetRoomId: string) {
    e.preventDefault();
    setDragOverRoomId(null);
    if (!draggedMachine) return;
    if (draggedMachine.fromRoomId === targetRoomId) {
      setDraggedMachine(null);
      return;
    }
    onAssignOrSwapMachine(shiftId, targetRoomId, draggedMachine.machineId);
    setDraggedMachine(null);
  }

  function renderRoomCard(room: ConsultingRoom, compact = false) {
    const alloc = allocByRoomId.get(room.id);
    const isSkipped = disabledRooms.has(room.id) || !room.defaultEnabled;
    const machine = alloc ? machinesById.get(alloc.machineId) : undefined;
    const demand = alloc ? shiftDemands.find((d) => d.id === alloc.demandId) : undefined;
    const course = demand ? coursesById.get(demand.courseId) : undefined;
    const exp = alloc ? explanationsByAllocId.get(alloc.id) : undefined;
    const isExplainOpen = expandedExplainRoomId === room.id;
    const isDragTarget = dragOverRoomId === room.id;

    let cardStyle = 'border-nexus-border bg-zinc-50/60';
    if (isSkipped) {
      cardStyle = 'border-dashed border-zinc-300 bg-zinc-100 text-zinc-400';
    } else if (alloc) {
      if (alloc.matchQuality === 'IDEAL') {
        cardStyle = 'border-l-4 border-nexus-green bg-nexus-green-light/30';
      } else if (alloc.matchQuality === 'CONTINGENCY') {
        cardStyle = 'border-l-4 border-nexus-amber bg-amber-50/40';
      } else {
        cardStyle = 'border-l-4 border-zinc-800 bg-white';
      }
    }

    if (isDragTarget) {
      cardStyle += ' ring-2 ring-nexus-green bg-nexus-green-light/60';
    }

    return (
      <div
        key={room.id}
        draggable={Boolean(alloc && !isSkipped)}
        onDragStart={(e) => {
          if (alloc) handleDragStart(e, room.id, alloc.machineId);
        }}
        onDragEnd={() => {
          setDraggedMachine(null);
          setDragOverRoomId(null);
        }}
        onDragOver={(e) => handleDragOver(e, room.id)}
        onDragLeave={() => {
          if (dragOverRoomId === room.id) setDragOverRoomId(null);
        }}
        onDrop={(e) => handleDrop(e, room.id)}
        className={`flex flex-col justify-between rounded-lg border ${
          compact ? 'p-2.5' : 'p-3'
        } transition ${cardStyle}`}
      >
        <div>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              {alloc && !isSkipped && (
                <span
                  title="Arraste para trocar o aparelho com outro consultório"
                  className="cursor-grab text-zinc-400 hover:text-nexus-black"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="font-mono text-sm font-bold text-nexus-black">{room.id}</span>
              <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                Z{room.zone} (+{room.reportProximity})
              </span>
            </div>

            <div className="flex items-center gap-1">
              {alloc && (
                <>
                  <button
                    type="button"
                    onClick={() => onTogglePinAllocation(shiftId, room.id)}
                    title={
                      alloc.isPinned
                        ? 'Destravar máquina desta sala'
                        : 'Travar (Pin) máquina nesta sala'
                    }
                    className={`rounded p-1 ${
                      alloc.isPinned
                        ? 'bg-nexus-black text-nexus-green'
                        : 'text-zinc-400 hover:bg-zinc-100 hover:text-nexus-black'
                    }`}
                  >
                    {alloc.isPinned ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onQuarantineMachine(shiftId, alloc.machineId)}
                    title="Simular quebra / colocar aparelho em manutenção com proposta de Menor Mudança (DEC-E)"
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-nexus-red"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onToggleDisabledRoom(shiftId, room.id)}
                className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-100"
              >
                {isSkipped ? 'Reativar' : 'Pular'}
              </button>
            </div>
          </div>

          {isSkipped ? (
            <p className="mt-2.5 text-xs italic text-zinc-500">
              Sala pulada (Logística de Laudo — RN09)
            </p>
          ) : !alloc ? (
            <p className="mt-2.5 text-xs text-zinc-400">Consultório livre neste turno</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-bold text-nexus-black">
                  {course?.shortName ?? demand?.courseId}
                </span>
                {alloc.inherited && (
                  <span className="rounded bg-nexus-surface px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Mantido
                  </span>
                )}
              </div>

              <select
                value={alloc.machineId}
                onChange={(e) => onAssignOrSwapMachine(shiftId, room.id, e.target.value)}
                className="w-full rounded border border-nexus-border bg-white px-2 py-1 text-xs font-semibold text-nexus-black"
              >
                {machines
                  .filter((m) => m.status !== 'MAINTENANCE')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.internalLabel} ({m.brand} • T{m.tier})
                    </option>
                  ))}
              </select>

              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono font-semibold text-nexus-green-deep">
                  Score: {alloc.score} pts ({alloc.matchQuality})
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedExplainRoomId(isExplainOpen ? null : room.id)}
                  className="inline-flex items-center gap-0.5 font-medium text-nexus-black underline"
                >
                  <HelpCircle className="h-3 w-3 text-nexus-green" /> Por quê?
                </button>
              </div>

              {isExplainOpen && exp && (
                <div className="mt-1.5 rounded border border-nexus-border bg-white p-2 text-[11px] text-zinc-700 shadow-inner">
                  <p className="font-mono text-[10px] font-semibold text-nexus-black">
                    {exp.formulaPt}
                  </p>
                  <p className="mt-1 leading-snug">{exp.textPt}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {machine && !isSkipped && (
          <div className="mt-2 border-t border-zinc-200/70 pt-1.5 text-[10px] text-zinc-500">
            WhatsApp: <strong className="text-zinc-800">{machine.code}</strong> •{' '}
            {machine.probes.join(', ')}
          </div>
        )}
      </div>
    );
  }

  const floor1Zone1 = rooms.filter((r) => r.floor === 1 && r.zone === 1);
  const floor1Zone2 = rooms.filter((r) => r.floor === 1 && r.zone === 2);
  const floor2Rooms = rooms.filter((r) => r.floor === 2);

  return (
    <div className="space-y-4">
      {/* Barra de Alternância: Grade Operacional vs. Planta Baixa / Mapa Radial (§9) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-nexus-border bg-nexus-white px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-nexus-black">
            Mapa e Grade Interativa dos 33 Consultórios
          </h3>
          <p className="text-xs text-zinc-500">
            Arraste e solte cartões entre salas (Drag-and-Drop), use o seletor rápido ou clique em
            &ldquo;Por quê?&rdquo;
          </p>
        </div>

        <div className="inline-flex rounded-md border border-nexus-border bg-zinc-100 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('GRID')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'GRID'
                ? 'bg-nexus-black text-nexus-white shadow-sm'
                : 'text-zinc-700 hover:text-nexus-black'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-nexus-green" /> Grade Operacional
          </button>
          <button
            type="button"
            onClick={() => setViewMode('RADIAL_MAP')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'RADIAL_MAP'
                ? 'bg-nexus-black text-nexus-white shadow-sm'
                : 'text-zinc-700 hover:text-nexus-black'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5 text-nexus-green" /> Planta Radial de Laudo (§9)
          </button>
        </div>
      </div>

      {viewMode === 'GRID' ? (
        ([1, 2] as const).map((floorNum) => {
          const floorRooms = rooms.filter((r) => r.floor === floorNum);
          return (
            <section
              key={floorNum}
              className="rounded-lg border border-nexus-border bg-nexus-white p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-nexus-black">
                  {floorNum === 1
                    ? '1º Andar — Andar Preferencial (Salas 1A-01 a 1A-23)'
                    : '2º Andar — Andar de Expansão / Contingência (Salas 2A-01 a 2A-10)'}
                </h4>
                <span className="text-xs text-zinc-500">
                  Arraste uma sala alocada sobre outra para permutar (RN10)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {floorRooms.map((room) => renderRoomCard(room))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="space-y-4">
          {/* Planta Radial do 1º Andar: Ilha Central de Computadores de Laudo + Anel Zona 1 + Anel Zona 2 */}
          <section className="rounded-lg border-2 border-nexus-black bg-nexus-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-nexus-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-nexus-black">
                  Planta Radial — 1º Andar (Topologia de Computadores de Laudo)
                </h4>
                <p className="text-xs text-zinc-600">
                  As salas da <strong>Zona 1 (+30 pts)</strong> circundam a Ilha Central de Laudo; a{' '}
                  <strong>Zona 2 (+10 pts)</strong> forma o anel periférico do 1º pavimento.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md bg-nexus-black px-3 py-1.5 text-xs font-semibold text-nexus-white">
                <Monitor className="h-4 w-4 text-nexus-green" /> Ilha Central de PCs de Laudo
              </div>
            </div>

            {/* Anel Interno: Zona 1 (+30 pts) */}
            <div className="rounded-xl border-2 border-nexus-green bg-nexus-green-light/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-nexus-green px-2.5 py-0.5 text-xs font-bold text-white">
                  ZONA 1 — Anel Colado aos Computadores de Laudo (+30 pts • Salas 1A-06 a 1A-18)
                </span>
                <span className="text-xs font-medium text-nexus-green-deep">
                  {floor1Zone1.length} consultórios
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {floor1Zone1.map((room) => renderRoomCard(room, true))}
              </div>
            </div>

            {/* Anel Externo: Zona 2 (+10 pts) */}
            <div className="mt-4 rounded-xl border border-nexus-border bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-nexus-surface px-2.5 py-0.5 text-xs font-bold text-white">
                  ZONA 2 — Anel Periférico do 1º Andar (+10 pts • Corredor de Entrada e Fundo)
                </span>
                <span className="text-xs font-medium text-zinc-600">
                  {floor1Zone2.length} consultórios
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {floor1Zone2.map((room) => renderRoomCard(room, true))}
              </div>
            </div>
          </section>

          {/* Planta Linear do 2º Andar: Zona 3 (0 pts) */}
          <section className="rounded-lg border border-nexus-border bg-nexus-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-zinc-200 px-2.5 py-0.5 text-xs font-bold text-zinc-800">
                ZONA 3 — 2º Andar Linear (0 pts • Salas 2A-01 a 2A-10)
              </span>
              <span className="text-xs text-zinc-500">
                Usado quando a demanda do turno ultrapassa o 1º andar
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {floor2Rooms.map((room) => renderRoomCard(room, true))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

