import { buildAllocationExplanation } from '@/domain/explain/buildExplanation';
import {
  buildPreviousMachineRoomMap,
  filterEligibleMachinesForCourse,
  suggestRoomBlockForCourse,
} from '@/domain/rules/eligibility';
import { evaluateCandidateScore } from '@/domain/scoring/terms';
import type {
  Allocation,
  AllocationExplanation,
  Bottleneck,
  ConsultingRoom,
  Course,
  CourseMachineRule,
  EngineConfig,
  FloorNumber,
  FloorTransportMove,
  Machine,
  MaintenanceQuarantineProposal,
  MatchQuality,
  RuleQuality,
  ShiftAllocationInput,
  ShiftAllocationResult,
  ShiftDemand,
  WeekAllocationInput,
  WeekAllocationResult,
} from '@/domain/types';

const QUALITY_RANK: Record<MatchQuality, number> = {
  IDEAL: 1,
  MANUAL: 1,
  SECONDARY: 2,
  CONTINGENCY: 3,
};

function sortDemandsBySurrenderOrder(
  demands: ReadonlyArray<ShiftDemand>,
  coursesById: ReadonlyMap<string, Course>,
): ShiftDemand[] {
  return [...demands].sort((a, b) => {
    const cA = coursesById.get(a.courseId);
    const cB = coursesById.get(b.courseId);
    const rankA = cA?.surrenderRank ?? 99;
    const rankB = cB?.surrenderRank ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const prioA = cA?.priorityLevel ?? 3;
    const prioB = cB?.priorityLevel ?? 3;
    if (prioA !== prioB) return prioA - prioB;
    return a.courseId.localeCompare(b.courseId);
  });
}

/**
 * Executa a alocação determinística de um único turno (Sprint 2, tarefas 2.5 a 2.11).
 */
