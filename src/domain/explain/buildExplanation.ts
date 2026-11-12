import type { ScoreEvaluationResult } from '@/domain/scoring/terms';
import type {
  AllocationExplanation,
  ConsultingRoom,
  Course,
  FloorNumber,
  Machine,
  MatchQuality,
} from '@/domain/types';

export interface BuildExplanationInput {
  allocationId: string;
  course: Pick<Course, 'shortName' | 'fullName'>;
  machine: Pick<Machine, 'internalLabel' | 'code'>;
  room: Pick<ConsultingRoom, 'id' | 'floor' | 'zone' | 'reportProximity'>;
  quality: MatchQuality;
  isPinned: boolean;
  inherited: boolean;
  fromFloor: FloorNumber;
  scoreResult: ScoreEvaluationResult;
}

function describeClinicalFit(quality: MatchQuality, courseName: string): string {
  switch (quality) {
    case 'IDEAL':
      return `Atende 100% dos requisitos de ${courseName} (1ª opção)`;
    case 'SECONDARY':
      return `Atende como 2ª opção compatível para ${courseName}`;
    case 'CONTINGENCY':
      return `Alocado em contingência operacional para ${courseName}`;
    case 'MANUAL':
      return `Fixado manualmente pelo operador para ${courseName}`;
  }
}

function describeReportingProximity(room: Pick<ConsultingRoom, 'zone' | 'reportProximity'>): string {
  if (room.zone === 1 || room.reportProximity >= 25) {
    return 'possui PC de laudo integrado (Zona 1)';
  }
  if (room.zone === 2 || room.reportProximity > 0) {
    return 'localizado na periferia do 1º andar (Zona 2)';
  }
  return 'alocado na área de expansão do 2º andar (Zona 3)';
}

function describeFloorTransport(
  fromFloor: FloorNumber,
  toFloor: FloorNumber,
  inherited: boolean,
): string {
  if (inherited) {
    return `mantido na mesma sala do turno anterior (zero movimentação)`;
  }
  if (fromFloor === toFloor) {
    return `evita transporte entre andares (equipamento já se encontra no ${toFloor}º andar)`;
  }
  return `exige transporte do ${fromFloor}º para o ${toFloor}º andar`;
}

/**
 * Constrói a explicação determinística e auditável em PT-BR no padrão do
 * few-shot reference do projeto.
 */
export function buildAllocationExplanation(
  input: BuildExplanationInput,
): AllocationExplanation {
  const { scoreResult } = input;

  const baseFormula =
    `Score_Final = (w1 * Fit_Clinico [${scoreResult.rawFit}]) + ` +
    `(w2 * Bonus_PC_Laudo [${scoreResult.rawProximity}]) - ` +
    `(w3 * Penalidade_Andar [${scoreResult.rawTransportPenalty}])`;

  const formulaPt =
    scoreResult.rawStability > 0
      ? `${baseFormula} + (w4 * Bonus_Heranca [${scoreResult.rawStability}]) = ${scoreResult.totalScore} pts`
      : `${baseFormula} = ${scoreResult.totalScore} pts`;

  const fitClause = describeClinicalFit(input.quality, input.course.shortName);
  const proximityClause = describeReportingProximity(input.room);
  const transportClause = describeFloorTransport(
    input.fromFloor,
    input.room.floor,
    input.inherited,
  );

  const pinPrefix = input.isPinned ? '[Trava Manual] ' : '';
  const textPt =
    `${pinPrefix}Alocado no Consultório ${input.room.id} (Score: ${scoreResult.totalScore}): ` +
    `${fitClause}, ${proximityClause} e ${transportClause}.`;

  return {
    allocationId: input.allocationId,
    fitTerm: scoreResult.weightedFit,
    proximityTerm: scoreResult.weightedProximity,
    transportTerm: -scoreResult.weightedTransportPenalty,
    stabilityTerm: scoreResult.weightedStability,
    formulaPt,
    textPt,
  };
}

