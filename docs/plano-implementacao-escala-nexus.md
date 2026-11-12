# Plano de Implementação — Escala Nexus

**Base:** `docs/design-escala-nexus.md` (design validado, DEC-A a DEC-G).
**Princípio:** entregas pequenas, testáveis e que já funcionam sozinhas. Cada sprint termina com um critério de pronto verificável.
**Stack (do documento v4.0):** React 18 + Vite + TypeScript, Tailwind + shadcn/ui, Zustand, Supabase (PostgreSQL), Vitest.

---

## 0. Antes de codificar (Sprint 0 — 1 a 2 dias)

| # | Tarefa | Saída | Quem decide |
|---|---|---|---|
| 0.1 | Validar H2: lista de máquinas 1ª/2ª opção por curso | Planilha `curso × máquina × (1ª, 2ª, contingência)` revisada | Operadores |
| 0.2 | Definir salas do 2º andar próximas do laudo e confirmar zonas do 1º | Tabela `sala → zona → proximidade` | Operadores |
| 0.3 | Definir a ordem de rendição inicial entre cursos | Lista ordenada | Operadores |
| 0.4 | Reunir 3 a 5 escalas reais (WhatsApp) para testes golden | Pasta `tests/fixtures/` com entradas e saídas esperadas | Operadores |
| 0.5 | Confirmar H4 e H8 (pesos e valores do score) | Valores iniciais em `config/` | Equipe técnica + operadores |
| 0.6 | Criar projeto Supabase e definir autenticação dos 3 operadores | Projeto e credenciais em `.env` (fora do Git) | Equipe técnica |

> Se 0.1 a 0.4 não estiverem prontos, o Sprint 2 usa dados provisórios do documento v4.0. Os resultados ficam marcados como "não validados".

---

## 1. Sprint 1 — Schema, seeds e CRUD

**Objetivo:** dados confiáveis e impossibilidade de duplicidade no banco.

| # | Tarefa | Critério de pronto |
|---|---|---|
| 1.1 | Scaffold: Vite + React + TS, Tailwind, ESLint, Prettier, Vitest, estrutura `domain/ application/ infrastructure/ ui/ config/` | `npm run build` e `npm test` passam |
| 1.2 | Tokens de cor Nexus (verde, branco e preto, §7 do documento) em Tailwind | Tema aplicado ao layout base |
| 1.3 | Migrações SQL normalizadas (ver 5.2 do design): `machines`, `probes`, `machine_probes`, `rooms`, `courses`, `course_machine_rules`, `weekly_schedules`, `shifts`, `shift_demands`, `allocations`, `allocation_explanations`, `manual_locks`, `machine_location_snapshots`, `engine_config`, `schedule_versions`, `audit_log` | Migração roda do zero em banco limpo |
| 1.4 | Restrições: `UNIQUE (shift_id, machine_id)`, `UNIQUE (shift_id, room_id)`, `CHECK` de status, `version` por turno | Teste SQL: inserir duplicata falha |
| 1.5 | Seeds: 29 máquinas (códigos únicos `V6-01`…), 33 salas com zona, catálogo de cursos e regras 1ª/2ª opção | Contagens batem: 29, 33, cursos do §4 |
| 1.6 | Repositórios em `infrastructure/supabase/` e cache local em `infrastructure/local/` | Leitura e escrita com e sem rede |
| 1.7 | CRUD de inventário: listar, adicionar, editar, status (Ativo, Manutenção, Empréstimo), sondas | Operador altera status em < 3 cliques |
| 1.8 | CRUD de cursos e regras de máquinas preferenciais | Edição reflete no banco |
| 1.9 | Autenticação simples dos 3 operadores e campo `updated_by` | Login funciona e fica registrado |
| 1.10 | Salvamento de turno em transação única com `version` (concorrência otimista) | Teste: segundo salvamento com versão antiga recebe conflito |

**Risco da sprint:** dados de entrada errados (H2). **Mitigação:** tela de revisão do inventário e das regras por curso, validada pelos operadores antes do Sprint 2.

---

## 2. Sprint 2 — Motor determinístico

