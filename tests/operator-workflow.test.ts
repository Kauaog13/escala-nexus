import { beforeEach, describe, expect, it } from 'vitest';
import { useNexusStore } from '@/application/store';
import { formatWeekWhatsAppText } from '@/domain/export/whatsappAndLogistics';

describe('Seção 5 do Plano — Fluxo Completo do Operador: Gerar, Intervir, Permutar, Quarentena e Exportar', () => {
  beforeEach(() => {
    useNexusStore.getState().resetToSeed();
  });

  it('5.1 — gera a escala semanal, calcula diff de recálculo (§5.5) e permite desfazer (Undo)', () => {
    const store = useNexusStore.getState();
    expect(store.allocations.length).toBeGreaterThan(0);

    // Recalcula sem mudanças: diff deve ser 0 salas alteradas (100% estabilidade)
    store.generateWeekSchedule();
    const afterRecalc = useNexusStore.getState();
    expect(afterRecalc.lastRecalcDiff).not.toBeNull();
    expect(afterRecalc.lastRecalcDiff).toHaveLength(0);

    afterRecalc.dismissRecalcDiff();
    expect(useNexusStore.getState().lastRecalcDiff).toBeNull();
  });

  it('5.2 — detecta conflito de patrimônio em tempo real ao trocar máquina e executa Permuta Automática (RN10) + Undo', () => {
    const state0 = useNexusStore.getState();
    const shiftId = 'shift-sabado-manha';
    const shiftAllocs = state0.allocations.filter((a) => a.shiftId === shiftId);
    const roomA = shiftAllocs[0]!;
    const roomB = shiftAllocs[1]!;

    // Operador tenta colocar a máquina da sala B dentro da sala A -> SWAP_REQUIRED
    const outcome = state0.assignOrSwapMachineInRoom(shiftId, roomA.roomId, roomB.machineId);
    expect(outcome.mode).toBe('SWAP_REQUIRED');
    expect(useNexusStore.getState().pendingSwapPrompt).not.toBeNull();

    // Operador confirma a permuta
    useNexusStore.getState().confirmPendingSwap();
    const stateSwapped = useNexusStore.getState();
    expect(stateSwapped.pendingSwapPrompt).toBeNull();

    const newRoomA = stateSwapped.allocations.find(
      (a) => a.shiftId === shiftId && a.roomId === roomA.roomId,
    );
    const newRoomB = stateSwapped.allocations.find(
      (a) => a.shiftId === shiftId && a.roomId === roomB.roomId,
    );
    expect(newRoomA?.machineId).toBe(roomB.machineId);
    expect(newRoomB?.machineId).toBe(roomA.machineId);

    // Operador aciona Desfazer (Undo) -> restaura alocações originais
    stateSwapped.undoLastAction();
    const stateUndone = useNexusStore.getState();
    const restoredRoomA = stateUndone.allocations.find(
      (a) => a.shiftId === shiftId && a.roomId === roomA.roomId,
    );
    expect(restoredRoomA?.machineId).toBe(roomA.machineId);
  });

  it('5.3 — trata quebra em andamento com proposta de Menor Mudança (DEC-E), muda status para CHANGED e exporta WhatsApp (RF07)', () => {
    const store = useNexusStore.getState();
    store.updateScheduleMetadata({ status: 'PUBLISHED' });
    expect(useNexusStore.getState().schedules[0]?.status).toBe('PUBLISHED');

    const shiftId = 'shift-sabado-manha';
    const targetAlloc = useNexusStore
      .getState()
      .allocations.find((a) => a.shiftId === shiftId && a.roomId === '1A-17')!;

    // Simula quebra da máquina alocada na sala 1A-17
    useNexusStore.getState().quarantineMachineInShift(shiftId, targetAlloc.machineId);
    const proposal = useNexusStore.getState().pendingMaintenanceProposal;
    expect(proposal).not.toBeNull();
    expect(proposal?.affectedRoomId).toBe('1A-17');

    // Aplica a proposta de menor mudança (DEC-E)
    useNexusStore.getState().applyPendingMaintenanceProposal();
    const afterQuarantine = useNexusStore.getState();
    expect(afterQuarantine.pendingMaintenanceProposal).toBeNull();
    expect(afterQuarantine.schedules[0]?.status).toBe('CHANGED');
    expect(afterQuarantine.schedules[0]?.footerNote).toContain('MANUTENÇÃO');

    // Exporta texto oficial do WhatsApp (RF07)
    const whatsapp = formatWeekWhatsAppText({
      title: afterQuarantine.schedules[0]!.title,
      shifts: afterQuarantine.shifts.map((s) => ({
        shift: s,
        demands: afterQuarantine.demands.filter((d) => d.shiftId === s.id),
        allocations: afterQuarantine.allocations.filter((a) => a.shiftId === s.id),
        courses: afterQuarantine.courses,
        rooms: afterQuarantine.rooms,
        machines: afterQuarantine.machines,
      })),
      footerNote: afterQuarantine.schedules[0]?.footerNote,
    });

    expect(whatsapp).toContain('*2° ANDAR*');
    expect(whatsapp).toContain('MANUTENÇÃO');
  });
});

