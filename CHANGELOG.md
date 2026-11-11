# Changelog

Todas as mudanças relevantes do **Escala Nexus** são registradas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue o [Versionamento Semântico 2.0.0](https://semver.org/lang/pt-BR/).

---

## Regras de versionamento

### Formato da versão

`vMAJOR.MINOR.PATCH`, por exemplo `v0.1.0`.

| Parte | Quando incrementar | Exemplo no Escala Nexus |
|---|---|---|
| **MAJOR** | Mudança incompatível: altera o formato dos dados salvos, remove funcionalidade ou muda uma regra de negócio de forma que escalas antigas deixam de se comportar igual | Trocar o modelo de alocação ou o esquema do banco sem migração automática |
| **MINOR** | Funcionalidade nova compatível com o que já existe | Nova tela, novo curso suportado, novo termo no score |
| **PATCH** | Correção de defeito compatível, sem funcionalidade nova | Corrigir cálculo de salas, ajustar texto de explicação, corrigir cor |

### Fase 0.x (desenvolvimento inicial)

- Enquanto a versão for `0.y.z`, a API e os dados ainda podem mudar.
- Nesta fase, `MINOR` é usado para mudanças que quebram compatibilidade e para novas funcionalidades. `PATCH` é usado só para correções.
- A versão **`v1.0.0`** é lançada quando os 3 operadores usarem o sistema em um fim de semana real, com escala completa gerada em menos de 3 minutos.

### Mapa de versões planejadas

| Versão | Marco |
|---|---|
| `v0.0.0` | Documentação e design aprovados, ainda sem código de aplicação |
| `v0.1.0` | Sprint 1: schema, seeds e CRUD |
| `v0.2.0` | Sprint 2: motor determinístico |
| `v0.3.0` | Sprint 3: grade interativa e overrides |
| `v0.4.0` | Sprint 4: telemetria, auditoria e ajuste fino |
| `v1.0.0` | Uso em produção pelos operadores |

### Regras gerais

1. Toda mudança que afeta o usuário ou os dados entra neste arquivo, na seção `[Não lançado]`, no mesmo commit que a alterou.
2. Ao lançar, a seção `[Não lançado]` vira `[vX.Y.Z] - AAAA-MM-DD` e uma nova seção `[Não lançado]` vazia é criada acima.
3. Cada versão recebe uma tag Git anotada: `git tag -a vX.Y.Z -m "Escala Nexus vX.Y.Z"`.
4. Mudanças em regras de negócio (RN01 a RN11) e nos pesos do score `w1..w4` devem ser citadas explicitamente.
5. Mudanças no banco devem citar o nome da migração.
6. Uma versão publicada nunca é editada. Correções saem em uma nova versão.

### Categorias de entrada

| Categoria | Uso |
|---|---|
| **Adicionado** | Funcionalidades novas |
| **Alterado** | Mudanças em funcionalidades existentes |
| **Obsoleto** | Itens que serão removidos |
| **Removido** | Itens removidos |
| **Corrigido** | Correção de defeitos |
| **Segurança** | Correções ligadas a segurança ou privacidade |

### Convenção de commits

Mensagens seguem o [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), em português:

`tipo(escopo): descrição curta no imperativo`

| Tipo | Efeito na versão |
|---|---|
| `feat` | MINOR |
| `fix` | PATCH |
| `feat!` ou rodapé `BREAKING CHANGE:` | MAJOR (ou MINOR na fase 0.x) |
| `docs`, `refactor`, `test`, `chore`, `build`, `ci` | Sem alteração de versão por si só |

Escopos sugeridos: `domain`, `db`, `ui`, `config`, `docs`.

---

## [Não lançado]

---

## [v0.0.0] - 2026-11-11

Marco inicial do projeto: análise, design e planejamento. Ainda não há código de aplicação.

### Adicionado

- Documento de análise de requisitos v4.0 (`docs/analise-requisitos-escala-nexus.md`), com regras de negócio RN01 a RN11, inventário de 29 máquinas, 33 salas, matriz de cursos, design system Nexus e esquema de dados.
- Design validado (`docs/design-escala-nexus.md`), com Understanding Lock, premissas, Decision Log (DEC-A a DEC-G), diagrama ER, fluxograma de alocação e roadmap.
- Plano de implementação (`docs/plano-implementacao-escala-nexus.md`), com Sprint 0 e Sprints 1 a 4, critérios de pronto, testes e riscos.
- Skill `brainstorming` instalada em `.agents/skills/brainstorming/`, do repositório `sickn33/agentic-awesome-skills`.
- Logotipo da Nexus em `assets/logo-principal.svg`.
- Este `CHANGELOG.md` com as regras de versionamento.

### Decisões registradas

- **DEC-A:** o operador escolhe as salas e o motor sugere as máquinas. As zonas são score de apoio.
- **DEC-B:** bloco de salas sugerido e pré-preenchido, editável.
- **DEC-C:** estado inicial das máquinas herdado da última escala salva.
- **DEC-D:** ordem de rendição entre cursos fixa e editável.
- **DEC-E:** em quebra de máquina, o sistema alerta e propõe a menor mudança, confirmada pelo operador.
- **DEC-F:** motor puro em camadas, em TypeScript no cliente.
- **DEC-G:** banco normalizado com `UNIQUE (turno, máquina)` e `UNIQUE (turno, sala)`.

### Pendências conhecidas

- Validar com os operadores as hipóteses H2 (exigências por curso), H4 (custo de transporte) e H8 (valores iniciais do score).
- Confirmar quais salas do 2º andar são próximas do laudo e a ordem de rendição inicial.