**Objetivo:** o motor gera sugestões corretas e explicáveis, sem depender de banco ou tela.

| # | Tarefa | Critério de pronto |
|---|---|---|
| 2.1 | Tipos do domínio em `domain/types/` | Sem dependência de React ou Supabase |
| 2.2 | Filtro rígido (`domain/rules/`): status ativo, lista de opções do curso, unicidade no turno, pins | Testes unitários por regra |
| 2.3 | Termos do score (`domain/scoring/`): `fit`, `proximity`, `transport`, `stability`, cada um isolado | Cada termo tem teste com valores da tabela do design |
| 2.4 | Pesos e ordem de rendição lidos de `config/` | Mudar peso muda o resultado sem alterar código |
| 2.5 | Herança (RN04, RN06, RN07) e estado inicial vindo do snapshot (DEC-C) | Teste: curso contínuo mantém salas e máquinas |
| 2.6 | Atribuição por curso na ordem de rendição, com desempate por código | Mesmo input gera sempre o mesmo output |
| 2.7 | Gargalos: demanda acima do parque, falta de máquina elegível | Retorna lista de gargalos, nunca lança erro |
| 2.8 | Sugestão de bloco de salas (DEC-B) pelas zonas e pela herança | Teste: Zona 1 é preferida quando livre |
| 2.9 | Controle Manual (RN08): cursos manuais param e pedem escolha | Teste: Fígado e Hemodinâmica Neonatal retornam "aguardando operador" |
| 2.10 | Upgrade com limiar (RN05) | Teste: não troca se o ganho for menor que o limiar |
| 2.11 | Explicações em PT-BR (`domain/explain/`) com o padrão do design | Texto cita curso, zona, andar e score |
| 2.12 | Menor mudança em quebra de máquina (DEC-E) | Teste: só a sala afetada muda |
| 2.13 | Testes golden com as escalas reais da Sprint 0 | Divergências documentadas e justificadas |
| 2.14 | Testes de propriedade e de perturbação | Nenhuma duplicidade em entradas aleatórias; tirar 1 Voluson muda no máximo N salas |

**Meta de desempenho:** semana inteira em < 50 ms (H7), medido em teste.

---

## 3. Sprint 3 — Grade interativa e overrides

**Objetivo:** o operador monta e altera uma escala completa em menos de 3 minutos.

| # | Tarefa | Critério de pronto |
|---|---|---|
| 3.1 | Planejador por dia e turno (Seg a Dom, Manhã/Tarde/Dia Todo), padrão Sex, Sáb e Dom | RN01 atendida |
| 3.2 | Lançamento de curso: alunos, cálculo de salas `⌈alunos/2⌉`, ajuste manual | Valores editáveis |
| 3.3 | Seletor de salas com bloco sugerido e ajuste com um clique | DEC-B atendida |
| 3.4 | Grade de salas com cartões e cores do §7 | Verde, âmbar, vermelho e cinza conforme o estado |
| 3.5 | Chip "Por quê?" com detalhamento do score | Mostra os 4 termos em português |
| 3.6 | Pin, arrastar e soltar, permuta em conflito (RN10) e desfazer | Conflito detectado em tempo real |
| 3.7 | Quarentena de máquina com alerta e proposta de menor mudança (DEC-E) | Operador aceita ou troca manualmente |
| 3.8 | Banner de transporte entre andares | Lista as máquinas, com ícone para as pesadas |
| 3.9 | Relatório de transição entre turnos (RF06) | Separa "permanece" de "transportar" |
| 3.10 | Exportação no formato WhatsApp com nota de rodapé automática e botão de cópia (RF07) | Texto idêntico ao padrão da escola |
| 3.11 | Estados da escala: Rascunho, Oficial Publicada, Alterada em Andamento (RN11) | Escala publicada só muda com confirmação |
| 3.12 | Clonagem e histórico de escalas (RF08) | Duplica estrutura de um fim de semana anterior |
| 3.13 | Sincronização offline e tratamento de conflito de versão | "Pendente de sincronização" visível |
| 3.14 | Responsividade para celular (RNF04) | Usável em tela pequena |

**Teste de aceitação:** um operador, com cronômetro, monta ECOF + MEFE + GIOB para um fim de semana real.

