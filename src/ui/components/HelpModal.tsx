import { useState } from 'react';
import { BookOpen, Check, Copy, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  function copyText(key: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-nexus-border bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-nexus-border pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-nexus-green" />
            <h3 className="text-base font-bold text-nexus-black">
              Manual Operacional Rápido — Escala Nexus
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-nexus-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-5 text-xs text-zinc-700">
          <section className="rounded-lg border border-nexus-green bg-nexus-green-light/40 p-3.5">
            <h4 className="font-bold text-nexus-green-deep">
              Objetivo: Gerar e publicar a escala em menos de 5 minutos
            </h4>
            <p className="mt-1 leading-relaxed text-zinc-800">
              O Escala Nexus automatiza a alocação das <strong>29 máquinas de ultrassom</strong> nos{' '}
              <strong>33 consultórios</strong> (23 no 1º andar e 10 no 2º andar) respeitando a
              hierarquia clínica, proximidade aos computadores de laudo, minimizando transporte
              vertical e garantindo autonomia total ao operador.
            </p>
          </section>

          <div className="space-y-3">
            <div className="rounded-lg border border-nexus-border p-3">
              <h5 className="font-bold text-nexus-black">1. Conferir o Parque (Aba 2: Inventário)</h5>
              <p className="mt-1 text-zinc-600">
                Altere o status para <strong>Em Manutenção</strong> com 1 clique caso uma máquina
                esteja quebrada (o motor e o banco impedem sua alocação — RN12). Adicione máquinas
                de empréstimo/demo temporárias caso receba novos aparelhos.
              </p>
            </div>

            <div className="rounded-lg border border-nexus-border p-3">
              <h5 className="font-bold text-nexus-black">
                2. Lançar Cursos da Semana (Aba 1: Planejador)
              </h5>
              <p className="mt-1 text-zinc-600">
                Selecione o turno (ou adicione novos de Segunda a Domingo) e lance o curso. Use o
                regime <strong>Dia Todo (Manhã + Tarde — RN06)</strong> para espelhar as salas
                automaticamente. Aceite o bloco sugerido (DEC-B) ou personalize as salas em 1 clique
                (DEC-A).
              </p>
            </div>

            <div className="rounded-lg border border-nexus-border p-3">
              <h5 className="font-bold text-nexus-black">
                3. Ajustes Finos e Permutas (Human-in-the-Loop)
              </h5>
              <ul className="mt-1 list-disc pl-4 space-y-1 text-zinc-600">
                <li>
                  <strong>Drag-and-Drop:</strong> arraste cartões de consultório para permutar
                  máquinas entre salas.
                </li>
                <li>
                  <strong>Trava Anti-Duplicidade (RN10):</strong> se escolher uma máquina já em uso
                  no turno, o sistema oferece a <strong>Permuta Automática</strong> imediata.
                </li>
                <li>
                  <strong>Máquina Quebrou (DEC-E):</strong> clique na chave inglesa do cartão. O
                  sistema calcula a <strong>Menor Mudança Possível</strong> substituindo apenas
                  aquela sala e preservando todas as demais.
                </li>
                <li>
                  <strong>Chip &ldquo;Por quê?&rdquo;:</strong> visualize o cálculo exato do score
                  em português.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-nexus-border p-3">
              <h5 className="font-bold text-nexus-black">
                4. Exportação para WhatsApp (RF07) e Clonagem (RF08)
              </h5>
              <p className="mt-1 text-zinc-600">
                Clique em <strong>Copiar WhatsApp (1 clique)</strong> no rodapé. A mensagem já vem
                formatada com a tag <code>*2° ANDAR*</code> e notas de rodapé operacionais. Para a
                semana seguinte, clique em <strong>Clonar p/ Próximo FDS</strong> para herdar o
                andar final de cada máquina como ponto de partida (DEC-C).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-nexus-border pt-4">
            <span className="text-[11px] text-zinc-500">
              Versão v0.5.2 • Documentação completa disponível em <code>docs/</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  copyText(
                    'summary',
                    'Escala Nexus: 1. Checar Inventário -> 2. Lançar Cursos (Aba 1) -> 3. Ajustes/Permuta (Drag-and-Drop) -> 4. Copiar WhatsApp',
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-nexus-border bg-zinc-50 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {copiedSection === 'summary' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-nexus-green" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar Resumo
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-nexus-black px-4 py-1.5 font-semibold text-white hover:bg-nexus-surface"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

