import { create } from 'zustand';
import {
  allocateWeek,
  recalculateOnMachineMaintenance,
} from '@/domain/engine/allocate';
import {
  evaluateManualMachineChange,
  type SwapOrAssignOutcome,
} from '@/domain/export/whatsappAndLogistics';
import { suggestRoomBlockForCourse } from '@/domain/rules/eligibility';
import type {
  Allocation,
  AllocationExplanation,
  ConsultingRoom,
  Course,
  EngineConfig,
  FloorNumber,
  Machine,
  MachineStatus,
  MaintenanceQuarantineProposal,
  ManualLock,
  ProbeType,
  RuleQuality,
  ShiftDemand,
  WeeklySchedule,
} from '@/domain/types';
import {
  LocalNexusDatabase,
  type NexusDatabaseState,
  type SaveShiftTransactionalInput,
} from '@/infrastructure/local/localDatabase';
import {
  isSupabaseConfigured,
  syncCatalogBatchToSupabase,
  syncCourseRuleToSupabase,
  syncCourseToSupabase,
  syncEngineConfigToSupabase,
  syncMachineToSupabase,
  syncRoomToSupabase,
  type SyncConnectionState,
} from '@/infrastructure/supabase/supabaseClient';

const dbInstance = new LocalNexusDatabase();

interface UndoHistoryEntry {
  allocations: Allocation[];
  explanations: AllocationExplanation[];
  manualLocks: ManualLock[];
}

export interface RecalcDiffEntry {
  shiftId: string;
  shiftLabel: string;
  roomId: string;
  fromMachineId?: string;
  fromMachineLabel: string;
  toMachineId?: string;
  toMachineLabel: string;
}

export interface NexusAppStore extends NexusDatabaseState {
  supabaseConnected: boolean;
  syncState: SyncConnectionState;
  lastCalculationMs: number;
  lastRecalcDiff: RecalcDiffEntry[] | null;
  undoStack: UndoHistoryEntry[];
  pendingSwapPrompt: {
    shiftId: string;
    targetRoomId: string;
    newMachineId: string;
    conflictRoomId: string;
    conflictMachineId: string;
    swappedAllocations: Allocation[];
  } | null;
  pendingMaintenanceProposal: MaintenanceQuarantineProposal | null;

  switchOperator: (operatorId: string) => void;
  renameOperator: (operatorId: string, newName: string) => void;
  upsertMachine: (machine: Omit<Machine, 'updatedAt' | 'updatedBy'>) => void;
  setMachineStatus: (machineId: string, status: MachineStatus) => void;
  toggleMachineProbe: (machineId: string, probe: ProbeType) => void;
  deleteMachine: (machineId: string) => void;
  setInitialMachineFloor: (machineId: string, floor: FloorNumber) => void;
  upsertCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;
  setCourseMachineRule: (
    courseId: string,
    machineId: string,
    quality: RuleQuality | null,
  ) => void;
  updateRoom: (
    roomId: string,
    patch: Partial<
      Pick<ConsultingRoom, 'zone' | 'reportProximity' | 'defaultEnabled' | 'corridorGroup'>
    >,
  ) => void;

  // Ações de Planejamento e Grade Interativa (Sprints 2 e 3)
  generateWeekSchedule: () => void;
  dismissRecalcDiff: () => void;
  addShiftToSchedule: (shiftKey: string) => string;
  removeShiftFromSchedule: (shiftId: string) => void;
  upsertShiftDemand: (demand: ShiftDemand) => void;
  upsertFullDayDemand: (demand: ShiftDemand) => void;
  removeShiftDemand: (demandId: string) => void;
  cloneScheduleForNextWeek: (newTitle: string) => void;
  suggestRoomsForCourseInShift: (
    shiftId: string,
    courseId: string,
    roomsRequired: number,
    excludeDemandId?: string,
  ) => string[];
  toggleDisabledRoomInShift: (shiftId: string, roomId: string) => void;
  assignOrSwapMachineInRoom: (
    shiftId: string,
    roomId: string,
    machineId: string,
  ) => SwapOrAssignOutcome;
  confirmPendingSwap: () => void;
  cancelPendingSwap: () => void;
  togglePinAllocation: (shiftId: string, roomId: string) => void;
  quarantineMachineInShift: (shiftId: string, machineId: string) => void;
  applyPendingMaintenanceProposal: () => void;
  dismissPendingMaintenanceProposal: () => void;
  undoLastAction: () => void;
  updateScheduleMetadata: (
    patch: Partial<Pick<WeeklySchedule, 'title' | 'status' | 'footerNote'>>,
  ) => void;

