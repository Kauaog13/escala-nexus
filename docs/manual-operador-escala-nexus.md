# Manual Rápido do Operador — Escala Nexus

> **Público-alvo:** Equipe de Operações da Academia Nexus (2 operadores)  
> **Objetivo:** Gerar, ajustar e publicar a escala semanal das 29 máquinas de ultrassom nos 33 consultórios em menos de 5 minutos.

---

## 1. Fluxo Semanal Passo a Passo (5 minutos)

### Passo 1 — Conferir o Parque de Máquinas (Aba 2: Inventário)
1. Acesse a aba **2. Inventário de Máquinas**.
2. Caso alguma máquina esteja em conserto antes do início do fim de semana, altere o status dela para **Em Manutenção (Bloqueada)**. O motor e o banco impedirão automaticamente que ela seja escalada (`RN12`).
3. Caso a fabricante empreste um equipamento extra de demonstração, cadastre-o com status **Empréstimo / Demo** (`RF01`).
4. Se estiver iniciando uma semana nova a partir da anterior, clique em **Clonar p/ Próximo FDS (RF08)** na Aba 1: o sistema herdará automaticamente o andar em que cada máquina terminou no último turno (`DEC-C`).

### Passo 2 — Lançar os Cursos da Semana (Aba 1: Planejador)
1. Selecione o turno desejado na barra superior (`SEXTA MANHÃ`, `SÁBADO MANHÃ`, etc.) ou adicione turnos extras de `Segunda` a `Domingo` clicando em **+ Adicionar Turno (RN01)**.
2. No formulário **Lançar / Atualizar Curso**:
   - Escolha o **Curso da Semana**;
   - Escolha o **Regime de Horário**: *Apenas o Turno Atual* ou *Dia Todo (Manhã + Tarde — RN06)*;
   - Informe o **Nº de Alunos** (o sistema calcula automaticamente $\lceil \text{alunos} / 2 \rceil$ salas) ou digite diretamente a quantidade de salas.
3. **Escolha de Salas (`DEC-A` e `DEC-B`):**
   - O sistema já pré-seleciona um bloco de salas próximo aos Computadores de Laudo (**Zona 1 — +30 pts**).
   - Para personalizar quais consultórios a turma usará, clique em **Escolher Salas (DEC-A)** e marque/desmarque qualquer sala com 1 clique.
4. Clique em **Lançar Curso e Distribuir Máquinas**.

### Passo 3 — Ajustes Finos, Permutas e Quarentena (*Human-in-the-Loop*)
- **Alternar entre Grade e Planta Radial (`§9`):** Use o botão **Planta Radial de Laudo (§9)** para visualizar os anéis **Zona 1 (+30 pts)** ao redor da Ilha Central de Laudo, **Zona 2 (+10 pts)** e **Zona 3 (2º Andar)**.
- **Trocar Máquina (Drag-and-Drop ou Dropdown — `RF05` e `RN10`):**
  - Arraste um consultório sobre outro ou selecione outra máquina no dropdown do cartão.
  - Se a máquina escolhida já estiver em uso em outra sala no mesmo turno, o sistema exibirá o alerta **Trava Anti-Duplicidade (RN10)** oferecendo a **Permuta Automática** entre as duas salas com 1 clique.
- **Travar Máquina (Pin):** Clique no ícone de cadeado no cartão da sala para fixar aquela máquina mesmo que a escala seja recalculada.
- **Auditar o Motivo (`Por quê?` — `RF09`):** Clique em **Por quê?** em qualquer sala alocada para ver a fórmula exata de pontuação (`Fit_Clinico + Bonus_PC_Laudo - Penalidade_Andar + Bonus_Heranca`).
- **Máquina Quebrou Durante a Aula (`DEC-E`):** Clique no ícone de chave inglesa (**Simular quebra / manutenção**) no cartão da sala. O sistema mostrará a **Proposta de Menor Mudança Possível**, substituindo apenas a máquina daquela sala por uma reserva compatível, mantendo todas as outras salas intactas e sugerindo a nota de rodapé.

### Passo 4 — Exportar para o WhatsApp (`RF07` e `RN11`)
1. No rodapé da Aba 1, confira o bloco **Exportação Oficial WhatsApp Nexus**.
2. O sistema insere automaticamente a tag `*2° ANDAR*` nas salas `2A-01` a `2A-10` e sugere notas de rodapé quando há descida de turmas (ex.: `PG US GIOB` descendo para o 1º andar no sábado à tarde).
3. Clique em **Copiar WhatsApp (1 clique)** e cole diretamente no grupo operacional.