export function allocateShift(input: ShiftAllocationInput): ShiftAllocationResult {
  const { shift, config } = input;
  const machinesById = new Map<string, Machine>(input.machines.map((m) => [m.id, m]));
  const roomsById = new Map<string, ConsultingRoom>(input.rooms.map((r) => [r.id, r]));
  const coursesById = new Map<string, Course>(input.courses.map((c) => [c.id, c]));
  const disabledRooms = new Set<string>(input.disabledRoomIds ?? []);
  const previousMachineRoom = buildPreviousMachineRoomMap(input.previousAllocations);

  // Salas que cada curso ocupou no turno imediatamente anterior (RN06)
  const previousRoomsByCourse = new Map<string, string[]>();
  if (input.previousAllocations) {
    const prevCourseByDemandId = new Map<string, string>(
      (input.previousDemands ?? []).map((d) => [d.id, d.courseId]),
    );
    for (const prevAlloc of input.previousAllocations) {
      const prevRoom = roomsById.get(prevAlloc.roomId);
      if (!prevRoom) continue;

      const explicitCourseId = prevCourseByDemandId.get(prevAlloc.demandId);
      if (explicitCourseId) {
        const list = previousRoomsByCourse.get(explicitCourseId) ?? [];
        list.push(prevAlloc.roomId);
        previousRoomsByCourse.set(explicitCourseId, list);
        continue;
      }

      // Fallback determinístico quando previousDemands não é informado isoladamente
      for (const d of input.demands) {
        const expectedPrefix = `alloc-${prevAlloc.shiftId}-${d.courseId}-`;
        if (prevAlloc.id.startsWith(expectedPrefix) || prevAlloc.demandId === d.id) {
          const list = previousRoomsByCourse.get(d.courseId) ?? [];
          list.push(prevAlloc.roomId);
          previousRoomsByCourse.set(d.courseId, list);
        }
      }
    }
  }

  const usableMachines = input.machines.filter((m) => m.status !== 'MAINTENANCE');
  const totalRequestedRooms = input.demands.reduce(
    (acc, d) => acc + d.roomsRequired + (d.extraMachine ? 1 : 0),
    0,
  );

  const bottlenecks: Bottleneck[] = [];
  if (totalRequestedRooms > usableMachines.length) {
    bottlenecks.push({
      id: `bn-capacity-${shift.id}`,
      shiftId: shift.id,
      kind: 'PARK_CAPACITY_EXCEEDED',
      severity: 'CRITICAL',
      messagePt: `Demanda total do turno (${totalRequestedRooms} salas) excede o parque de máquinas ativas (${usableMachines.length} aparelhos disponíveis). Faltam ${totalRequestedRooms - usableMachines.length} máquina(s).`,
      suggestedActionsPt: [
        'Ajustar a proporção de alunos por sala (ex.: 3 alunos/sala em turmas selecionadas).',
        'Reativar equipamento em manutenção ou cadastrar máquina de empréstimo/demo.',
      ],
    });
  }

  const sortedDemands = sortDemandsBySurrenderOrder(input.demands, coursesById);
  const usedMachineIds = new Set<string>();
  const usedRoomIds = new Set<string>();
  const allocations: Allocation[] = [];
  const explanationsById = new Map<string, AllocationExplanation>();
  const suggestedRoomsByDemandId: Record<string, string[]> = {};

  // Detecção de Conflito Triplo na Saúde da Mulher (RN03): ECOF + MEFE + GIOB no mesmo turno
  const activeCourseIds = new Set(input.demands.map((d) => d.courseId));
  const isTripleWomenConflict =
    activeCourseIds.has('pg-us-ecof') &&
    activeCourseIds.has('pg-us-mefe') &&
    activeCourseIds.has('pg-us-giob');

  // Passo 1: Determinar salas de cada demanda (DEC-A: escolhidas pelo operador; DEC-B: sugeridas)
  const roomsForDemand = new Map<string, string[]>();
  for (const demand of sortedDemands) {
    const targetCount = demand.roomsRequired + (demand.extraMachine ? 1 : 0);
    if (demand.chosenRooms.length > 0) {
      const validChosen = demand.chosenRooms.filter((rId) => roomsById.has(rId));
      roomsForDemand.set(demand.id, validChosen);
      suggestedRoomsByDemandId[demand.id] = validChosen;
      for (const rId of validChosen) {
        usedRoomIds.add(rId);
      }
    } else {
      // RN04: Se havia aparelhos compatíveis no 1º andar deixados pelo turno anterior (ex.: ECOF encerrou e GIOB continua),
      // priorizar reutilizar essas salas já montadas no 1º andar!
      const prevCompatibleFloor1Rooms: string[] = [];
      if (input.previousAllocations && !isTripleWomenConflict) {
        const rulesForCourse = new Set(
          input.courseRules
            .filter(
              (r) =>
                r.courseId === demand.courseId &&
                (r.quality === 'IDEAL' || r.quality === 'SECONDARY'),
            )
            .map((r) => r.machineId),
        );
        for (const prevAlloc of input.previousAllocations) {
          const room = roomsById.get(prevAlloc.roomId);
          if (
            room &&
            room.floor === 1 &&
            !usedRoomIds.has(room.id) &&
            !disabledRooms.has(room.id) &&
            rulesForCourse.has(prevAlloc.machineId)
          ) {
            prevCompatibleFloor1Rooms.push(room.id);
          }
        }
      }

      const prevSameCourseRooms = previousRoomsByCourse.get(demand.courseId) ?? [];
      const inheritedCandidates =
        prevSameCourseRooms.length > 0 ? prevSameCourseRooms : prevCompatibleFloor1Rooms;

      const preferSecondFloor = isTripleWomenConflict && demand.courseId === 'pg-us-giob';
      const suggested = suggestRoomBlockForCourse({
        courseId: demand.courseId,
        roomsRequired: targetCount,
        rooms: input.rooms,
        usedRoomIds,
        disabledRoomIds: disabledRooms,
        previousCourseRoomIds: inheritedCandidates,
        preferSecondFloor,
      });

      roomsForDemand.set(demand.id, suggested);
      suggestedRoomsByDemandId[demand.id] = suggested;
      for (const rId of suggested) {
        usedRoomIds.add(rId);
      }

      if (suggested.length < targetCount) {
        bottlenecks.push({
          id: `bn-rooms-${shift.id}-${demand.id}`,
          shiftId: shift.id,
          courseId: demand.courseId,
          kind: 'ROOM_UNAVAILABLE',
          severity: 'CRITICAL',
          messagePt: `Consultórios insuficientes para ${coursesById.get(demand.courseId)?.shortName ?? demand.courseId}: necessários ${targetCount}, disponíveis ${suggested.length}.`,
          suggestedActionsPt: [
            'Reativar consultórios pulados/desativados neste turno.',
            'Habilitar salas de expansão no 2º andar.',
          ],
        });
      }
    }
  }

  // Passo 2: Aplicar Travas Manuais (ManualLocks / Pins) com precedência absoluta
  const locksByRoom = new Map(input.manualLocks.map((l) => [l.roomId, l]));
  for (const lock of input.manualLocks) {
    const machine = machinesById.get(lock.machineId);
    const room = roomsById.get(lock.roomId);
    if (!machine || !room) continue;

    if (machine.status === 'MAINTENANCE') {
      bottlenecks.push({
        id: `bn-pin-${shift.id}-${lock.roomId}`,
        shiftId: shift.id,
        roomId: lock.roomId,
        kind: 'PIN_CONFLICT',
        severity: 'CRITICAL',
        messagePt: `Conflito em trava manual no consultório ${lock.roomId}: a máquina ${machine.internalLabel} entrou em manutenção.`,
        suggestedActionsPt: [
          `Escolher máquina substituta para o consultório ${lock.roomId} ou remover a trava.`,
        ],
      });
      continue;
    }

    if (usedMachineIds.has(machine.id)) {
      bottlenecks.push({
        id: `bn-pin-dup-${shift.id}-${lock.roomId}`,
        shiftId: shift.id,
        roomId: lock.roomId,
        kind: 'PIN_CONFLICT',
        severity: 'CRITICAL',
        messagePt: `Conflito em trava manual: a máquina ${machine.internalLabel} foi travada em mais de uma sala no mesmo turno.`,
        suggestedActionsPt: ['Remover uma das travas duplicadas ou permutar os aparelhos.'],
      });
      continue;
    }

    // Descobre a demanda dona da sala
    const ownerDemand =
      sortedDemands.find((d) => (roomsForDemand.get(d.id) ?? []).includes(room.id)) ??
      sortedDemands[0];
    if (!ownerDemand) continue;

    const course = coursesById.get(ownerDemand.courseId) ?? {
      id: ownerDemand.courseId,
      shortName: ownerDemand.courseId,
      fullName: ownerDemand.courseId,
    };

    const currentFloor: FloorNumber = input.previousMachineFloors[machine.id] ?? 1;
    const prevRoomId = previousMachineRoom.get(machine.id);
    const inherited = prevRoomId === room.id;

    const scoreEval = evaluateCandidateScore({
      quality: 'MANUAL',
      room,
      machineMobility: machine.mobility,
      currentMachineFloor: currentFloor,
      previousMachineRoomId: prevRoomId,
      config,
    });

    const allocationId = `alloc-${shift.id}-${ownerDemand.courseId}-${room.id}`;
    const allocation: Allocation = {
      id: allocationId,
      shiftId: shift.id,
      demandId: ownerDemand.id,
      roomId: room.id,
      machineId: machine.id,
      matchQuality: 'MANUAL',
      isPinned: true,
      inherited,
      score: scoreEval.totalScore,
    };

    const explanation = buildAllocationExplanation({
      allocationId,
      course,
      machine,
      room,
      quality: 'MANUAL',
      isPinned: true,
      inherited,
      fromFloor: currentFloor,
      scoreResult: scoreEval,
    });

    allocations.push(allocation);
    explanationsById.set(allocationId, explanation);
    usedMachineIds.add(machine.id);
  }

  // Passo 3: Alocar cada demanda na Ordem de Rendição (DEC-D)
  for (const demand of sortedDemands) {
    const course = coursesById.get(demand.courseId);
    if (!course) continue;

    const demandRooms = (roomsForDemand.get(demand.id) ?? []).filter(
      (rId) => !locksByRoom.has(rId) || !allocations.some((a) => a.roomId === rId),
    );

    if (demandRooms.length === 0) continue;

    // Tarefa 2.9 — Controle Manual (RN08): se o curso exige controle manual e o operador
    // não informou `manualMachineIds` para esta demanda, o motor pausa este curso e pede decisão humana!
    if (
      course.requiresManual &&
      (!demand.manualMachineIds || demand.manualMachineIds.length === 0)
    ) {
      bottlenecks.push({
        id: `bn-manual-${shift.id}-${demand.id}`,
        shiftId: shift.id,
        courseId: course.id,
        kind: 'MANUAL_CONTROL_REQUIRED',
        severity: 'WARNING',
        messagePt: `${course.shortName} exige controle manual pelo operador (${course.manualReason ?? 'validação de sonda/software'}). Selecione os aparelhos deste curso.`,
        suggestedActionsPt: [
          'Selecionar manualmente as máquinas do curso no painel da demanda.',
          'Travar (pin) os aparelhos desejados diretamente nos consultórios.',
        ],
      });
      continue;
    }

    // Se o operador forneceu `manualMachineIds` em um curso manual, restringimos às máquinas escolhidas
    const customRules: CourseMachineRule[] =
      demand.manualMachineIds && demand.manualMachineIds.length > 0
        ? demand.manualMachineIds.map((mId) => ({
            courseId: course.id,
            machineId: mId,
            quality: 'IDEAL' as RuleQuality,
          }))
        : input.courseRules;

    // Atribuição ótima sala a sala priorizando primeiro salas que já possuem máquina compatível herdada (RN04/RN06/RN07)
    const remainingRooms = [...demandRooms];

    // Subpasso 3A: Priorizar pares com herança direta na mesma sala (`previousRoomId === roomId`)
    for (const roomId of [...remainingRooms]) {
      const room = roomsById.get(roomId);
      if (!room) continue;

      const eligible = filterEligibleMachinesForCourse(
        course.id,
        input.machines,
        customRules,
        usedMachineIds,
      );
      const sameRoomCandidate = eligible.find(
        (cand) => previousMachineRoom.get(cand.machine.id) === room.id,
      );
      if (!sameRoomCandidate) continue;

      const { machine, quality } = sameRoomCandidate;
      const matchQuality: MatchQuality =
        demand.manualMachineIds && demand.manualMachineIds.length > 0 ? 'MANUAL' : quality;
      const currentFloor: FloorNumber = input.previousMachineFloors[machine.id] ?? 1;

      const scoreEval = evaluateCandidateScore({
        quality: matchQuality,
        room,
        machineMobility: machine.mobility,
        currentMachineFloor: currentFloor,
        previousMachineRoomId: room.id,
        config,
      });

      const allocationId = `alloc-${shift.id}-${course.id}-${room.id}`;
      allocations.push({
        id: allocationId,
        shiftId: shift.id,
        demandId: demand.id,
        roomId: room.id,
        machineId: machine.id,
        matchQuality,
        isPinned: false,
        inherited: true,
        score: scoreEval.totalScore,
      });
      explanationsById.set(
        allocationId,
        buildAllocationExplanation({
          allocationId,
          course,
          machine,
          room,
          quality: matchQuality,
          isPinned: false,
          inherited: true,
          fromFloor: currentFloor,
          scoreResult: scoreEval,
        }),
      );
      usedMachineIds.add(machine.id);
      remainingRooms.splice(remainingRooms.indexOf(roomId), 1);
    }

    // Subpasso 3B: Para as salas restantes do curso, ordenar salas por proximidade ao laudo e atribuir a máquina de maior Score
    remainingRooms.sort((rA, rB) => {
      const roomA = roomsById.get(rA)!;
      const roomB = roomsById.get(rB)!;
      if (roomA.reportProximity !== roomB.reportProximity) {
        return roomB.reportProximity - roomA.reportProximity;
      }
      if (roomA.floor !== roomB.floor) return roomA.floor - roomB.floor;
      return roomA.roomNumber - roomB.roomNumber;
    });

    let missingCount = 0;
    for (const roomId of remainingRooms) {
      const room = roomsById.get(roomId);
      if (!room) continue;

      const eligible = filterEligibleMachinesForCourse(
        course.id,
        input.machines,
        customRules,
        usedMachineIds,
      );

      if (eligible.length === 0) {
        missingCount += 1;
        continue;
      }

      // Avalia o Score de cada máquina elegível para esta sala e escolhe a melhor
      const scored = eligible
        .map((cand) => {
          const matchQuality: MatchQuality =
            demand.manualMachineIds && demand.manualMachineIds.length > 0
              ? 'MANUAL'
              : cand.quality;
          const currentFloor: FloorNumber = input.previousMachineFloors[cand.machine.id] ?? 1;
          const prevRoomId = previousMachineRoom.get(cand.machine.id);
          const scoreEval = evaluateCandidateScore({
            quality: matchQuality,
            room,
            machineMobility: cand.machine.mobility,
            currentMachineFloor: currentFloor,
            previousMachineRoomId: prevRoomId,
            config,
          });
          return {
            machine: cand.machine,
            matchQuality,
            currentFloor,
            inherited: prevRoomId === room.id,
            scoreEval,
          };
        })
        .sort((a, b) => {
          if (b.scoreEval.totalScore !== a.scoreEval.totalScore) {
            return b.scoreEval.totalScore - a.scoreEval.totalScore;
          }
          const qDiff = QUALITY_RANK[a.matchQuality] - QUALITY_RANK[b.matchQuality];
          if (qDiff !== 0) return qDiff;
          if (a.machine.tier !== b.machine.tier) return a.machine.tier - b.machine.tier;
          return a.machine.id.localeCompare(b.machine.id);
        });

      const best = scored[0]!;
      const allocationId = `alloc-${shift.id}-${course.id}-${room.id}`;
      allocations.push({
        id: allocationId,
        shiftId: shift.id,
        demandId: demand.id,
        roomId: room.id,
        machineId: best.machine.id,
        matchQuality: best.matchQuality,
        isPinned: false,
        inherited: best.inherited,
        score: best.scoreEval.totalScore,
      });
      explanationsById.set(
        allocationId,
        buildAllocationExplanation({
          allocationId,
          course,
          machine: best.machine,
          room,
          quality: best.matchQuality,
          isPinned: false,
          inherited: best.inherited,
          fromFloor: best.currentFloor,
          scoreResult: best.scoreEval,
        }),
      );
      usedMachineIds.add(best.machine.id);
    }

    if (missingCount > 0) {
      bottlenecks.push({
        id: `bn-shortage-${shift.id}-${demand.id}`,
        shiftId: shift.id,
        courseId: course.id,
        kind: 'NO_ELIGIBLE_MACHINE',
        severity: 'CRITICAL',
        messagePt: `Faltam ${missingCount} máquina(s) elegível(is) para ${course.shortName} após atender os cursos de maior prioridade.`,
        suggestedActionsPt: [
          `Habilitar aparelhos de contingência na matriz do curso ${course.shortName}.`,
          'Permutar manualmente um equipamento de outra turma.',
        ],
      });
    }
  }

  // Passo 4: Upgrade Progressivo com Limiar (RN05, Tarefa 2.10)
  for (let i = 0; i < allocations.length; i++) {
    const alloc = allocations[i]!;
    if (alloc.isPinned || alloc.matchQuality === 'IDEAL' || alloc.matchQuality === 'MANUAL') {
      continue;
    }

    const demand = sortedDemands.find((d) => d.id === alloc.demandId);
    const course = demand ? coursesById.get(demand.courseId) : undefined;
    const room = roomsById.get(alloc.roomId);
    if (!demand || !course || !room) continue;

    const freeIdealCandidates = filterEligibleMachinesForCourse(
      course.id,
      input.machines,
      input.courseRules,
      usedMachineIds,
    ).filter((c) => c.quality === 'IDEAL');

    if (freeIdealCandidates.length === 0) continue;

    let bestUpgrade: {
      machine: Machine;
      currentFloor: FloorNumber;
      scoreEval: ReturnType<typeof evaluateCandidateScore>;
    } | null = null;

    for (const cand of freeIdealCandidates) {
      const currentFloor: FloorNumber = input.previousMachineFloors[cand.machine.id] ?? 1;
      const prevRoomId = previousMachineRoom.get(cand.machine.id);
      const scoreEval = evaluateCandidateScore({
        quality: 'IDEAL',
        room,
        machineMobility: cand.machine.mobility,
        currentMachineFloor: currentFloor,
        previousMachineRoomId: prevRoomId,
        config,
      });

      if (
        scoreEval.totalScore - alloc.score >= config.upgradeThreshold &&
        (!bestUpgrade || scoreEval.totalScore > bestUpgrade.scoreEval.totalScore)
      ) {
        bestUpgrade = { machine: cand.machine, currentFloor, scoreEval };
      }
    }

    if (bestUpgrade) {
      usedMachineIds.delete(alloc.machineId);
      usedMachineIds.add(bestUpgrade.machine.id);

      const updatedAlloc: Allocation = {
        ...alloc,
        machineId: bestUpgrade.machine.id,
        matchQuality: 'IDEAL',
        inherited: false,
        score: bestUpgrade.scoreEval.totalScore,
      };
      allocations[i] = updatedAlloc;
      explanationsById.set(
        updatedAlloc.id,
        buildAllocationExplanation({
          allocationId: updatedAlloc.id,
          course,
          machine: bestUpgrade.machine,
          room,
          quality: 'IDEAL',
          isPinned: false,
          inherited: false,
          fromFloor: bestUpgrade.currentFloor,
          scoreResult: bestUpgrade.scoreEval,
        }),
      );
    }
  }

  // Ordena alocações por andar e número da sala para exibição determinística
  allocations.sort((a, b) => {
    const rA = roomsById.get(a.roomId);
    const rB = roomsById.get(b.roomId);
    if ((rA?.floor ?? 1) !== (rB?.floor ?? 1)) return (rA?.floor ?? 1) - (rB?.floor ?? 1);
    return (rA?.roomNumber ?? 0) - (rB?.roomNumber ?? 0);
  });

  // Passo 5: Calcular movimentações entre andares (`floorMoves`) e mapa atualizado
  const updatedMachineFloors: Record<string, FloorNumber> = { ...input.previousMachineFloors };
  const floorMoves: FloorTransportMove[] = [];

  for (const alloc of allocations) {
    const machine = machinesById.get(alloc.machineId);
    const room = roomsById.get(alloc.roomId);
    const demand = sortedDemands.find((d) => d.id === alloc.demandId);
    const course = demand ? coursesById.get(demand.courseId) : undefined;
    if (!machine || !room) continue;

    const fromFloor: FloorNumber = input.previousMachineFloors[machine.id] ?? 1;
    const toFloor: FloorNumber = room.floor;
    updatedMachineFloors[machine.id] = toFloor;

    if (fromFloor !== toFloor) {
      floorMoves.push({
        machineId: machine.id,
        machineLabel: machine.internalLabel,
        machineCode: machine.code,
        mobility: machine.mobility,
        fromFloor,
        toFloor,
        fromRoomId: previousMachineRoom.get(machine.id),
        toRoomId: room.id,
        courseShortName: course?.shortName ?? demand?.courseId ?? '',
      });
    }
  }

  const explanations = allocations
    .map((a) => explanationsById.get(a.id))
    .filter((e): e is AllocationExplanation => e !== undefined);

  return {
    shiftId: shift.id,
    allocations,
    explanations,
    bottlenecks,
    floorMoves,
    updatedMachineFloors,
    suggestedRoomsByDemandId,
  };
}