  // Ações de Telemetria, Pesos e Backup (Sprint 4)
  updateEngineWeights: (
    patch: Partial<
      Pick<
        EngineConfig,
        'w1Fit' | 'w2Proximity' | 'w3Transport' | 'w4Stability' | 'upgradeThreshold'
      >
    >,
  ) => void;
  exportBackupJson: () => string;
  importBackupJson: (rawJson: string) => void;
  syncNowWithSupabase: () => Promise<boolean>;

  saveShiftTransactional: (input: Omit<SaveShiftTransactionalInput, 'actor'>) => void;
  resetToSeed: () => void;
}

function runWeekAllocationOnDb(db: LocalNexusDatabase): number {
  const snap = db.getSnapshot();
  const demandsByShiftId: Record<string, ShiftDemand[]> = {};
  for (const d of snap.demands) {
    const list = demandsByShiftId[d.shiftId] ?? [];
    list.push(d);
    demandsByShiftId[d.shiftId] = list;
  }

  const manualLocksByShiftId: Record<string, ManualLock[]> = {};
  for (const l of snap.manualLocks) {
    const list = manualLocksByShiftId[l.shiftId] ?? [];
    list.push(l);
    manualLocksByShiftId[l.shiftId] = list;
  }

  const t0 = performance.now();
  const weekResult = allocateWeek({
    shifts: snap.shifts,
    demandsByShiftId,
    manualLocksByShiftId,
    disabledRoomsByShiftId: snap.disabledRoomsByShiftId,
    machines: snap.machines,
    rooms: snap.rooms,
    courses: snap.courses,
    courseRules: snap.courseRules,
    initialMachineFloors: snap.initialFloors,
    config: snap.engineConfig,
  });
  const elapsedMs = Number((performance.now() - t0).toFixed(2));

  const allAllocations: Allocation[] = [];
  const allExplanations: AllocationExplanation[] = [];
  const bottlenecksByShiftId: NexusDatabaseState['bottlenecksByShiftId'] = {};
  const floorMovesByShiftId: NexusDatabaseState['floorMovesByShiftId'] = {};

  for (const shift of snap.shifts) {
    const res = weekResult.resultsByShiftId[shift.id];
    if (!res) continue;
    allAllocations.push(...res.allocations);
    allExplanations.push(...res.explanations);
    bottlenecksByShiftId[shift.id] = res.bottlenecks;
    floorMovesByShiftId[shift.id] = res.floorMoves;
  }

  db.setComputedWeekAllocations({
    allocations: allAllocations,
    explanations: allExplanations,
    bottlenecksByShiftId,
    floorMovesByShiftId,
    suggestedFooterNote: weekResult.suggestedFooterNotePt,
  });

  return elapsedMs;
}

// Se o banco inicial ainda não tem alocações calculadas, gera na inicialização
if (dbInstance.getSnapshot().allocations.length === 0) {
  runWeekAllocationOnDb(dbInstance);
}

