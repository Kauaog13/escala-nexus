# Escala Nexus — Sistema Inteligente de Alocação de Ultrassom

Sistema web **Local-First + Cloud-Synced** desenvolvido para a equipe de Operações da **Academia Nexus**, automatizando a distribuição semanal de **29 máquinas de ultrassom** nos **33 consultórios** (23 no 1º andar e 10 no 2º andar) conforme os cursos de Pós-Graduação e Modulares da semana.

---

## Principais Capacidades

- **Motor Determinístico e Explicável (`src/domain/` — DEC-F):**
  - Função objetivo linear multi-critério desacoplada:
    $$\text{Score} = (w_1 \cdot \text{Fit\_Clínico}) + (w_2 \cdot \text{Bônus\_PC\_Laudo}) - (w_3 \cdot \text{Penalidade\_Andar}) + (w_4 \cdot \text{Bônus\_Herança})$$
  - Cada sugestão gera uma justificativa auditável em Português Brasileiro no chip **"Por quê?"** (`RF09`).
- **Invariante Anti-Duplicidade em Três Camadas (`RN10` e `DEC-G`):**
  1. Motor em memória (`usedMachineIdsInShift`);
  2. UI com detecção em tempo real e oferta de **Permuta Automática entre Salas**;
  3. Banco de dados PostgreSQL com constraints físicas `UNIQUE (shift_id, machine_id)` e `UNIQUE (shift_id, room_id)` + trigger `assert_machine_usable`.
- **Grade Operacional e Planta Radial Interativa (`FloorMapContainer.tsx` — §9):**
  - Alternância entre Grade Operacional e Planta Radial da Ilha Central de Computadores de Laudo (**Zona 1: +30 pts**, **Zona 2: +10 pts**, **Zona 3: 0 pts**);
  - Suporte a **Drag-and-Drop HTML5**, **Pin (Trava)**, **Quarentena com Proposta de Menor Mudança (`DEC-E`)**, **Diff de Recálculo (`§5.5`)** e **Undo**.
- **Exportação Oficial para WhatsApp (`RF07`) e Relatório de Logística entre Turnos (`RF06`):**
  - Gera o texto idêntico ao padrão operacional da Academia Nexus com tag automática `*2° ANDAR*` e nota de rodapé editável.

---

## Comandos do Projeto

```bash
# Instalar dependências
npm.cmd install

# Iniciar servidor de desenvolvimento (Vite)
npm.cmd run dev

# Executar todas as 7 suítes de testes (Vitest)
npm.cmd test

# Verificar lint (inclui trava arquitetural DEC-F em src/domain/) e tipos
npm.cmd run lint
npm.cmd run typecheck

# Gerar build de produção
npm.cmd run build
```

---

## Documentação Técnica e Operacional

- [Análise de Requisitos v4.0](docs/analise-requisitos-escala-nexus.md)
- [Design Validado (DEC-A a DEC-G)](docs/design-escala-nexus.md)
- [Plano de Implementação (Sprints 0 a 4)](docs/plano-implementacao-escala-nexus.md)
- [Manual Rápido do Operador (5 minutos)](docs/manual-operador-escala-nexus.md)
- [Changelog e Regras SemVer](CHANGELOG.md)