/**
 * Executa a alocação sequencial de todos os turnos da semana propagando
 * o estado físico das máquinas e a herança de salas turno a turno.
 */
export function allocateWeek(input: WeekAllocationInput): WeekAllocationResult {
  const resultsByShiftId: Record<string, ShiftAllocationResult> = {};
  let currentFloors: Record<string, FloorNumber> = { ...input.initialMachineFloors };
  let previousAllocations: Allocation[] | undefined = undefined;
  let previousDemands: ShiftDemand[] | undefined = undefined;
  let totalFloorMoves = 0;
  const footerNotes: string[] = [];

  for (const shift of input.shifts) {
    const demands = input.demandsByShiftId[shift.id] ?? [];
    const manualLocks = input.manualLocksByShiftId[shift.id] ?? [];
    const disabledRoomIds = input.disabledRoomsByShiftId?.[shift.id] ?? [];

    const result = allocateShift({
      shift,
      demands,
      machines: input.machines,
      rooms: input.rooms,
      courses: input.courses,
      courseRules: input.courseRules,
      manualLocks,
      disabledRoomIds,
      previousAllocations,
      previousDemands,
      previousMachineFloors: currentFloors,
      config: input.config,
    });

    resultsByShiftId[shift.id] = result;
    totalFloorMoves += result.floorMoves.length;

    if (result.floorMoves.length > 0 && previousAllocations && previousAllocations.length > 0) {
      const descidas = result.floorMoves.filter((m) => m.fromFloor === 2 && m.toFloor === 1);
      const subidas = result.floorMoves.filter((m) => m.fromFloor === 1 && m.toFloor === 2);
      if (descidas.length > 0) {
        footerNotes.push(
          `*TRANSIÇÃO ${shift.label}: DESCENDO ${descidas.length} APARELHO(S) (${descidas.map((d) => d.machineCode).join(', ')}) DO 2º PARA O 1º ANDAR PARA OTIMIZAR A ESCALA E POUPAR RECLAMAÇÕES*`,
        );
      }
      if (subidas.length > 0) {
        footerNotes.push(
          `*TRANSIÇÃO ${shift.label}: SUBINDO ${subidas.length} APARELHO(S) (${subidas.map((s) => s.machineCode).join(', ')}) PARA O 2º ANDAR*`,
        );
      }
    }

    currentFloors = result.updatedMachineFloors;
    if (result.allocations.length > 0) {
      previousAllocations = result.allocations;
      previousDemands = demands;
    }
  }

  return {
    resultsByShiftId,
    totalFloorMoves,
    suggestedFooterNotePt: footerNotes.join('\n'),
  };
}

