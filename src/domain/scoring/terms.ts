import type {
  ConsultingRoom,
  EngineConfig,
  FloorNumber,
  MatchQuality,
  MobilityWeight,
} from '@/domain/types';

export const CLINICAL_FIT_BASE: Record<MatchQuality, number> = {
  IDEAL: 100,
  SECONDARY: 60,
  CONTINGENCY: 20,
  MANUAL: 100,
};

export const MOBILITY_TRANSPORT_COST: Record<MobilityWeight, number> = {
  HEAVY: 5,
  MEDIUM: 3,
  LIGHT: 2,
  PORTABLE: 1,
};

export const SAME_ROOM_INHERITANCE_BONUS = 40;

/**
 * Termo 1 — Adequação Clínica (`Fit_Clinico`):
 * 1ª opção (`IDEAL`) = 100, 2ª opção (`SECONDARY`) = 60, contingência (`CONTINGENCY`) = 20.
 */
export function calculateClinicalFit(quality: MatchQuality): number {
  return CLINICAL_FIT_BASE[quality];
}

/**
 * Termo 2 — Bônus de Proximidade aos Computadores de Laudo (`Bonus_PC_Laudo`):
 * Zona 1 = 30, Zona 2 = 10, Zona 3 = 0 (ou valor customizado na sala).
 */
export function calculateProximityBonus(room: Pick<ConsultingRoom, 'reportProximity'>): number {
  return room.reportProximity;
}

/**
 * Termo 3 — Penalidade de Transporte entre Andares (`Penalidade_Andar`):
 * 0 quando a máquina permanece no mesmo andar; caso contrário, proporcional ao peso físico.
 */
export function calculateFloorTransportPenalty(
  mobility: MobilityWeight,
  currentFloor: FloorNumber,
  targetFloor: FloorNumber,
): number {
  if (currentFloor === targetFloor) {
    return 0;
  }
  return MOBILITY_TRANSPORT_COST[mobility];
}

/**
 * Termo 4 — Bônus de Estabilidade / Herança de Sala (`Bonus_Heranca` — RN04, RN06, RN07):
 * +40 pontos quando o aparelho já estava naquela mesma sala no turno imediatamente anterior.
 */
export function calculateStabilityBonus(
  previousRoomId: string | undefined,
  targetRoomId: string,
): number {
  if (!previousRoomId) {
    return 0;
  }
  return previousRoomId === targetRoomId ? SAME_ROOM_INHERITANCE_BONUS : 0;
}

export interface ScoreEvaluationInput {
  quality: MatchQuality;
  room: Pick<ConsultingRoom, 'reportProximity' | 'floor' | 'id'>;
  machineMobility: MobilityWeight;
  currentMachineFloor: FloorNumber;
  previousMachineRoomId?: string;
  config: Pick<EngineConfig, 'w1Fit' | 'w2Proximity' | 'w3Transport' | 'w4Stability'>;
}

export interface ScoreEvaluationResult {
  rawFit: number;
  rawProximity: number;
  rawTransportPenalty: number;
  rawStability: number;
  weightedFit: number;
  weightedProximity: number;
  weightedTransportPenalty: number;
  weightedStability: number;
  totalScore: number;
}

/**
 * Função Objetivo Desacoplada:
 * Score_Final = (w1 * Fit_Clinico) + (w2 * Bonus_PC_Laudo) - (w3 * Penalidade_Andar) + (w4 * Bonus_Heranca)
 */
export function evaluateCandidateScore(input: ScoreEvaluationInput): ScoreEvaluationResult {
  const rawFit = calculateClinicalFit(input.quality);
  const rawProximity = calculateProximityBonus(input.room);
  const rawTransportPenalty = calculateFloorTransportPenalty(
    input.machineMobility,
    input.currentMachineFloor,
    input.room.floor,
  );
  const rawStability = calculateStabilityBonus(input.previousMachineRoomId, input.room.id);

  const weightedFit = Number((input.config.w1Fit * rawFit).toFixed(2));
  const weightedProximity = Number((input.config.w2Proximity * rawProximity).toFixed(2));
  const weightedTransportPenalty = Number(
    (input.config.w3Transport * rawTransportPenalty).toFixed(2),
  );
  const weightedStability = Number((input.config.w4Stability * rawStability).toFixed(2));

  const totalScore = Number(
    (weightedFit + weightedProximity - weightedTransportPenalty + weightedStability).toFixed(2),
  );

  return {
    rawFit,
    rawProximity,
    rawTransportPenalty,
    rawStability,
    weightedFit,
    weightedProximity,
    weightedTransportPenalty,
    weightedStability,
    totalScore,
  };
}