function computeAllocationsDiff(
  before: Allocation[],
  after: Allocation[],
  shifts: NexusDatabaseState['shifts'],
  machines: Machine[],
): RecalcDiffEntry[] {
  const machinesById = new Map(machines.map((m) => [m.id, m.internalLabel]));
  const shiftsById = new Map(shifts.map((s) => [s.id, s.label]));
  const beforeMap = new Map(before.map((a) => [`${a.shiftId}::${a.roomId}`, a.machineId]));
  const afterMap = new Map(after.map((a) => [`${a.shiftId}::${a.roomId}`, a.machineId]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const diffs: RecalcDiffEntry[] = [];
  for (const key of keys) {
    const [shiftId = '', roomId = ''] = key.split('::');
    const prevId = beforeMap.get(key);
    const nextId = afterMap.get(key);
    if (prevId !== nextId) {
      diffs.push({
        shiftId,
        shiftLabel: shiftsById.get(shiftId) ?? shiftId,
        roomId,
        fromMachineId: prevId,
        fromMachineLabel: prevId ? (machinesById.get(prevId) ?? prevId) : 'Livre',
        toMachineId: nextId,
        toMachineLabel: nextId ? (machinesById.get(nextId) ?? nextId) : 'Livre',
      });
    }
  }
  return diffs;
}

export const useNexusStore = create<NexusAppStore>((set, get) => ({
  ...dbInstance.getSnapshot(),
  supabaseConnected: isSupabaseConfigured(),
  syncState: isSupabaseConfigured() ? 'CLOUD_SYNCED' : 'LOCAL_ONLY',
  lastCalculationMs: 1.2,
  lastRecalcDiff: null,
  undoStack: [],
  pendingSwapPrompt: null,
  pendingMaintenanceProposal: null,

  switchOperator: (operatorId) => {
    dbInstance.setCurrentOperator(operatorId);
    set(dbInstance.getSnapshot());
  },

  renameOperator: (operatorId, newName) => {
    dbInstance.updateOperatorName(operatorId, newName);
    set(dbInstance.getSnapshot());
  },

  upsertMachine: (machine) => {
    const saved = dbInstance.upsertMachine(machine);
    set({
      ...dbInstance.getSnapshot(),
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    void syncMachineToSupabase(saved)
      .then((ok) => {
        if (ok) set({ syncState: 'CLOUD_SYNCED' });
      })
      .catch(() => undefined);
  },

  setMachineStatus: (machineId, status) => {
    const saved = dbInstance.setMachineStatus(machineId, status);
    set({
      ...dbInstance.getSnapshot(),
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    void syncMachineToSupabase(saved)
      .then((ok) => {
        if (ok) set({ syncState: 'CLOUD_SYNCED' });
      })
      .catch(() => undefined);
  },

  toggleMachineProbe: (machineId, probe) => {
    const saved = dbInstance.toggleMachineProbe(machineId, probe);
    set({
      ...dbInstance.getSnapshot(),
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    void syncMachineToSupabase(saved)
      .then((ok) => {
        if (ok) set({ syncState: 'CLOUD_SYNCED' });
      })
      .catch(() => undefined);
  },

  deleteMachine: (machineId) => {
    dbInstance.deleteMachine(machineId);
    set(dbInstance.getSnapshot());
  },

  setInitialMachineFloor: (machineId, floor) => {
    dbInstance.setInitialMachineFloor(machineId, floor);
    set(dbInstance.getSnapshot());
  },

  upsertCourse: (course) => {
    const saved = dbInstance.upsertCourse(course);
    set({
      ...dbInstance.getSnapshot(),
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    void syncCourseToSupabase(saved)
      .then((ok) => {
        if (ok) set({ syncState: 'CLOUD_SYNCED' });
      })
      .catch(() => undefined);
  },

  deleteCourse: (courseId) => {
    dbInstance.deleteCourse(courseId);
    set(dbInstance.getSnapshot());
  },

  setCourseMachineRule: (courseId, machineId, quality) => {
    dbInstance.setCourseMachineRule(courseId, machineId, quality);
    set({
      ...dbInstance.getSnapshot(),
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    if (quality !== null) {
      void syncCourseRuleToSupabase({ courseId, machineId, quality })
        .then((ok) => {
          if (ok) set({ syncState: 'CLOUD_SYNCED' });
        })
        .catch(() => undefined);
    }
  },

  updateRoom: (roomId, patch) => {
    const saved = dbInstance.updateRoom(roomId, patch);
    set({
      ...dbInstance.getSnapshot(),
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    void syncRoomToSupabase(saved)
      .then((ok) => {
        if (ok) set({ syncState: 'CLOUD_SYNCED' });
      })
      .catch(() => undefined);
  },

  generateWeekSchedule: () => {
    const current = dbInstance.getSnapshot();
    const undoEntry: UndoHistoryEntry = {
      allocations: current.allocations,
      explanations: current.explanations,
      manualLocks: current.manualLocks,
    };
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    const updated = dbInstance.getSnapshot();
    const diff = computeAllocationsDiff(
      current.allocations,
      updated.allocations,
      updated.shifts,
      updated.machines,
    );
    set({
      ...updated,
      lastCalculationMs: elapsedMs,
      lastRecalcDiff: diff,
      undoStack: [undoEntry, ...get().undoStack.slice(0, 19)],
    });
  },

  dismissRecalcDiff: () => {
    set({ lastRecalcDiff: null });
  },

  addShiftToSchedule: (shiftKey) => {
    const added = dbInstance.addShiftToSchedule(shiftKey);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
    return added.id;
  },

  removeShiftFromSchedule: (shiftId) => {
    dbInstance.removeShiftFromSchedule(shiftId);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
  },

  upsertShiftDemand: (demand) => {
    dbInstance.upsertShiftDemand(demand);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
  },

  upsertFullDayDemand: (demand) => {
    dbInstance.upsertFullDayDemand(demand);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
  },

  removeShiftDemand: (demandId) => {
    dbInstance.removeShiftDemand(demandId);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
  },

  cloneScheduleForNextWeek: (newTitle) => {
    dbInstance.cloneScheduleForNextWeek(newTitle);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
      undoStack: [],
    });
  },

  suggestRoomsForCourseInShift: (shiftId, courseId, roomsRequired, excludeDemandId) => {
    const snap = dbInstance.getSnapshot();
    const usedRooms = new Set<string>();
    for (const d of snap.demands) {
      if (d.shiftId === shiftId && d.id !== excludeDemandId) {
        for (const r of d.chosenRooms) {
          usedRooms.add(r);
        }
      }
    }
    const disabled = new Set(snap.disabledRoomsByShiftId[shiftId] ?? []);
    return suggestRoomBlockForCourse({
      courseId,
      roomsRequired,
      rooms: snap.rooms,
      usedRoomIds: usedRooms,
      disabledRoomIds: disabled,
    });
  },

  toggleDisabledRoomInShift: (shiftId, roomId) => {
    dbInstance.toggleDisabledRoomInShift(shiftId, roomId);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
  },

  assignOrSwapMachineInRoom: (shiftId, roomId, machineId) => {
    const snap = dbInstance.getSnapshot();
    const shiftAllocs = snap.allocations.filter((a) => a.shiftId === shiftId);
    const outcome = evaluateManualMachineChange(shiftAllocs, roomId, machineId);

    if (outcome.mode === 'SWAP_REQUIRED' && outcome.conflictRoomId && outcome.conflictMachineId) {
      set({
        pendingSwapPrompt: {
          shiftId,
          targetRoomId: roomId,
          newMachineId: machineId,
          conflictRoomId: outcome.conflictRoomId,
          conflictMachineId: outcome.conflictMachineId,
          swappedAllocations: outcome.swappedAllocations,
        },
      });
      return outcome;
    }

    // Atribuição direta sem conflito: registra no histórico de Undo, grava trava e salva turno
    const undoEntry: UndoHistoryEntry = {
      allocations: snap.allocations,
      explanations: snap.explanations,
      manualLocks: snap.manualLocks,
    };

    const targetAlloc = shiftAllocs.find((a) => a.roomId === roomId);
    const targetDemand = snap.demands.find((d) => d.id === targetAlloc?.demandId);
    if (targetDemand) {
      dbInstance.recordManualOverride(targetDemand.courseId);
    }

    dbInstance.addManualLock({
      shiftId,
      roomId,
      machineId,
      lockedBy: dbInstance.getCurrentOperator().name,
    });

    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
      undoStack: [undoEntry, ...get().undoStack.slice(0, 19)],
      pendingSwapPrompt: null,
    });
    return outcome;
  },

  confirmPendingSwap: () => {
    const pending = get().pendingSwapPrompt;
    if (!pending) return;

    const snap = dbInstance.getSnapshot();
    const undoEntry: UndoHistoryEntry = {
      allocations: snap.allocations,
      explanations: snap.explanations,
      manualLocks: snap.manualLocks,
    };

    const actor = dbInstance.getCurrentOperator().name;
    // Remove travas anteriores nas duas salas permutadas e adiciona as novas
    for (const lock of snap.manualLocks) {
      if (
        lock.shiftId === pending.shiftId &&
        (lock.roomId === pending.targetRoomId || lock.roomId === pending.conflictRoomId)
      ) {
        dbInstance.removeManualLock(lock.id, actor);
      }
    }

    dbInstance.addManualLock({
      shiftId: pending.shiftId,
      roomId: pending.targetRoomId,
      machineId: pending.newMachineId,
      lockedBy: actor,
    });
    dbInstance.addManualLock({
      shiftId: pending.shiftId,
      roomId: pending.conflictRoomId,
      machineId: pending.conflictMachineId,
      lockedBy: actor,
    });

    const targetAlloc = snap.allocations.find(
      (a) => a.shiftId === pending.shiftId && a.roomId === pending.targetRoomId,
    );
    const targetDemand = snap.demands.find((d) => d.id === targetAlloc?.demandId);
    if (targetDemand) {
      dbInstance.recordManualOverride(targetDemand.courseId);
    }

    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
      undoStack: [undoEntry, ...get().undoStack.slice(0, 19)],
      pendingSwapPrompt: null,
    });
  },

  cancelPendingSwap: () => {
    set({ pendingSwapPrompt: null });
  },

  togglePinAllocation: (shiftId, roomId) => {
    const snap = dbInstance.getSnapshot();
    const existingLock = snap.manualLocks.find(
      (l) => l.shiftId === shiftId && l.roomId === roomId,
    );
    const actor = dbInstance.getCurrentOperator().name;

    if (existingLock) {
      dbInstance.removeManualLock(existingLock.id, actor);
    } else {
      const alloc = snap.allocations.find(
        (a) => a.shiftId === shiftId && a.roomId === roomId,
      );
      if (alloc) {
        dbInstance.addManualLock({
          shiftId,
          roomId,
          machineId: alloc.machineId,
          lockedBy: actor,
        });
      }
    }
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
    });
  },

  quarantineMachineInShift: (shiftId, machineId) => {
    const snap = dbInstance.getSnapshot();
    const shiftAllocs = snap.allocations.filter((a) => a.shiftId === shiftId);
    const shiftExps = snap.explanations.filter((e) =>
      shiftAllocs.some((a) => a.id === e.allocationId),
    );
    const shiftDemands = snap.demands.filter((d) => d.shiftId === shiftId);

    const proposal = recalculateOnMachineMaintenance({
      brokenMachineId: machineId,
      shiftId,
      currentAllocations: shiftAllocs,
      currentExplanations: shiftExps,
      demands: shiftDemands,
      machines: snap.machines,
      rooms: snap.rooms,
      courses: snap.courses,
      courseRules: snap.courseRules,
      machineFloors: snap.initialFloors,
      config: snap.engineConfig,
    });

    set({ pendingMaintenanceProposal: proposal });
  },

  applyPendingMaintenanceProposal: () => {
    const proposal = get().pendingMaintenanceProposal;
    if (!proposal) return;

    const snap = dbInstance.getSnapshot();
    const undoEntry: UndoHistoryEntry = {
      allocations: snap.allocations,
      explanations: snap.explanations,
      manualLocks: snap.manualLocks,
    };

    const actor = dbInstance.getCurrentOperator().name;
    // Marca a máquina quebrada como MAINTENANCE no inventário
    dbInstance.setMachineStatus(proposal.brokenMachineId, 'MAINTENANCE', actor);

    // Se há máquina substituta na proposta, cria trava manual naquela sala para garantir que nenhuma outra sala mude (DEC-E)
    for (const lock of snap.manualLocks) {
      if (lock.shiftId === proposal.shiftId && lock.roomId === proposal.affectedRoomId) {
        dbInstance.removeManualLock(lock.id, actor);
      }
    }
    if (proposal.replacementMachineId) {
      dbInstance.addManualLock({
        shiftId: proposal.shiftId,
        roomId: proposal.affectedRoomId,
        machineId: proposal.replacementMachineId,
        lockedBy: actor,
      });
    }

    const otherShiftAllocs = snap.allocations.filter((a) => a.shiftId !== proposal.shiftId);
    const otherShiftExps = snap.explanations.filter(
      (e) => !snap.allocations.some((a) => a.shiftId === proposal.shiftId && a.id === e.allocationId),
    );

    const currentNote = snap.schedules[0]?.footerNote ?? '';
    const updatedNote = currentNote
      ? `${currentNote}\n${proposal.footerNoteSuggestionPt}`
      : proposal.footerNoteSuggestionPt;

    dbInstance.setComputedWeekAllocations({
      allocations: [...otherShiftAllocs, ...proposal.updatedAllocations],
      explanations: [...otherShiftExps, ...proposal.updatedExplanations],
      bottlenecksByShiftId: snap.bottlenecksByShiftId,
      floorMovesByShiftId: snap.floorMovesByShiftId,
      actor,
    });

    dbInstance.updateScheduleMetadata(
      {
        status: 'CHANGED',
        footerNote: updatedNote,
      },
      actor,
    );

    set({
      ...dbInstance.getSnapshot(),
      undoStack: [undoEntry, ...get().undoStack.slice(0, 19)],
      pendingMaintenanceProposal: null,
    });
  },

  dismissPendingMaintenanceProposal: () => {
    set({ pendingMaintenanceProposal: null });
  },

  undoLastAction: () => {
    const stack = get().undoStack;
    const last = stack[0];
    if (!last) return;

    const snap = dbInstance.getSnapshot();
    dbInstance.replaceState(
      {
        ...snap,
        allocations: last.allocations,
        explanations: last.explanations,
        manualLocks: last.manualLocks,
      },
      dbInstance.getCurrentOperator().name,
    );

    set({
      ...dbInstance.getSnapshot(),
      undoStack: stack.slice(1),
    });
  },

  updateScheduleMetadata: (patch) => {
    dbInstance.updateScheduleMetadata(patch);
    set(dbInstance.getSnapshot());
  },

  updateEngineWeights: (patch) => {
    const savedCfg = dbInstance.updateEngineConfig(patch);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
      syncState: isSupabaseConfigured() ? 'PENDING_SYNC' : 'LOCAL_ONLY',
    });
    void syncEngineConfigToSupabase(savedCfg)
      .then((ok) => {
        if (ok) set({ syncState: 'CLOUD_SYNCED' });
      })
      .catch(() => undefined);
  },

  exportBackupJson: () => {
    return JSON.stringify(dbInstance.getSnapshot(), null, 2);
  },

  importBackupJson: (rawJson) => {
    const parsed = JSON.parse(rawJson) as NexusDatabaseState;
    if (!Array.isArray(parsed.machines) || !Array.isArray(parsed.rooms)) {
      throw new Error('Arquivo JSON inválido para o Escala Nexus.');
    }
    dbInstance.replaceState(parsed, dbInstance.getCurrentOperator().name);
    set(dbInstance.getSnapshot());
  },

  syncNowWithSupabase: async () => {
    if (!isSupabaseConfigured()) {
      set({ syncState: 'LOCAL_ONLY' });
      return false;
    }
    set({ syncState: 'PENDING_SYNC' });
    const snap = dbInstance.getSnapshot();
    try {
      const ok = await syncCatalogBatchToSupabase({
        machines: snap.machines,
        rooms: snap.rooms,
        courses: snap.courses,
      });
      set({ syncState: ok ? 'CLOUD_SYNCED' : 'PENDING_SYNC' });
      return ok;
    } catch {
      set({ syncState: 'PENDING_SYNC' });
      return false;
    }
  },

  saveShiftTransactional: (input) => {
    const actor = dbInstance.getCurrentOperator().name;
    dbInstance.saveShiftTransactional({ ...input, actor });
    set(dbInstance.getSnapshot());
  },

  resetToSeed: () => {
    const actor = dbInstance.getCurrentOperator().name;
    dbInstance.resetToSeed(actor);
    const elapsedMs = runWeekAllocationOnDb(dbInstance);
    set({
      ...dbInstance.getSnapshot(),
      lastCalculationMs: elapsedMs,
      undoStack: [],
      pendingSwapPrompt: null,
      pendingMaintenanceProposal: null,
    });
  },
}));