---

## 4. Sprint 4 — Telemetria, auditoria e ajuste fino

| # | Tarefa | Critério de pronto |
|---|---|---|
| 4.1 | Audit log completo: quem mudou o quê e quando | Toda alteração fica registrada |
| 4.2 | Registro de overrides (qual regra o operador corrigiu) | Painel por regra |
| 4.3 | Métricas: transportes entre andares, tempo até publicar, gargalos por semana | Painel simples |
| 4.4 | Calibração de `w1..w4` com dados de 4+ fins de semana | Valores revisados em `config/` |
| 4.5 | Backup e importação em `.json` | Restaura uma escala completa |
| 4.6 | Preparar o `FloorMapContainer` para a planta baixa futura | Visão em grade continua funcionando |
| 4.7 | Deploy em produção e manual curto do operador | Os 3 operadores usam em um fim de semana real |

---

## 5. Estratégia de testes e qualidade

| Camada | Ferramenta | Cobertura mínima |
|---|---|---|
| `domain/` | Vitest (unitário, propriedade, perturbação, golden) | Alta, é o coração do sistema |
| Banco | Testes SQL das restrições | `UNIQUE`, `CHECK` e `version` |
| UI | Testes de componente e fluxo principal | Gerar, intervir, exportar |
| Aceitação | Cronômetro com operador real | < 3 minutos |

**CI:** lint, tipos e testes a cada commit. Migrações validadas em banco limpo.

---

## 6. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Dados de curso e máquinas errados | Escalas erradas com aparência de confiança | Sprint 0 e tela de revisão no Sprint 1 |
| Pesos mal calibrados | Sugestões ruins | Pesos em configuração, testes golden e calibração no Sprint 4 |
| Conflito entre operadores | Perda de edição | Versão otimista e mesclagem guiada |
| Perda de internet | Operação parada | Local-first com cache e sincronização |
| Mudança de regra no meio do projeto | Retrabalho | Regras como dado e motor puro |

---

## 7. Definição de pronto (global)

- Nenhuma máquina duplicada no mesmo turno, nem por SQL direto.
- O motor é determinístico: mesma entrada, mesma saída.
- Pins nunca são removidos pelo motor.
- Toda sugestão tem explicação em português.
- Escala completa em menos de 3 minutos.
- As escalas reais de teste são reproduzidas, com divergências justificadas.

## 8. Status das Sprints Implementadas

- [x] **Sprint 0:** Fixtures reais em `tests/fixtures/`, pesos e ordem de rendição em `src/config/seedData.ts`, operadores e `.env` configurados.
- [x] **Sprint 1 (`v0.1.0`):** Scaffold React 18 + Vite 5 + TS 5 + Tailwind 3 + Zustand, migração SQL normalizada (`supabase/migrations/0001_schema.sql`), seeds oficiais (29 máquinas, 33 salas, 22 cursos), repositório Local-First + Supabase REST, CRUDs e salvamento transacional com concorrência otimista (`version`).
- [x] **Sprint 2 (`v0.2.0`):** Motor determinístico puro em `src/domain/`, termos da função objetivo desacoplados (`w1..w4`), explicações em PT-BR, sugestor de salas por Zonas Radiais, proposta de menor mudança em quebra (`DEC-E`), suíte de testes unitários, golden, propriedade e perturbação (< 50 ms).
- [x] **Sprint 3 (`v0.3.0` / `v0.5.0`):** Planejador por dia/turno (Segunda a Domingo + Dia Todo), grade e planta radial interativa (`FloorMapContainer.tsx`) com Drag-and-Drop, Pin, Hot-Swap com permuta automática (`RN10`), Quarentena (`DEC-E`), relatório de transição entre turnos (`RF06`), exportador oficial WhatsApp (`RF07`) e clonagem de escala com herança de andar (`RF08` / `DEC-C`).
- [x] **Sprint 4 (`v0.4.0` / `v0.5.0`):** Telemetria Kaizen, calibração de pesos em tempo real, histórico de versões, backup/restore `.json` e manual rápido do operador (`docs/manual-operador-escala-nexus.md`).

