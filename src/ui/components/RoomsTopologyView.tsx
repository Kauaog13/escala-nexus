import { useNexusStore } from '@/application/store';
import type { RadialZone } from '@/domain/types';

const ZONE_INFO: Record<RadialZone, { title: string; proximityDefault: number; badge: string }> = {
  1: {
    title: 'Zona 1 — Núcleo de Alta Proximidade ao Laudo (1º Andar)',
    proximityDefault: 30,
    badge: 'border-nexus-green bg-nexus-green-light text-nexus-green-deep',
  },
  2: {
    title: 'Zona 2 — Periferia dos Corredores (1º Andar)',
    proximityDefault: 10,
    badge: 'border-nexus-border bg-white text-zinc-700',
  },
  3: {
    title: 'Zona 3 — Apoio / Expansão (2º Andar)',
    proximityDefault: 0,
    badge: 'border-nexus-amber bg-amber-50 text-amber-900',
  },
};

export function RoomsTopologyView() {
  const { rooms, updateRoom } = useNexusStore();

  const floor1Rooms = rooms.filter((r) => r.floor === 1);
  const floor2Rooms = rooms.filter((r) => r.floor === 2);

  function setRoomZone(roomId: string, zone: RadialZone) {
    const info = ZONE_INFO[zone];
    updateRoom(roomId, {
      zone,
      reportProximity: info.proximityDefault,
      corridorGroup: info.title,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-nexus-border bg-nexus-white p-4">
        <h3 className="text-sm font-semibold text-nexus-black">
          Topologia dos 33 Consultórios & Zonas Radiais de Proximidade aos PCs de Laudo (DEC-A)
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          O operador tem liberdade total para escolher as salas de cada curso. As zonas abaixo
          funcionam como pontuação de apoio para sugerir blocos de salas (DEC-B) e desempatar
          máquinas. Clique para calibrar a zona ou ativar/desativar salas padrão.
        </p>
      </div>

      {/* 1º Andar (23 consultórios) */}
      <section className="rounded-lg border border-nexus-border bg-nexus-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-nexus-black">
            1º Andar — Andar Preferencial (23 Consultórios: 1A-01 a 1A-23)
          </h4>
          <span className="text-xs text-zinc-500">
            Zona 1 ({floor1Rooms.filter((r) => r.zone === 1).length} salas) • Zona 2 (
            {floor1Rooms.filter((r) => r.zone === 2).length} salas)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {floor1Rooms.map((r) => {
            const zInfo = ZONE_INFO[r.zone];
            return (
              <div
                key={r.id}
                className={`rounded-lg border p-3 transition ${
                  r.defaultEnabled ? zInfo.badge : 'border-dashed border-zinc-300 bg-zinc-100 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{r.id}</span>
                  <span className="rounded bg-nexus-black px-1.5 py-0.5 text-xs text-nexus-white">
                    +{r.reportProximity} pts laudo
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-1 text-xs">
                  <div className="inline-flex rounded border border-zinc-300 bg-white p-0.5">
                    {([1, 2] as RadialZone[]).map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setRoomZone(r.id, z)}
                        className={`rounded px-2 py-0.5 ${
                          r.zone === z
                            ? 'bg-nexus-green font-semibold text-nexus-white'
                            : 'text-zinc-600'
                        }`}
                      >
                        Zona {z}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => updateRoom(r.id, { defaultEnabled: !r.defaultEnabled })}
                    className="underline"
                  >
                    {r.defaultEnabled ? 'Ativa' : 'Pulada'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2º Andar (10 consultórios) */}
      <section className="rounded-lg border border-nexus-border bg-nexus-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-nexus-black">
            2º Andar — Andar de Expansão / Contingência (10 Consultórios: 2A-01 a 2A-10)
          </h4>
          <span className="text-xs text-zinc-500">
            Acionado quando a demanda ultrapassa 23 salas ou em isolamento de turmas
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-5">
          {floor2Rooms.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-3 ${
                r.defaultEnabled
                  ? 'border-nexus-amber bg-amber-50/60 text-amber-950'
                  : 'border-dashed border-zinc-300 bg-zinc-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold">{r.id}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-white">
                  +{r.reportProximity} pts
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span>Zona {r.zone}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateRoom(r.id, { reportProximity: r.reportProximity === 0 ? 15 : 0 })
                  }
                  className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs"
                >
                  {r.reportProximity > 0 ? 'Próx. Laudo (15)' : 'Padrão (0)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