export interface MaintenanceRecalcInput {
  brokenMachineId: string;
  shiftId: string;
  currentAllocations: ReadonlyArray<Allocation>;
  currentExplanations: ReadonlyArray<AllocationExplanation>;
  demands: ReadonlyArray<ShiftDemand>;
  machines: ReadonlyArray<Machine>;
  rooms: ReadonlyArray<ConsultingRoom>;
  courses: ReadonlyArray<Course>;
  courseRules: ReadonlyArray<CourseMachineRule>;
  machineFloors: Record<string, FloorNumber>;
  config: EngineConfig;
}

/**
 * Tarefa 2.12 — Menor mudança possível em quebra de máquina (DEC-E):
 * Mantém 100% das outras salas intactas e propõe substituir apenas a sala
 * onde a máquina quebrada estava alocada.
 */
export function recalculateOnMachineMaintenance(
  input: MaintenanceRecalcInput,
): MaintenanceQuarantineProposal | null {
  const targetAlloc = input.currentAllocations.find(
    (a) => a.shiftId === input.shiftId && a.machineId === input.brokenMachineId,
  );
  if (!targetAlloc) {
    return null;
  }

  const demand = input.demands.find((d) => d.id === targetAlloc.demandId);
  const course = demand
    ? input.courses.find((c) => c.id === demand.courseId)
    : undefined;
  const room = input.rooms.find((r) => r.id === targetAlloc.roomId);
  const brokenMachine = input.machines.find((m) => m.id === input.brokenMachineId);

  if (!demand || !course || !room) {
    return null;
  }

  const usedMachineIds = new Set(
    input.currentAllocations
      .filter((a) => a.id !== targetAlloc.id)
      .map((a) => a.machineId),
  );
  usedMachineIds.add(input.brokenMachineId);

  const usableMachines = input.machines.map((m) =>
    m.id === input.brokenMachineId ? { ...m, status: 'MAINTENANCE' as const } : m,
  );

  const eligible = filterEligibleMachinesForCourse(
    course.id,
    usableMachines,
    input.courseRules,
    usedMachineIds,
  );

  if (eligible.length === 0) {
    return {
      brokenMachineId: input.brokenMachineId,
      shiftId: input.shiftId,
      affectedRoomId: room.id,
      affectedCourseId: course.id,
      replacementMachineId: null,
      replacementQuality: null,
      updatedAllocations: input.currentAllocations.filter((a) => a.id !== targetAlloc.id),
      updatedExplanations: input.currentExplanations.filter(
        (e) => e.allocationId !== targetAlloc.id,
      ),
      alertMessagePt: `ALERTA DE MANUTENÇÃO: ${brokenMachine?.internalLabel ?? input.brokenMachineId} no consultório ${room.id} (${course.shortName}) entrou em manutenção e não há máquina substituta elegível livre no turno.`,
      footerNoteSuggestionPt: `*ALTERAÇÃO DE CONTINGÊNCIA: ${brokenMachine?.code ?? input.brokenMachineId} EM MANUTENÇÃO NO CONSULTÓRIO ${room.id} (${course.shortName})*`,
    };
  }

  const scored = eligible
    .map((cand) => {
      const fromFloor: FloorNumber = input.machineFloors[cand.machine.id] ?? 1;
      const scoreEval = evaluateCandidateScore({
        quality: cand.quality,
        room,
        machineMobility: cand.machine.mobility,
        currentMachineFloor: fromFloor,
        config: input.config,
      });
      return { ...cand, fromFloor, scoreEval };
    })
    .sort((a, b) => b.scoreEval.totalScore - a.scoreEval.totalScore);

  const best = scored[0]!;
  const updatedAlloc: Allocation = {
    ...targetAlloc,
    machineId: best.machine.id,
    matchQuality: best.quality,
    inherited: false,
    score: best.scoreEval.totalScore,
  };

  const updatedExp = buildAllocationExplanation({
    allocationId: updatedAlloc.id,
    course,
    machine: best.machine,
    room,
    quality: best.quality,
    isPinned: updatedAlloc.isPinned,
    inherited: false,
    fromFloor: best.fromFloor,
    scoreResult: best.scoreEval,
  });

  return {
    brokenMachineId: input.brokenMachineId,
    shiftId: input.shiftId,
    affectedRoomId: room.id,
    affectedCourseId: course.id,
    replacementMachineId: best.machine.id,
    replacementQuality: best.quality,
    updatedAllocations: input.currentAllocations.map((a) =>
      a.id === targetAlloc.id ? updatedAlloc : a,
    ),
    updatedExplanations: input.currentExplanations.map((e) =>
      e.allocationId === targetAlloc.id ? updatedExp : e,
    ),
    alertMessagePt: `PROPOSTA DE MENOR MUDANÇA (DEC-E): Substituir apenas ${brokenMachine?.internalLabel ?? input.brokenMachineId} por ${best.machine.internalLabel} (${best.quality}) no consultório ${room.id} (${course.shortName}). Todas as outras ${input.currentAllocations.length - 1} salas permanecem inalteradas.`,
    footerNoteSuggestionPt: `*ALTERAÇÃO: SUBSTITUIÇÃO DE ${brokenMachine?.code ?? input.brokenMachineId} (MANUTENÇÃO) POR ${best.machine.code} NA SALA ${room.id} (${course.shortName})*`,
  };
}

