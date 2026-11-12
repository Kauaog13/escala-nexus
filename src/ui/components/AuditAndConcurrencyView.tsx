import { useState } from 'react';
import {
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  Download,
  History,
  ShieldCheck,
  Sliders,
  Upload,
} from 'lucide-react';
import { useNexusStore } from '@/application/store';

export function AuditAndConcurrencyView() {
  const {
    shifts,
    allocations,
    bottlenecksByShiftId,
    floorMovesByShiftId,
    engineConfig,
    scheduleVersions,
    overrideCounterByCourseId,
    courses,
    lastCalculationMs,
    auditLog,
    saveShiftTransactional,
    updateEngineWeights,
    exportBackupJson,
    importBackupJson,
    restoreScheduleVersion,
  } = useNexusStore();

  const [selectedShiftId, setSelectedShiftId] = useState(
    shifts[2]?.id ?? shifts[0]?.id ?? 'shift-sabado-manha',
  );
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    message: string;
    isVersionConflict?: boolean;
  } | null>(null);
  const [importText, setImportText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  const selectedShift = shifts.find((s) => s.id === selectedShiftId) ?? shifts[0];

  // Métricas Kaizen (Sprint 4 — Tarefas 4.2 e 4.3)
  const totalAllocations = allocations.length;
  const idealAllocations = allocations.filter((a) => a.matchQuality === 'IDEAL').length;
  const inheritedAllocations = allocations.filter((a) => a.inherited).length;
  const pinnedAllocations = allocations.filter((a) => a.isPinned).length;
  const totalFloorMoves = Object.values(floorMovesByShiftId).reduce(
    (acc, list) => acc + list.length,
    0,
  );
  const totalBottlenecks = Object.values(bottlenecksByShiftId).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  const idealPct =
    totalAllocations > 0 ? Math.round((idealAllocations / totalAllocations) * 100) : 0;
  const inheritedPct =
    totalAllocations > 0 ? Math.round((inheritedAllocations / totalAllocations) * 100) : 0;

  function handleDownloadJsonBackup() {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRestoreJsonBackup(e: React.FormEvent) {
    e.preventDefault();
    try {
      importBackupJson(importText);
      setFeedback({ type: 'ok', message: 'Backup JSON restaurado com sucesso!' });
      setShowImportBox(false);
      setImportText('');
    } catch (err) {
      setFeedback({
        type: 'err',
        message: err instanceof Error ? err.message : 'Falha ao importar JSON.',
      });
    }
  }

  function handleValidCommit() {
    if (!selectedShift) return;
    try {
      const currentShiftAllocs = allocations.filter((a) => a.shiftId === selectedShift.id);
      saveShiftTransactional({
        shiftId: selectedShift.id,
        expectedVersion: selectedShift.version,
        allocations: currentShiftAllocs,
      });
      setFeedback({
        type: 'ok',
        message: `Transação concluída com sucesso! Versão do turno incrementada para v${selectedShift.version + 1}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        message: err instanceof Error ? err.message : 'Erro desconhecido.',
      });
    }
  }

  function handleStaleVersionTest() {
    if (!selectedShift) return;
    try {
      saveShiftTransactional({
        shiftId: selectedShift.id,
        expectedVersion: selectedShift.version - 1,
        allocations: [],
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        message: err instanceof Error ? err.message : 'Conflito detectado.',
        isVersionConflict: true,
      });
    }
  }

  function handleDuplicateMachineTest() {
    if (!selectedShift) return;
    try {
      saveShiftTransactional({
        shiftId: selectedShift.id,
        expectedVersion: selectedShift.version,
        allocations: [
          {
            id: 'dup-1',
            shiftId: selectedShift.id,
            demandId: 'demand-1',
            roomId: '1A-06',
            machineId: 'v7',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 130,
          },
          {
            id: 'dup-2',
            shiftId: selectedShift.id,
            demandId: 'demand-2',
            roomId: '1A-14',
            machineId: 'v7',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 110,
          },
        ],
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        message: err instanceof Error ? err.message : 'Duplicidade bloqueada.',
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* Painel de Métricas Operacionais Kaizen & Calibração de Pesos (Sprint 4 — Tarefas 4.2 a 4.5) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-nexus-border bg-nexus-white p-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-nexus-green" />
              <h3 className="text-sm font-semibold text-nexus-black">
                Telemetria & Métricas Operacionais Kaizen (Sprint 4)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="inline-flex items-center gap-1 rounded border border-nexus-border bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Backup (.json)
              </button>
              <button
                type="button"
                onClick={() => setShowImportBox((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-nexus-border bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <Upload className="h-3.5 w-3.5" /> Importar (.json)
              </button>
            </div>
          </div>

          {showImportBox && (
            <form onSubmit={handleRestoreJsonBackup} className="mt-3 space-y-2">
              <textarea
                rows={3}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Cole aqui o conteúdo do arquivo .json de backup..."
                className="w-full rounded border border-nexus-border p-2 font-mono text-xs"
              />
              <button
                type="submit"
                className="rounded bg-nexus-black px-3 py-1 text-xs font-semibold text-white"
              >
                Restaurar Estado
              </button>
            </form>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded border border-nexus-border bg-zinc-50 p-2.5">
              <span className="text-[11px] text-zinc-500">Match Ideal (1ª Opção)</span>
              <div className="text-lg font-bold text-nexus-green-deep">{idealPct}%</div>
              <span className="text-[10px] text-zinc-500">
                {idealAllocations} de {totalAllocations} alocações
              </span>
            </div>

            <div className="rounded border border-nexus-border bg-zinc-50 p-2.5">
              <span className="text-[11px] text-zinc-500">Estabilidade (Herança)</span>
              <div className="text-lg font-bold text-nexus-black">{inheritedPct}%</div>
              <span className="text-[10px] text-zinc-500">
                {inheritedAllocations} salas sem troca
              </span>
            </div>

            <div className="rounded border border-nexus-border bg-zinc-50 p-2.5">
              <span className="text-[11px] text-zinc-500">Transporte entre Andares</span>
              <div className="text-lg font-bold text-amber-800">{totalFloorMoves}</div>
              <span className="text-[10px] text-zinc-500">movimentos na semana</span>
            </div>

            <div className="rounded border border-nexus-border bg-zinc-50 p-2.5">
              <span className="text-[11px] text-zinc-500">Tempo Motor / Pins</span>
              <div className="text-lg font-bold text-nexus-black">{lastCalculationMs} ms</div>
              <span className="text-[10px] text-zinc-500">
                {pinnedAllocations} travas • {totalBottlenecks} gargalos
              </span>
            </div>
          </div>

          {/* Frequência de Override Manual por Curso */}
          <div className="mt-3 border-t border-nexus-border pt-2.5 text-xs">
            <span className="font-semibold text-zinc-700">
              Feedback Loop — Overrides Manuais por Curso (para calibrar w1..w4):
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.keys(overrideCounterByCourseId).length === 0 ? (
                <span className="text-zinc-400">
                  Nenhuma intervenção manual registrada ainda nesta sessão.
                </span>
              ) : (
                Object.entries(overrideCounterByCourseId).map(([courseId, count]) => {
                  const c = courses.find((item) => item.id === courseId);
                  return (
                    <span
                      key={courseId}
                      className="rounded border border-nexus-amber bg-amber-50 px-2 py-0.5 font-medium text-amber-950"
                    >
                      {c?.shortName ?? courseId}: {count} override(s)
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Calibração dos Pesos Desacoplados (w1, w2, w3, w4 e Limiar de Upgrade) */}
        <div className="rounded-lg border border-nexus-border bg-nexus-white p-4 lg:col-span-5">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-nexus-green" />
            <h3 className="text-sm font-semibold text-nexus-black">
              Calibração de Pesos do Motor (w1..w4)
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Ajuste os pesos da função objetivo sem alterar código. A escala é recalculada
            instantaneamente.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block font-medium text-zinc-700">
                w1 — Adequação Clínica ({engineConfig.w1Fit})
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={10}
                value={engineConfig.w1Fit}
                onChange={(e) => updateEngineWeights({ w1Fit: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-nexus-border px-2 py-1"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700">
                w2 — Proximidade Laudo ({engineConfig.w2Proximity})
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={10}
                value={engineConfig.w2Proximity}
                onChange={(e) => updateEngineWeights({ w2Proximity: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-nexus-border px-2 py-1"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700">
                w3 — Penalidade Escada ({engineConfig.w3Transport})
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={20}
                value={engineConfig.w3Transport}
                onChange={(e) => updateEngineWeights({ w3Transport: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-nexus-border px-2 py-1"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700">
                w4 — Bônus Herança ({engineConfig.w4Stability})
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={10}
                value={engineConfig.w4Stability}
                onChange={(e) => updateEngineWeights({ w4Stability: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-nexus-border px-2 py-1"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-medium text-zinc-700">
                Limiar de Upgrade Progressivo RN05 ({engineConfig.upgradeThreshold} pts)
              </label>
              <input
                type="number"
                step="5"
                min={0}
                max={100}
                value={engineConfig.upgradeThreshold}
                onChange={(e) =>
                  updateEngineWeights({ upgradeThreshold: Number(e.target.value) })
                }
                className="mt-1 w-full rounded border border-nexus-border px-2 py-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Versões da Escala (RF08 e RN11) */}
      {scheduleVersions.length > 0 && (
        <div className="rounded-lg border border-nexus-border bg-nexus-white p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-nexus-green" />
            <h4 className="text-sm font-semibold text-nexus-black">
              Histórico de Versões da Escala ({scheduleVersions.length})
            </h4>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {scheduleVersions.map((ver) => (
              <div
                key={ver.id}
                className="flex items-center gap-2 rounded border border-nexus-border bg-zinc-50 px-3 py-1.5"
              >
                <div>
                  <span className="font-semibold text-nexus-black">{ver.label}</span> •{' '}
                  <span className="text-zinc-600">{ver.createdBy}</span> ({ver.allocationsCount}{' '}
                  alocações)
                </div>
                {ver.snapshotAllocations && (
                  <button
                    type="button"
                    onClick={() => {
                      restoreScheduleVersion(ver.id);
                      setFeedback({
                        type: 'ok',
                        message: `Versão "${ver.label}" restaurada com sucesso!`,
                      });
                    }}
                    className="rounded bg-nexus-black px-2 py-0.5 text-[11px] font-medium text-white hover:bg-nexus-surface"
                  >
                    Restaurar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulador de Concorrência Otimista e RN10 */}
      <div className="rounded-lg border border-nexus-border bg-nexus-white p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-nexus-green" />
          <h3 className="text-sm font-semibold text-nexus-black">
            Verificação Transacional & Concorrência Otimista (Tarefas 1.4 e 1.10)
          </h3>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          Cada turno possui controle estrito de versão (<code>version</code>) e restrições{' '}
          <code>UNIQUE (shift_id, machine_id)</code> e <code>UNIQUE (shift_id, room_id)</code>.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedShift?.id}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="rounded border border-nexus-border bg-white px-3 py-1.5 text-xs font-medium"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — Versão atual: v{s.version}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleValidCommit}
            className="rounded bg-nexus-green px-3 py-1.5 text-xs font-medium text-nexus-white hover:bg-nexus-green-dark"
          >
            Salvar Turno Válido (v{selectedShift?.version} → v{(selectedShift?.version ?? 1) + 1})
          </button>

          <button
            type="button"
            onClick={handleStaleVersionTest}
            className="rounded border border-nexus-amber bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Simular Conflito de Versão (409)
          </button>

          <button
            type="button"
            onClick={handleDuplicateMachineTest}
            className="rounded border border-nexus-red bg-red-50 px-3 py-1.5 text-xs font-medium text-nexus-red hover:bg-red-100"
          >
            Simular Duplicidade de V7 (RN10)
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded border p-2.5 text-xs ${
              feedback.type === 'ok'
                ? 'border-nexus-green bg-nexus-green-light text-nexus-green-deep'
                : 'border-nexus-red bg-red-50 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertOctagon className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>

            {feedback.isVersionConflict && selectedShift && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFeedback({
                      type: 'ok',
                      message: `Versão v${selectedShift.version} do turno ${selectedShift.label} recarregada com sucesso (§5.6).`,
                    })
                  }
                  className="rounded border border-red-300 bg-white px-2.5 py-1 font-medium text-red-900 hover:bg-red-100"
                >
                  Recarregar Versão Atual (v{selectedShift.version})
                </button>
                <button
                  type="button"
                  onClick={handleValidCommit}
                  className="rounded bg-nexus-black px-2.5 py-1 font-semibold text-white hover:bg-nexus-surface"
                >
                  Mesclar e Forçar Sobrescrita (v{selectedShift.version} → v
                  {selectedShift.version + 1})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabela de Audit Log */}
      <div className="rounded-lg border border-nexus-border bg-nexus-white">
        <div className="border-b border-nexus-border px-4 py-3">
          <h4 className="text-sm font-semibold text-nexus-black">
            Registro de Auditoria Operacional ({auditLog.length} eventos)
          </h4>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-nexus-border bg-zinc-50 text-zinc-600">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Data / Hora</th>
                <th className="px-3 py-2">Operador (updated_by)</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-border">
              {auditLog.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-zinc-500">{entry.id}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {new Date(entry.createdAt).toLocaleTimeString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 font-medium text-nexus-black">{entry.actor}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-600">
                    {entry.details ? JSON.stringify(entry.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
