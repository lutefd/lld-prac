const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const collaborationTranslations = {
  "task-checklist": {
    title: "Lista de tarefas",
    summary:
      "Gerencie uma lista de tarefas com conclusão explícita, reabertura e cópias ordenadas.",
    tags: ["Coleções", "Validação", "Cópias de estado"],
    levels: [
      level(
        "Adicionar tarefas",
        "Mantenha IDs distintos em uma lista pessoal.",
        "NewChecklist() *Checklist começa vazio. Add(id string) bool aceita um ID único e não vazio, diferenciando maiúsculas de minúsculas, e cria uma tarefa incompleta. Adições inválidas retornam false sem alterações.",
        "Count() int conta todas as tarefas, inclusive as concluídas.",
      ),
      level(
        "Concluir e reabrir",
        "Acompanhe a conclusão de cada tarefa sem removê-la.",
        "SetDone(id string, done bool) bool atualiza uma tarefa conhecida; repetir o valor atual retorna true. IDs desconhecidos retornam false sem alterações.",
        "Done(id string) (bool, bool) retorna (concluída, true) para uma tarefa conhecida e (false, false) caso contrário. Novas tarefas começam incompletas.",
      ),
      level(
        "Consultar e remover",
        "Retorne visões estáveis das tarefas pendentes.",
        "Pending() []string retorna os IDs incompletos em ordem lexicográfica como uma cópia defensiva. Um resultado vazio pode ser nil ou uma fatia vazia em Go.",
        "Remove(id string) bool remove uma tarefa conhecida, concluída ou não. IDs desconhecidos retornam false. Um ID removido pode ser adicionado novamente e começa incompleto; chamadas inválidas nunca alteram a lista ou a conclusão.",
      ),
    ],
  },
  "support-ticket-router": {
    title: "Distribuidor de chamados",
    summary:
      "Distribua chamados entre agentes com capacidade disponível e encerre-os sem perder o controle das atribuições.",
    tags: ["Alocação", "Capacidade", "Máquina de estados"],
    levels: [
      level(
        "Cadastrar agentes",
        "Registre a capacidade simultânea de cada agente de suporte.",
        "NewTicketRouter() *TicketRouter começa vazio. AddAgent(id string, capacity int) bool aceita um ID único e não vazio e capacidade positiva; chamadas inválidas preservam o estado.",
        "Load(id string) (int, bool) retorna o número de chamados abertos atribuídos a um agente conhecido, inicialmente zero; IDs desconhecidos retornam (0, false). Os IDs diferenciam maiúsculas de minúsculas.",
      ),
      level(
        "Atribuir chamados",
        "Selecione agentes de forma determinística sem exceder a capacidade.",
        'Assign(ticket string) (string, bool) aceita um ID de chamado não vazio e nunca utilizado, seleciona um agente com carga menor que a capacidade e incrementa sua carga. Escolha a menor carga atual e depois o menor ID lexicográfico. Em caso de falha, retorne ("", false) sem alterações nem consumo do ID.',
        'Owner(ticket string) (string, bool) retorna o agente responsável; IDs desconhecidos retornam ("", false). Atribuir novamente o mesmo chamado falha sem alterar nenhuma carga.',
      ),
      level(
        "Encerrar e preservar histórico",
        "Libere capacidade preservando a identidade dos chamados.",
        "Close(ticket string) bool encerra um chamado aberto e atribuído, decrementando apenas a carga de seu responsável. Chamados desconhecidos ou já encerrados retornam false sem alterações.",
        "Chamados encerrados mantêm seu Owner e consomem permanentemente seu ID. Assign não pode reabri-los. Encerrar um chamado não afeta outros chamados ou agentes.",
      ),
    ],
  },
  "meeting-room-scheduler": {
    title: "Agendador de salas",
    summary:
      "Aloque salas por capacidade e disponibilidade de intervalos, com cancelamento e reagendamento atômico.",
    tags: ["Intervalos", "Agendamento", "Atomicidade"],
    levels: [
      level(
        "Cadastrar salas",
        "Mantenha salas e capacidades em um cadastro determinístico.",
        "NewRoomScheduler() *RoomScheduler começa vazio. AddRoom(id string, capacity int) bool aceita um ID único e não vazio, diferenciando maiúsculas de minúsculas, e capacidade positiva. Chamadas inválidas preservam as salas existentes.",
        "Capacity(id string) (int, bool) retorna a capacidade cadastrada; salas desconhecidas retornam (0, false). Todas as entradas e comparações numéricas cabem em int e em inteiros seguros de TypeScript.",
      ),
      level(
        "Reservar reuniões sem conflitos",
        "Aloque a menor sala adequada para um intervalo semiaberto.",
        'Book(id string, people, start, end int) (string, bool) exige um ID não vazio e sem reserva ativa, people > 0 e 0 <= start < end. Escolha uma sala disponível com capacity >= people, ordenando pela menor capacidade e depois pelo menor ID lexicográfico. Em caso de falha, retorne ("", false) sem alterações nem consumo do ID.',
        'Os intervalos são [start,end): reuniões cujos extremos apenas se tocam não conflitam. Room(id string) (string, bool) retorna a sala de uma reserva ativa, ou ("", false) se ausente. Não há relógio real nem concorrência.',
      ),
      level(
        "Cancelar e reagendar atomicamente",
        "Altere os planos preservando reservas válidas quando uma operação falhar.",
        'Cancel(id string) bool remove uma reserva ativa e libera seu intervalo; IDs desconhecidos retornam false. IDs cancelados podem ser reutilizados e Room retorna ("", false) após o cancelamento.',
        "Reschedule(id string, people, start, end int) (string, bool) usa a validação e a ordenação de Book, mas exige um ID ativo. Ignore o intervalo antigo dessa reserva ao buscar uma sala. O sucesso substitui atomicamente sala, intervalo e participantes; a falha preserva toda a reserva antiga. Reagendar para os mesmos valores retorna true.",
      ),
    ],
  },
};
