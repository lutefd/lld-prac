import { commerceTranslations } from "./commerceTranslations.ts";
import { collaborationTranslations } from "./collaborationTranslations.ts";
import { infrastructureTranslations } from "./infrastructureTranslations.ts";
type LocalizedContent = {
  title: string;
  summary: string;
  tags: string[];
  levels: { title: string; description: string; requirements: string[] }[];
};
const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const problemTranslations: Record<string, LocalizedContent> = {
  ...commerceTranslations,
  ...collaborationTranslations,
  ...infrastructureTranslations,
  "ride-dispatch": {
    title: "Distribuição de corridas",
    summary:
      "Conecte passageiros a motoristas próximos disponíveis e depois adicione reservas de viagens.",
    tags: ["Correspondência", "Estado", "Ordenação determinística"],
    levels: [
      level(
        "Cadastrar a frota",
        "Mantenha um cadastro de motoristas em uma malha urbana unidimensional.",
        "NewDispatcher() *Dispatcher cria um cadastro vazio.",
        "Register(id string, position int) bool adiciona um ID de motorista único e não vazio. Retorne false para IDs vazios ou duplicados; duplicatas não devem sobrescrever a posição original.",
        "Count() int retorna o número de motoristas cadastrados. As posições podem ser negativas.",
      ),
      level(
        "Encontrar o motorista mais próximo",
        "Encontre um motorista sem alterar a disponibilidade.",
        "Nearest(position int) (string, bool) seleciona o motorista com a menor distância absoluta.",
        'Em empates de distância, escolha o menor ID em ordem lexicográfica. Retorne ("", false) quando não houver motoristas disponíveis.',
      ),
      level(
        "Reservar e liberar",
        "Uma correspondência reserva o motorista selecionado até sua liberação.",
        "Assign(position int) (string, bool) usa a ordenação de Nearest e torna esse motorista indisponível.",
        "Release(id string) bool torna um motorista reservado disponível novamente. IDs desconhecidos ou já disponíveis retornam false.",
        "As reservas não removem motoristas de Count(). Nearest deve ignorar motoristas reservados.",
      ),
    ],
  },
  "fare-calculator": {
    title: "Calculadora de tarifas",
    summary:
      "Crie um mecanismo determinístico de tarifas com preço dinâmico e cupons de desconto limitados.",
    tags: ["Valores monetários inteiros", "Precificação", "Validação"],
    levels: [
      level(
        "Calcular uma estimativa",
        "Represente todos os valores monetários em centavos inteiros.",
        "NewFareEngine(base, perKM, perMinute int) *FareEngine armazena tarifas não negativas.",
        "Quote(km, minutes int) (int, bool) retorna base + perKM*km + perMinute*minutes.",
        "Distância ou duração negativa retorna (0, false). As entradas e os produtos cabem em int.",
      ),
      level(
        "Aplicar preço dinâmico",
        "Permita configurar um multiplicador em pontos-base.",
        "SetSurge(basisPoints int) bool aceita valores de 10000 a 30000, inclusive. Chamadas inválidas preservam o multiplicador anterior.",
        "O multiplicador inicial é 10000 (1×). Quote multiplica a tarifa base pelo multiplicador e arredonda para baixo após dividir por 10000.",
      ),
      level(
        "Adicionar promoções",
        "Aplique um desconto fixo após o preço dinâmico.",
        "AddPromo(code string, cents int) bool aceita um código único e não vazio e um valor positivo em centavos.",
        "QuoteWithPromo(km, minutes int, code string) (int, bool) aplica uma promoção conhecida à estimativa com preço dinâmico, limitando o resultado mínimo a zero.",
        "Uma promoção desconhecida ou corrida inválida retorna (0, false). Os códigos são reutilizáveis e diferenciam maiúsculas de minúsculas.",
      ),
    ],
  },
  "trip-lifecycle": {
    title: "Ciclo de vida de uma viagem",
    summary:
      "Modele uma corrida como uma máquina de estados com transições explícitas e histórico imutável de eventos.",
    tags: ["Máquina de estados", "Encapsulamento", "Histórico de auditoria"],
    levels: [
      level(
        "Solicitar e atribuir",
        "Acompanhe os IDs das viagens e seus estados atuais.",
        'NewTripService() *TripService começa vazio. Request(id string) bool cria uma viagem única com ID não vazio no estado "requested".',
        'State(id string) (string, bool) retorna o estado ou ("", false) para IDs desconhecidos.',
        "Assign(id string) bool permite apenas a transição requested → assigned. Chamadas que falham mantêm o estado inalterado.",
      ),
      level(
        "Iniciar e concluir",
        "Garanta a ordem de uma viagem bem-sucedida.",
        "Start(id string) bool permite apenas a transição assigned → in_progress.",
        "Complete(id string) bool permite apenas a transição in_progress → completed.",
        "Transições repetidas e operações em viagens inexistentes retornam false. Viagens concluídas estão em estado terminal.",
      ),
      level(
        "Cancelar com histórico",
        "Registre todas as mudanças de estado bem-sucedidas, incluindo a criação.",
        "Cancel(id string) bool permite requested ou assigned → cancelled. Viagens em andamento, concluídas ou canceladas não podem ser canceladas.",
        "History(id string) []string retorna os estados em ordem. IDs desconhecidos retornam uma fatia vazia.",
        "Retorne uma cópia defensiva: quem chama não deve conseguir modificar o histórico do serviço. Operações que falham nunca acrescentam estados ao histórico.",
      ),
    ],
  },
  "driver-availability": {
    title: "Disponibilidade de motoristas",
    summary:
      "Mantenha o status dos motoristas e responda a consultas determinísticas da frota por cidade.",
    tags: ["Cadastro", "Filtragem", "Ordenação"],
    levels: [
      level(
        "Colocar motoristas online",
        "Registre cada motorista e sua cidade.",
        "NewFleet() *Fleet cria uma frota vazia. Online(id, city string) bool adiciona um motorista único com ID e cidade não vazios.",
        'City(id string) (string, bool) retorna a cidade cadastrada, incluindo motoristas ocupados. IDs desconhecidos retornam ("", false).',
        "Online não move um motorista existente; duplicatas retornam false.",
      ),
      level(
        "Consultar disponibilidade",
        "Acompanhe se os motoristas podem receber uma corrida.",
        "SetBusy(id string, busy bool) bool atualiza um motorista conhecido e retorna true; motoristas desconhecidos retornam false.",
        "Available(city string) []string retorna apenas os IDs dos motoristas desocupados nessa cidade, em ordem lexicográfica.",
        "Novos motoristas estão disponíveis. Cidades inexistentes retornam uma fatia vazia.",
      ),
      level(
        "Mover e remover motoristas",
        "Altere os integrantes da frota preservando o estado de ocupação.",
        "Move(id, city string) bool move um motorista conhecido para uma cidade não vazia; preserve seu status de ocupação.",
        "Offline(id string) bool remove um motorista conhecido. IDs removidos podem ser cadastrados novamente e começam disponíveis.",
        "Todas as operações inválidas retornam false e mantêm a frota inalterada.",
      ),
    ],
  },
  "wallet-ledger": {
    title: "Registro de carteiras",
    summary:
      "Implemente uma carteira com saques atômicos e atualizações idempotentes de saldo.",
    tags: ["Livro-razão", "Idempotência", "Valores monetários inteiros"],
    levels: [
      level(
        "Criar e abastecer carteiras",
        "Todos os saldos e valores são centavos inteiros; não é permitido saldo negativo.",
        "NewLedger() *Ledger começa vazio. Create(id string) bool aceita IDs únicos e não vazios com saldo zero.",
        "Deposit(id string, cents int) bool exige uma carteira existente e um valor positivo.",
        "Balance(id string) (int, bool) retorna o saldo atual ou (0, false) para IDs desconhecidos. Os valores cabem em int.",
      ),
      level(
        "Sacar atomicamente",
        "Rejeite débitos que não possam ser aplicados integralmente.",
        "Withdraw(id string, cents int) bool exige uma carteira existente, valor positivo e saldo suficiente.",
        "Saques que falham não devem alterar nenhum saldo. Sacar o saldo exato é válido.",
      ),
      level(
        "Operações idempotentes",
        "Evite efeitos duplicados quando clientes repetem uma chamada.",
        "Apply(operationID, walletID string, delta int) bool aceita um ID de operação novo e não vazio e uma variação delta diferente de zero, com sinal.",
        "Uma operação bem-sucedida altera o saldo se ele permanecer não negativo. Repetir a operação exata retorna true sem aplicá-la duas vezes.",
        "Reutilizar um ID de operação com outra carteira ou outro delta retorna false. Operações que falham não reservam seus IDs.",
      ),
    ],
  },
  "account-transfers": {
    title: "Transferências entre contas",
    summary:
      "Crie um serviço de transferências com movimentações atômicas, proteção contra repetições e estornos.",
    tags: ["Transações", "Atomicidade", "Estornos"],
    levels: [
      level(
        "Abrir contas",
        "Mantenha contas com saldos iniciais não negativos em centavos.",
        "NewBank() *Bank cria um banco vazio. Open(id string, cents int) bool exige um ID único e não vazio e cents >= 0.",
        "Balance(id string) (int, bool) retorna o saldo da conta ou (0, false) para contas inexistentes.",
      ),
      level(
        "Transferir dinheiro",
        "Mova dinheiro em uma única operação.",
        "Transfer(id, from, to string, cents int) bool exige um ID de transferência único e não vazio, contas existentes distintas, valor positivo em centavos e saldo suficiente.",
        "Débito e crédito acontecem juntos ou nenhum saldo muda. Repetir uma transferência bem-sucedida idêntica retorna true sem mover os fundos novamente.",
        "Reutilizar um ID de transferência com dados diferentes retorna false. Transferências que falham não reservam IDs. A aritmética cabe em int.",
      ),
      level(
        "Estornar uma transferência",
        "Desfaça uma transferência concluída exatamente uma vez.",
        "Reverse(id string) bool move o valor original do destinatário de volta ao remetente se o destinatário ainda tiver saldo suficiente.",
        "IDs desconhecidos, estornos repetidos e saldo insuficiente do destinatário retornam false sem alterações.",
        "Uma repetição idêntica de Transfer após o estorno retorna true e não deve mover os fundos novamente.",
      ),
    ],
  },
  "card-limits": {
    title: "Autorização de cartão",
    summary:
      "Autorize compras no cartão dentro do limite de crédito, liquide reservas e reembolse pagamentos.",
    tags: ["Limites de crédito", "Reservas", "Máquina de estados"],
    levels: [
      level(
        "Reservar crédito",
        "Uma conta de cartão informa o crédito disponível em centavos.",
        "NewCard(limit int) *Card recebe um limite não negativo. Available() int inicialmente retorna limit.",
        "Authorize(id string, cents int) bool reserva crédito para um ID único e não vazio e um valor positivo em centavos que não exceda o crédito disponível.",
        "Autorizações duplicadas ou rejeitadas mantêm o crédito disponível inalterado.",
      ),
      level(
        "Capturar ou cancelar",
        "Acompanhe os estados pendente e capturado das compras.",
        "Capture(id string) bool altera apenas uma autorização pendente para capturada. Não altera o crédito disponível.",
        "Void(id string) bool cancela apenas uma autorização pendente e restaura seu crédito.",
        "Transições de estado desconhecidas, repetidas ou ilegais retornam false. Os IDs continuam reservados após Void.",
      ),
      level(
        "Reembolsar compras capturadas",
        "Permita reembolsos parciais sem exceder o valor capturado.",
        "Refund(id string, cents int) bool exige uma compra capturada e um valor positivo em centavos que não exceda o valor ainda não reembolsado.",
        "Reembolsos bem-sucedidos restauram imediatamente o crédito disponível. São permitidos vários reembolsos parciais.",
        "Compras pendentes, canceladas, inexistentes ou totalmente reembolsadas não podem receber novos reembolsos.",
      ),
    ],
  },
  "transaction-history": {
    title: "Histórico de transações",
    summary:
      "Indexe um extrato com ordenação estável, filtros por categoria e paginação por cursor.",
    tags: ["Indexação", "Paginação", "Ordenação"],
    levels: [
      level(
        "Adicionar lançamentos ao extrato",
        "Armazene transações imutáveis usando o tempo lógico fornecido por quem chama.",
        "Entry possui os campos ID string, Timestamp int64, Cents int, Category string.",
        "NewStatement() *Statement cria um armazenamento vazio. Add(entry Entry) bool aceita um ID único e não vazio e Cents diferente de zero.",
        "Get(id string) (Entry, bool) recupera um lançamento. IDs desconhecidos retornam (Entry{}, false). Os horários e as categorias não têm restrições.",
      ),
      level(
        "Filtrar e ordenar",
        "Retorne os lançamentos mais recentes primeiro com desempate determinístico.",
        "List(category string) []Entry filtra pela categoria exata; uma categoria vazia significa todos os lançamentos.",
        "Ordene por Timestamp decrescente e depois por ID crescente. Retorne uma cópia defensiva.",
      ),
      level(
        "Paginar por cursor",
        "Use IDs estáveis de transações como cursores na ordenação de todos os lançamentos.",
        'Page(afterID string, limit int) []Entry retorna lançamentos estritamente após o cursor na ordem de List("").',
        "Um cursor vazio começa no início. Cursores desconhecidos ou limit <= 0 retornam uma fatia vazia.",
        "Retorne no máximo limit lançamentos sem alterar os dados do extrato. Ao chegar ao fim, retorne uma fatia vazia.",
      ),
    ],
  },
  "in-memory-filesystem": {
    title: "Sistema de arquivos em memória",
    summary:
      "Crie um pequeno armazenamento de arquivos por caminho com movimentações atômicas e consultas por prefixo.",
    tags: ["Mapas", "Caminhos", "Atomicidade"],
    levels: [
      level(
        "Gravar e ler arquivos",
        "Armazene o conteúdo por caminho absoluto canônico; os diretórios são implícitos.",
        "NewFileSystem() *FileSystem cria um armazenamento vazio. Write(path, content string) bool cria ou sobrescreve um arquivo válido.",
        'Um caminho válido começa com /, não é / e não tem barra final, segmento vazio, segmento "." ou segmento "..".',
        'Read(path string) (string, bool) retorna o conteúdo exato, incluindo uma string vazia, ou ("", false) se não existir.',
      ),
      level(
        "Listar e excluir",
        "Consulte arquivos dentro dos limites de um diretório.",
        'List(prefix string) []string retorna caminhos iguais a prefix ou que começam com prefix + "/", em ordem lexicográfica.',
        'List("/") lista todos os arquivos. Os prefixos devem ser / ou caminhos válidos de arquivos; prefixos inválidos retornam uma fatia vazia.',
        "Delete(path string) bool remove exatamente um arquivo existente. Não exclui os descendentes recursivamente.",
      ),
      level(
        "Mover atomicamente",
        "Renomeie um arquivo sem sobrescrever outro.",
        "Move(source, target string) bool só tem sucesso quando source existe, target é válido e target não existe.",
        "source igual a target retorna false. Em caso de falha, preserve o conteúdo da origem e do destino.",
        "Move não move descendentes nem exige a existência dos diretórios pais.",
      ),
    ],
  },
  "rate-limiter": {
    title: "Limitador de requisições de API",
    summary:
      "Proteja uma API com janelas determinísticas por cliente, limites personalizados e tempo para nova tentativa.",
    tags: ["Janelas de tempo", "Isolamento", "Condições de fronteira"],
    levels: [
      level(
        "Janelas fixas",
        "Use horários explícitos em segundos em vez do relógio real.",
        "NewLimiter(limit int, windowSeconds int64) *Limiter recebe parâmetros positivos.",
        "Allow(key string, now int64) bool permite no máximo limit requisições por chave em cada janela fixa [k*windowSeconds, (k+1)*windowSeconds).",
        "As chaves devem ser não vazias e os horários não negativos. Requisições inválidas retornam false. Os horários são globalmente não decrescentes.",
      ),
      level(
        "Limites por cliente",
        "Personalize limites sem zerar o uso da janela atual.",
        "SetLimit(key string, limit int) bool define um limite positivo para uma chave não vazia. Chamadas inválidas retornam false e preservam o limite anterior.",
        "Os limites personalizados entram em vigor imediatamente, inclusive na janela atual. As demais chaves continuam usando o limite padrão.",
        "Requisições negadas não consomem cota adicional.",
      ),
      level(
        "Informar a cota restante",
        "Exponha a cota sem consumi-la.",
        "Remaining(key string, now int64) int retorna max(0, effectiveLimit - used) na janela desse horário. Chave ou horário inválido retorna 0.",
        "RetryAfter(key string, now int64) int64 retorna 0 quando há cota restante; caso contrário, retorna os segundos até o início da próxima janela.",
        "Esses métodos de consulta nunca consomem cota. Use horários não decrescentes também nas consultas. Chave ou horário inválido retorna 0.",
      ),
    ],
  },
  "parking-lot": {
    title: "Estacionamento",
    summary:
      "Projete o estacionamento clássico: capacidade, entrada de veículos, tíquetes e vagas reservadas.",
    tags: ["Estacionamento", "Capacidade", "Tíquetes"],
    levels: [
      level(
        "Gerenciar um estacionamento",
        "Comece com capacidade fixa, em que cada veículo ocupa uma vaga.",
        "NewParkingLot(capacity int) *ParkingLot cria um estacionamento com capacidade não negativa, inicialmente vazio.",
        "Park(plate string) bool admite uma placa única e não vazia se houver vaga. Chamadas que falham nunca alteram a capacidade.",
        "Leave(plate string) bool remove um veículo estacionado. Placas vazias ou desconhecidas retornam false.",
        "Available() int retorna as vagas restantes. Um estacionamento com capacidade zero rejeita todas as entradas.",
      ),
      level(
        "Emitir tíquetes",
        "Emita números estáveis de tíquete para estadias bem-sucedidas.",
        "Ticket(plate string) (int, bool) retorna o tíquete atual ou (0, false) quando a placa não está estacionada.",
        "Os números dos tíquetes começam em 1 e aumentam em 1 a cada Park bem-sucedido. Chamadas rejeitadas não consomem números.",
        "Leave invalida o tíquete. Uma placa pode voltar depois e recebe um novo tíquete.",
      ),
      level(
        "Reservar uma vaga",
        "Reserve capacidade sem emitir um tíquete até a chegada do motorista.",
        "Reserve(plate string) bool reserva uma vaga livre para uma placa não vazia que não esteja estacionada nem reservada.",
        "As reservas reduzem Available(). Park para a mesma placa converte sua reserva em uma estadia, mesmo quando Available() é zero.",
        "CancelReservation(plate string) bool libera apenas uma reserva pendente. Leave rejeita placas que tenham apenas reserva.",
        "Ticket retorna (0, false) para reservas pendentes. Apenas Park bem-sucedido emite um tíquete.",
      ),
    ],
  },
  "multi-level-garage": {
    title: "Estacionamento de vários andares",
    summary:
      "Aloque vagas por tamanho em vários andares, localize veículos e gerencie reservas de forma determinística.",
    tags: ["Estacionamento", "Alocação", "Vários andares"],
    levels: [
      level(
        "Alocar a vaga certa",
        "Modele um estacionamento com tamanhos diferentes de vaga em cada andar.",
        "NewGarage(layout []string) *Garage usa uma string por andar, com os caracteres S, M e L representando as vagas na ordem dos índices. Andares e estacionamentos vazios são permitidos; o layout contém apenas esses caracteres.",
        'Park(plate, kind string) (string, bool) aceita motorcycle (S/M/L), car (M/L) e truck (L). Placas vazias, duplicadas ou tipos desconhecidos falham com ("", false).',
        'Escolha primeiro o menor tamanho compatível em todo o estacionamento, depois o menor andar e depois o menor índice de vaga. Retorne um ID com base 1, como "L2-S3".',
        "Leave(plate string) bool libera a vaga de um veículo estacionado. Available() int conta todas as vagas não alocadas.",
      ),
      level(
        "Localizar e contar",
        "Exponha consultas de alocação sem alterar o estado do estacionamento.",
        'Find(plate string) (string, bool) retorna a vaga alocada ou ("", false) se a placa for desconhecida.',
        "Count(level int) int retorna o número de vagas alocadas no andar de base 1. Andares inválidos retornam zero.",
        "A saída de um veículo limpa sua localização e reduz a contagem daquele andar. Reutilizar uma vaga liberada segue a ordem de alocação original.",
      ),
      level(
        "Reservar e dar entrada",
        "Permita reservas pendentes que ocupam uma vaga específica.",
        "Reserve(plate, kind string) (string, bool) aloca com a mesma validação e ordenação de Park, mas cria uma reserva pendente.",
        "CheckIn(plate string) bool converte uma reserva pendente em estadia, preservando a vaga. Entradas repetidas ou placas desconhecidas retornam false.",
        "CancelReservation(plate string) bool libera apenas reservas pendentes. Leave rejeita reservas pendentes. Park e Reserve rejeitam qualquer placa que já tenha uma alocação.",
        "Find inclui reservas pendentes. Count inclui vagas ocupadas e reservadas. Available exclui ambas.",
      ),
    ],
  },
  "bounded-stack": {
    title: "Pilha com capacidade limitada",
    summary:
      "Aprenda armazenamento em ordem de pilha, consultas seguras e mudanças de capacidade sem perder itens.",
    tags: ["Iniciante", "Pilha", "Capacidade"],
    levels: [
      level(
        "Empilhar e desempilhar",
        "Crie uma coleção de strings em que o último a entrar é o primeiro a sair.",
        "NewStack(capacity int) *Stack começa vazia com capacidade não negativa. Capacidade zero é permitida.",
        "Push(value string) bool adiciona um item se houver espaço. Strings vazias e valores duplicados são válidos; uma pilha cheia retorna false sem alterar seu conteúdo.",
        'Pop() (string, bool) remove e retorna o item empilhado mais recentemente. Uma pilha vazia retorna ("", false); desempilhar uma pilha vazia não muda nada.',
      ),
      level(
        "Consultar sem remover",
        "Adicione consultas que preservem a ordem da pilha.",
        'Peek() (string, bool) retorna o item do topo sem removê-lo ou ("", false) quando a pilha está vazia.',
        "Size() int retorna o número de itens armazenados. Chamadas repetidas de Peek e Size nunca alteram o conteúdo nem a capacidade.",
      ),
      level(
        "Alterar a capacidade com segurança",
        "Redimensione o limite preservando todos os itens armazenados.",
        "SetCapacity(capacity int) bool aceita qualquer capacidade não negativa maior ou igual a Size(), incluindo a capacidade atual.",
        "Capacidades negativas ou menores que Size() retornam false e preservam a capacidade e o conteúdo anteriores. Mudanças bem-sucedidas preservam a ordem dos itens.",
        "Uma pilha vazia pode diminuir até zero e crescer novamente. Push usa a capacidade aceita mais recentemente.",
      ),
    ],
  },
  "fifo-queue": {
    title: "Fila FIFO",
    summary:
      "Aprenda armazenamento em ordem de chegada, consulte os itens em espera e processe lotes nessa mesma ordem.",
    tags: ["Iniciante", "Fila", "Operações em lote"],
    levels: [
      level(
        "Entrar e sair da fila",
        "Armazene strings em ordem de chegada sem limite de capacidade.",
        "NewQueue() *Queue começa vazia. Enqueue(value string) bool acrescenta uma string não vazia e retorna true; strings vazias retornam false sem alterar a fila. Valores duplicados são permitidos.",
        'Dequeue() (string, bool) remove e retorna o valor que está esperando há mais tempo ou ("", false) quando a fila está vazia. Remover de uma fila vazia não muda nada.',
      ),
      level(
        "Consultar a fila de espera",
        "Leia o próximo item e o tamanho atual da fila.",
        'Front() (string, bool) retorna o valor que está esperando há mais tempo sem removê-lo ou ("", false) quando a fila está vazia.',
        "Size() int conta os itens em espera, incluindo duplicatas. Front e Size nunca alteram o conteúdo nem a ordem da fila.",
      ),
      level(
        "Processar lotes",
        "Retorne cópias do estado e remova vários itens de uma vez.",
        "Items() []string retorna todos os valores em espera na ordem de chegada como uma cópia defensiva. Modificar o resultado não deve alterar a fila.",
        "Take(limit int) []string remove e retorna até limit dos itens mais antigos na ordem de chegada. Um limite maior que Size() remove todos os itens em espera.",
        "Um limite zero ou negativo retorna uma fatia vazia e não altera nada. Resultados vazios podem ser nil ou fatias vazias. Lotes retornados não devem compartilhar armazenamento mutável com os itens restantes da fila.",
      ),
    ],
  },
  "parcel-locker": {
    title: "Armário de encomendas",
    summary:
      "Aloque compartimentos por tamanho, emita códigos de retirada de uso único e libere encomendas expiradas.",
    tags: ["Entrega", "Alocação", "Expiração"],
    levels: [
      level(
        "Armazenar uma entrega",
        "Escolha o menor compartimento adequado para cada encomenda.",
        "NewLocker(small, medium, large int) *Locker recebe contagens não negativas de compartimentos. Os IDs são S1..Ssmall, M1..Mmedium e L1..Llarge.",
        'Store(id, size string) (string, bool) aceita um ID de encomenda não vazio que não esteja armazenado e size exatamente "S", "M" ou "L". Escolha o menor tamanho compatível (S cabe em S/M/L, M cabe em M/L, L cabe em L) e depois o menor índice numérico de compartimento.',
        'Retorne o ID do compartimento atribuído ou ("", false) se a entrada for inválida ou não houver vaga. Chamadas rejeitadas não alteram nada. Available() int conta todos os compartimentos livres, independentemente do tamanho.',
      ),
      level(
        "Retirar com um código",
        "Dê a cada armazenamento bem-sucedido um código de uso único.",
        'Code(id string) (string, bool) retorna o código da encomenda armazenada ou ("", false) se ela for desconhecida. Os códigos são "P1", "P2", ... na ordem dos armazenamentos bem-sucedidos; falhas não consomem números.',
        'Pickup(code string) (string, bool) remove esse armazenamento e retorna o ID da encomenda. Códigos desconhecidos ou já usados retornam ("", false) e não alteram nada.',
        "Pickup libera o compartimento e invalida Code. O ID de uma encomenda retirada pode ser armazenado novamente com um código novo; códigos nunca são reutilizados.",
      ),
      level(
        "Liberar entregas expiradas",
        "Use horários inteiros explícitos e limpeza explícita.",
        "StoreUntil(id, size string, expiresAt, now int) (string, bool) usa as regras de alocação e código de Store e adiciona um prazo. Exija now >= 0 e expiresAt > now; chamadas inválidas não alteram nada. Store cria encomendas sem prazo.",
        "Expire(now int) []string remove todas as encomendas com prazo expiresAt <= now, libera seus compartimentos e invalida seus códigos. Retorne os IDs removidos em ordem lexicográfica. Horários negativos retornam uma fatia vazia sem alterações.",
        "Apenas Expire faz a limpeza: Store, StoreUntil, Code, Available e Pickup nunca expiram encomendas automaticamente. Uma encomenda pode ser retirada até a limpeza, mesmo após o prazo. Nenhum relógio real é usado; os horários podem chegar em qualquer ordem. Encomendas removidas nunca reaparecem.",
      ),
    ],
  },
  "score-tracker": {
    title: "Controle de pontuação",
    summary:
      "Cadastre jogadores, atualize suas pontuações e crie uma pequena classificação determinística.",
    tags: ["Iniciante", "Mapas", "Ordenação"],
    levels: [
      level(
        "Cadastrar jogadores",
        "Mantenha uma pontuação por nome de jogador.",
        "NewScoreTracker() *ScoreTracker começa vazio. Add(name string) bool cadastra um nome único e não vazio com pontuação zero. Nomes vazios ou duplicados retornam false sem alterar as pontuações armazenadas.",
        "Score(name string) (int, bool) retorna a pontuação cadastrada ou (0, false) para nomes desconhecidos. Os nomes diferenciam maiúsculas de minúsculas; não é necessário remover espaços nem fazer outra validação.",
      ),
      level(
        "Atribuir e zerar pontos",
        "Altere pontuações existentes mantendo os jogadores cadastrados.",
        "Award(name string, points int) bool acrescenta pontos não negativos a um jogador cadastrado. Zero ponto é válido; pontos negativos ou nomes desconhecidos retornam false sem alterações. Os totais cabem em int e no intervalo de inteiros seguros do TypeScript.",
        "Reset(name string) bool zera a pontuação de um jogador cadastrado e retorna true mesmo se ela já for zero. Jogadores desconhecidos retornam false. Atualizar um jogador nunca altera a pontuação de outro.",
      ),
      level(
        "Listar os líderes",
        "Ordene os nomes dos jogadores por suas pontuações atuais.",
        "Leaders(limit int) []string retorna até limit nomes cadastrados, ordenados por pontuação decrescente e depois por nome em ordem lexicográfica crescente para desempatar. Inclua jogadores com pontuação zero.",
        "Limites zero ou negativos retornam uma fatia vazia. Um limite maior que o número de jogadores retorna todos eles. Essa consulta nunca altera pontuações; retorne uma cópia defensiva para que modificar os nomes retornados não altere o controle.",
      ),
    ],
  },
  "contact-directory": {
    title: "Agenda de contatos",
    summary:
      "Armazene contatos por nome, edite seus telefones e pesquise nomes por um prefixo simples.",
    tags: ["Iniciante", "Mapas", "Busca por prefixo"],
    levels: [
      level(
        "Adicionar e consultar contatos",
        "Armazene uma string de telefone para cada nome de contato.",
        "NewDirectory() *Directory começa vazia. Add(name, phone string) bool armazena um contato apenas quando ambas as strings são não vazias e o nome ainda não existe. Chamadas que falham preservam os contatos armazenados.",
        'Get(name string) (string, bool) retorna o telefone armazenado ou ("", false) para nomes desconhecidos. Os nomes diferenciam maiúsculas de minúsculas. Telefones não exigem validação de formato e nenhuma entrada tem seus espaços removidos.',
      ),
      level(
        "Editar e remover contatos",
        "Altere um telefone sem criar outro contato.",
        "Update(name, phone string) bool altera o telefone de um contato existente para uma string não vazia. Retorne true mesmo se o telefone não mudar. Nomes desconhecidos ou telefones vazios retornam false sem alterações.",
        "Delete(name string) bool remove um contato existente e retorna true; nomes desconhecidos retornam false. Um nome excluído pode ser adicionado novamente. Atualizações e exclusões nunca alteram outros contatos.",
      ),
      level(
        "Encontrar nomes por prefixo",
        "Crie uma busca de contatos pequena e previsível.",
        "Search(prefix string) []string retorna nomes que começam com o prefixo exato, diferenciando maiúsculas de minúsculas e ordenando lexicograficamente. O prefixo vazio corresponde a todos os nomes; sem correspondências, retorne uma fatia vazia.",
        "Retorne apenas nomes, sem telefones. Search nunca altera contatos, reflete as adições e exclusões atuais e retorna uma cópia defensiva: modificar o resultado não pode renomear nem remover um contato armazenado.",
      ),
    ],
  },
  "shopping-cart": {
    title: "Carrinho de compras",
    summary:
      "Crie um pequeno carrinho passo a passo: itens distintos, quantidades editáveis e totais em centavos inteiros.",
    tags: ["Iniciante", "Coleções", "Valores monetários inteiros"],
    levels: [
      level(
        "Adicionar itens distintos",
        "Mantenha uma linha no carrinho por ID de item.",
        "NewCart() *Cart cria um carrinho vazio. AddItem(id string, unitPrice int) bool adiciona um ID único e não vazio, diferenciando maiúsculas de minúsculas, com quantidade 1 e preço unitário não negativo em centavos.",
        "Count() int retorna o número de linhas distintas do carrinho, não a soma das quantidades. IDs vazios, preços negativos e IDs duplicados retornam false sem alterar linhas ou preços existentes. Itens gratuitos são válidos.",
        "Todos os preços, quantidades, produtos e somas cabem em int (inteiros seguros no TypeScript). Não há impostos, descontos, verificações de estoque nem serviços externos.",
      ),
      level(
        "Editar quantidades e remover itens",
        "Altere uma linha sem duplicá-la.",
        "Quantity(id string) (int, bool) retorna a quantidade positiva atual de uma linha ou (0, false) se ela não existir.",
        "SetQuantity(id string, quantity int) bool define uma quantidade positiva para uma linha existente. IDs desconhecidos e quantidades zero ou negativas retornam false sem alterações. Definir a mesma quantidade tem sucesso.",
        "Remove(id string) bool remove uma linha existente; IDs desconhecidos retornam false. Um ID removido pode ser adicionado novamente com outro preço unitário e começa de novo com quantidade 1. Atualizações de quantidade nunca alteram Count().",
      ),
      level(
        "Calcular e consultar o carrinho",
        "Resuma as linhas armazenadas sem alterá-las.",
        "Total() int retorna a soma de unitPrice * quantity de todas as linhas atuais ou zero quando o carrinho está vazio. Mudanças de quantidade e remoções bem-sucedidas são refletidas imediatamente.",
        "Items() []string retorna todos os IDs atuais em ordem lexicográfica como uma nova cópia do estado. Modificá-la não deve alterar o carrinho. Resultados vazios podem ser nil ou fatias vazias em Go.",
        "Total e Items nunca alteram quantidades, preços, ordem nem os itens presentes. Chamadas que falham nos níveis anteriores também mantêm os totais inalterados.",
      ),
    ],
  },
  thermostat: {
    title: "Termostato",
    summary:
      "Pratique pequenas atualizações de estado, validação de entradas e limites claros de aquecimento e refrigeração com temperaturas inteiras.",
    tags: ["Iniciante", "Validação", "Condições"],
    levels: [
      level(
        "Acompanhar a temperatura atual e a desejada",
        "Armazene temperaturas Celsius inteiras sem sensor nem relógio real.",
        "NewThermostat(initial int) *Thermostat recebe uma temperatura atual inicial de -50 a 50, inclusive, e começa com a temperatura desejada em 20. Current() int e Target() int retornam esses valores armazenados.",
        "Update(current int) bool aceita uma leitura atual de -50 a 50, inclusive. SetTarget(target int) bool aceita uma temperatura desejada de 5 a 35, inclusive. Chamadas válidas armazenam o valor e retornam true, incluindo valores inalterados.",
        "Chamadas fora do intervalo retornam false e preservam ambos os valores. Atualizar a leitura atual nunca altera a temperatura desejada e definir a desejada nunca altera a leitura atual.",
      ),
      level(
        "Selecionar um modo de operação",
        "Calcule se é necessário aquecer ou resfriar agora.",
        'SetMode(mode string) bool aceita exatamente "off", "heat" ou "cool". O modo inicial é "off". Modos inválidos retornam false e preservam o anterior; chamadas válidas retornam true, incluindo definir o mesmo modo.',
        "Active() bool retorna false no modo off. No modo heat, retorna current < target; no modo cool, retorna current > target. A igualdade é inativa em ambos os modos.",
        "Active é uma consulta pura: nunca altera o modo nem as temperaturas. Atualizações e mudanças na temperatura desejada afetam a próxima consulta imediatamente. Não há dispositivo físico, temporizador nem estado ligado/desligado memorizado.",
      ),
      level(
        "Adicionar uma faixa de tolerância",
        "Evite o funcionamento perto da temperatura desejada usando comparações simples.",
        "SetTolerance(degrees int) bool aceita inteiros de 0 a 5, inclusive, inicialmente zero. Tolerance() int retorna a tolerância armazenada. Chamadas inválidas retornam false e preservam a anterior; valores válidos inalterados retornam true.",
        "Com tolerância d, heat só fica ativo quando current < target - d e cool só fica ativo quando current > target + d. Os limites exatos são inativos. O modo off é sempre inativo.",
        "A tolerância não altera Current nem Target, e definir temperaturas não a reinicia. Recalcule Active diretamente a partir dos valores atuais a cada chamada; não é necessário histerese nem histórico. Tolerância zero preserva todo o comportamento anterior.",
      ),
    ],
  },
  "seat-booking": {
    title: "Reserva de assentos",
    summary:
      "Reserve grupos de passageiros em partidas programadas, mova reservas atomicamente e promova uma lista de espera estritamente FIFO.",
    tags: [
      "Alocação de grupos",
      "Atualizações atômicas",
      "Lista de espera FIFO",
    ],
    levels: [
      level(
        "Reservar grupos de passageiros",
        "Acompanhe estoques independentes de assentos para partidas programadas.",
        "NewSeatBooking() *SeatBooking cria um serviço vazio. AddDeparture(id string, capacity int) bool aceita um ID único e não vazio e capacidade não negativa; chamadas rejeitadas preservam os dados existentes.",
        "SeatsLeft(departure string) (int, bool) retorna os assentos restantes ou (0, false) para uma partida desconhecida.",
        "Book(id, departure string, seats int) bool reserva um grupo inteiro apenas quando o ID da reserva é não vazio e não utilizado, a partida existe, seats é positivo e há assentos suficientes. Solicitações que falham não alteram nada e não consomem IDs.",
        "Os IDs diferenciam maiúsculas de minúsculas. Capacidade, quantidades e suas somas cabem em int (inteiros seguros no TypeScript). Não são atribuídos números de assento.",
      ),
      level(
        "Cancelar e mover reservas",
        "Altere a reserva de um grupo sem dividi-lo nem perder seus assentos originais.",
        "Cancel(id string) bool remove uma reserva ativa e devolve todos os assentos do grupo à sua partida. IDs desconhecidos retornam false. O ID de uma reserva cancelada pode ser reutilizado.",
        "Move(id, departure string) bool move uma reserva ativa, com o tamanho original do grupo, para uma partida existente com assentos suficientes. Falhas preservam ambas as partidas e a reserva.",
        "Mover para a partida atual da reserva tem sucesso sem alterar assentos, mesmo se ela estiver cheia. Mover nunca altera o ID da reserva nem o tamanho do grupo.",
      ),
      level(
        "Promover uma lista de espera FIFO",
        "Enfileire grupos inteiros e promova-os explicitamente quando houver capacidade.",
        "Queue(id, departure string, seats int) bool acrescenta uma solicitação com ID de reserva não vazio e não utilizado, partida existente e seats positivo não maior que a capacidade total da partida. Tem sucesso mesmo quando já há assentos disponíveis. Solicitações em espera não consomem assentos, mas reservam seus IDs globalmente.",
        "Waiting(departure string) []string retorna os IDs em espera na ordem de inserção ou uma lista vazia para uma partida desconhecida. Retorne uma cópia defensiva.",
        "Promote(departure string) []string converte repetidamente a primeira solicitação em reserva ativa enquanto o grupo inteiro couber. Pare no primeiro grupo que não couber; nunca o pule. Retorne os IDs recém-reservados na ordem de promoção ou uma lista vazia para uma partida desconhecida.",
        "Cancel remove uma reserva ativa ou uma solicitação em espera e libera seu ID. Move aceita apenas reservas ativas. Book rejeita IDs em espera. Book, Cancel e Move não promovem solicitações automaticamente; reservas comuns podem usar assentos livres mesmo com uma fila.",
      ),
    ],
  },
  "inventory-reservations": {
    title: "Reservas de estoque",
    summary:
      "Separe o estoque físico das unidades reservadas e conclua pedidos com confirmações seguras para repetição e regras precisas de liberação.",
    tags: ["Estoque", "Reservas", "Idempotência"],
    levels: [
      level(
        "Gerenciar o estoque físico",
        "Mantenha contagens independentes de unidades por SKU de produto.",
        "NewInventory() *Inventory cria um estoque vazio. Add(sku string, units int) bool cria um SKU único e não vazio com unidades não negativas. Chamadas inválidas preservam o estado.",
        "Stock(sku string) (int, bool) retorna as unidades físicas em estoque ou (0, false) para um SKU desconhecido. Restock(sku string, units int) bool adiciona uma quantidade positiva a um SKU existente; caso contrário, retorna false.",
        "SKUs e IDs de reserva diferenciam maiúsculas de minúsculas. Todas as quantidades e somas cabem em int (inteiros seguros no TypeScript). Não há produtos implícitos nem relógios externos.",
      ),
      level(
        "Reservar e liberar unidades",
        "Reserve estoque sem removê-lo do depósito.",
        "Available(sku string) (int, bool) retorna o estoque físico menos as reservas ativas ou (0, false) para um SKU desconhecido.",
        "Hold(id, sku string, units int) bool reserva uma quantidade positiva quando o ID é não vazio e não utilizado, o SKU existe e há unidades suficientes. Uma reserva rejeitada não altera nada nem consome seu ID. Os IDs são globais entre SKUs.",
        "Release(id string) bool cancela uma reserva ativa e restaura a disponibilidade sem alterar Stock. Liberações repetidas e IDs desconhecidos retornam false. O ID de qualquer Hold bem-sucedido permanece consumido para sempre, mesmo após a liberação.",
      ),
      level(
        "Confirmar pedidos com segurança",
        "Converta unidades reservadas em unidades enviadas, permitindo novas tentativas.",
        "Commit(id string) bool conclui uma reserva ativa: reduza o Stock físico pela quantidade reservada e remova a reserva ativa. Available permanece inalterado nessa conversão.",
        "Commit de um ID já confirmado retorna true sem novas alterações. IDs desconhecidos ou liberados retornam false. Release rejeita IDs confirmados. Um ID concluído ou liberado nunca pode ser reservado novamente.",
        "Restock continua adicionando estoque físico e disponível. Uma operação que falha ou é repetida nunca deve afetar outra reserva ou SKU.",
      ),
    ],
  },
  "vending-machine": {
    title: "Máquina de vendas",
    summary:
      "Crie uma pequena máquina de vendas sem dinheiro físico, com estoque, crédito da sessão, compras atômicas e reembolsos.",
    tags: [
      "Composição",
      "Valores monetários inteiros",
      "Atualizações atômicas",
    ],
    levels: [
      level(
        "Carregar o catálogo de produtos",
        "Mantenha preços e contagens de estoque por código de produto.",
        "NewVendingMachine() *VendingMachine cria uma máquina vazia. AddProduct(code string, price, units int) bool adiciona um código único e não vazio com preço positivo em centavos e estoque não negativo. Adições rejeitadas preservam o estado.",
        "Stock(code string) (int, bool) e Price(code string) (int, bool) retornam o valor armazenado ou (0, false) para um produto desconhecido. Códigos de produto diferenciam maiúsculas de minúsculas.",
        "Valores monetários e quantidades de estoque são inteiros; todos os valores e somas cabem em int (inteiros seguros no TypeScript). A máquina atende um saldo de cliente por vez e não exige serviço externo de pagamento.",
      ),
      level(
        "Aceitar crédito e vender",
        "Conclua cada compra como uma mudança atômica de estado.",
        "Insert(cents int) bool adiciona centavos positivos ao saldo da sessão; valores não positivos retornam false sem alterar o crédito. Credit() int inicialmente retorna zero.",
        "Purchase(code string) bool só tem sucesso para um produto conhecido com pelo menos uma unidade e crédito suficiente. Desconte seu preço atual e exatamente uma unidade juntos; compras que falham não alteram estoque nem crédito.",
        "Crédito não utilizado continua disponível para compras futuras. Crédito igual ao preço exato é suficiente; produtos sem estoque não podem ser comprados.",
      ),
      level(
        "Reembolsar e manter a máquina",
        "Devolva o crédito não utilizado e atualize produtos sem interferir na sessão do cliente.",
        "Refund() int retorna todo o crédito não utilizado e o zera. Reembolsos repetidos retornam zero; unidades compradas e dinheiro já gasto não são afetados.",
        "Restock(code string, units int) bool adiciona uma quantidade positiva a um produto existente. SetPrice(code string, cents int) bool altera um produto existente para um preço positivo. Produtos desconhecidos e quantidades inválidas retornam false e preservam todo o estado.",
        "Mudanças de preço valem para compras posteriores, inclusive em uma sessão que já tenha crédito. Reposição e mudanças de preço nunca alteram o crédito da sessão.",
      ),
    ],
  },
  "library-lending": {
    title: "Empréstimos de biblioteca",
    summary:
      "Gerencie exemplares e empréstimos de leitores, imponha limites e preserve empréstimos quando as regras mudarem.",
    tags: ["Relacionamentos entre objetos", "Posse", "Mudanças de regras"],
    levels: [
      level(
        "Cadastrar livros e leitores",
        "Mantenha um catálogo com vários exemplares e um cadastro independente de leitores.",
        "NewLibrary() *Library cria uma biblioteca vazia. AddBook(id string, copies int) bool cria um ID de livro único e não vazio com exemplares não negativos. AddMember(id string) bool cria um ID de leitor único e não vazio. Adições inválidas não alteram nada.",
        "Available(book string) (int, bool) retorna exemplares não emprestados ou (0, false) para um livro desconhecido. Inicialmente todos os exemplares cadastrados estão disponíveis.",
        "IDs de livros e leitores diferenciam maiúsculas de minúsculas e usam espaços de nomes independentes, portanto um leitor e um livro podem compartilhar um ID. Contagens e somas cabem em int (inteiros seguros no TypeScript).",
      ),
      level(
        "Emprestar e devolver exemplares",
        "Acompanhe a posse de cada empréstimo e retorne resumos determinísticos por leitor.",
        "Borrow(member, book string) bool empresta um exemplar disponível a um leitor cadastrado. Um leitor pode pegar no máximo um exemplar de cada livro e inicialmente pode ter no máximo dois livros no total. IDs desconhecidos, falta de estoque, empréstimos duplicados e violações de limite retornam false sem alterar o estado.",
        "Return(member, book string) bool encerra o empréstimo ativo desse leitor e restaura exatamente um exemplar disponível. Empréstimos desconhecidos ou que não pertençam ao leitor retornam false sem alterar nada.",
        "Loans(member string) []string retorna os IDs dos livros emprestados ao leitor em ordem lexicográfica; leitores desconhecidos retornam uma lista vazia. Retorne uma cópia defensiva. Livros devolvidos podem ser emprestados novamente.",
      ),
      level(
        "Alterar as regras de empréstimo",
        "Ajuste os limites sem cancelar os empréstimos existentes do leitor.",
        "SetLimit(member string, limit int) bool substitui o limite de um leitor cadastrado por um número não negativo. Leitores desconhecidos ou limites negativos retornam false e preservam o limite anterior. Os limites são independentes por leitor.",
        "Reduzir um limite para menos que o número atual de empréstimos preserva todos os empréstimos ativos. Borrow rejeita novos empréstimos até que o leitor tenha menos empréstimos que o novo limite. Um limite zero bloqueia todos os novos empréstimos, mas permite devoluções.",
        "Remaining(member string) (int, bool) retorna max(0, limite menos quantidade atual de empréstimos) ou (0, false) para um leitor desconhecido. Empréstimos e atualizações de regras que falham nunca consomem cota.",
      ),
    ],
  },
  "lru-cache": {
    title: "Cache LRU",
    summary:
      "Crie um cache de chave e valor com capacidade limitada, remoção baseada em acesso, redimensionamento e cópias isoladas do estado.",
    tags: ["Cache", "Recência", "Remoção"],
    levels: [
      level(
        "Armazenar e recuperar",
        "Mantenha valores de string sob chaves não vazias que diferenciam maiúsculas de minúsculas.",
        "NewLRUCache(capacity int) *LRUCache cria um cache vazio com capacidade não negativa. Len() int retorna o número de chaves armazenadas.",
        "Put(key, value string) bool insere ou sobrescreve uma chave. Chaves vazias e todas as gravações com capacidade zero retornam false sem alterar o estado; valores vazios são válidos.",
        'Get(key string) (string, bool) retorna o valor armazenado ou ("", false) se não existir. Um valor vazio armazenado retorna ("", true).',
        "Neste nível, gravações em novas chaves ficam dentro da capacidade. O próximo nível define a remoção quando a capacidade é atingida.",
      ),
      level(
        "Remover por ordem de acesso",
        "Acompanhe as entradas menos usadas recentemente conforme leituras e gravações ocorrem.",
        "Cada Put e Get bem-sucedido torna a chave a mais usada recentemente. Um Get sem correspondência e um Put rejeitado preservam a ordem de recência.",
        "Ao inserir uma chave nova em um cache cheio com capacidade positiva, remova exatamente a chave menos usada recentemente antes de inserir. Put continua retornando true.",
        "Sobrescrever uma chave existente nunca remove outra entrada nem aumenta Len(). Todos os contratos anteriores continuam valendo.",
      ),
      level(
        "Redimensionar e consultar",
        "Altere o limite de memória e consulte a recência sem expor o armazenamento interno.",
        "Resize(capacity int) bool rejeita capacidades negativas sem alterar o estado. Caso contrário, retorna true, atualiza a capacidade e remove imediatamente as chaves menos usadas recentemente até Len() caber.",
        "Resize(0) limpa o cache e rejeita chamadas posteriores de Put até um redimensionamento positivo. Aumentar a capacidade preserva todas as entradas e sua recência; redimensionar para a mesma capacidade tem sucesso.",
        "Keys() []string retorna uma nova cópia do estado em ordem da chave menos para a mais usada recentemente. Keys e Resize não atualizam a recência; modificar a fatia retornada não deve afetar o cache. Cópias vazias podem ser nil ou vazias em Go.",
      ),
    ],
  },
  "delayed-job-queue": {
    title: "Fila de tarefas agendadas",
    summary:
      "Agende tarefas com ordenação determinística por horário, execução explícita, cancelamento e novas tentativas.",
    tags: ["Agendamento", "Máquina de estados", "Novas tentativas"],
    levels: [
      level(
        "Agendar tarefas",
        "Cadastre tarefas com IDs únicos em um relógio sintético.",
        "NewJobQueue() *JobQueue cria uma fila vazia. Enqueue(id string, due int) bool aceita um ID não vazio nunca aceito antes e um horário de execução não negativo.",
        "Os IDs diferenciam maiúsculas de minúsculas e permanecem reservados para sempre após Enqueue bem-sucedido, inclusive após cancelamento ou conclusão. Chamadas que falham não reservam IDs nem alteram estado.",
        "Pending() int conta apenas tarefas em espera, incluindo as agendadas para o futuro. Todos os horários são segundos inteiros; não há relógio real, processo em segundo plano nem persistência.",
      ),
      level(
        "Obter tarefas prontas",
        "Obtenha uma tarefa com horário atingido por vez, em ordem determinística.",
        "Take(now int) (string, bool) seleciona uma tarefa em espera com due <= now, ordenando pelo menor due e depois pelo menor ID lexicográfico. Move essa tarefa para o estado em execução e a remove de Pending().",
        'Se now for negativo ou nenhuma tarefa em espera tiver atingido seu horário, retorne ("", false) sem alterar o estado. Uma tarefa não pode ser obtida novamente enquanto estiver em execução.',
        "Cada Take usa o now fornecido de forma independente; os horários não precisam aumentar. Obter uma tarefa nunca libera seu ID reservado.",
      ),
      level(
        "Concluir, tentar novamente e cancelar",
        "Gerencie os resultados da execução sem duplicar uma tarefa.",
        "Finish(id string) bool tem sucesso apenas para uma tarefa em execução, movendo-a para o estado terminal concluído. Conclusões repetidas ou desconhecidas retornam false.",
        "Retry(id string, due int) bool tem sucesso apenas para uma tarefa em execução e horário não negativo, movendo o mesmo ID de volta à espera com o novo horário. Retry pode ser repetido após várias execuções; tentativas inválidas preservam o estado em execução.",
        "Cancel(id string) bool tem sucesso apenas para uma tarefa em espera, movendo-a para o estado terminal cancelado. Tarefas em execução, concluídas, canceladas ou desconhecidas retornam false. Cancel e Finish não tornam os IDs reutilizáveis.",
        "Pending conta apenas tarefas em espera durante todas as transições. Todas as chamadas de ciclo de vida que falham preservam o estado das tarefas, seus horários e sua ordenação.",
      ),
    ],
  },
  "dependency-planner": {
    title: "Planejador de dependências",
    summary:
      "Avance para problemas difíceis mantendo um pequeno grafo de tarefas acíclico e concluindo trabalho apenas quando seus pré-requisitos estiverem prontos.",
    tags: ["Transição para difícil", "Grafos direcionados", "Invariantes"],
    levels: [
      level(
        "Cadastrar tarefas",
        "Comece com um conjunto de IDs de tarefas em memória; não há relógio, concorrência nem atribuição de execução.",
        "NewDependencyPlanner() *DependencyPlanner cria um planejador vazio. Add(id string) bool adiciona um ID único e não vazio, diferenciando maiúsculas de minúsculas, inicialmente incompleto e sem pré-requisitos.",
        "Count() int conta todas as tarefas aceitas, incluindo as concluídas. IDs vazios ou duplicados retornam false sem alterar tarefas existentes.",
      ),
      level(
        "Proteger o grafo de dependências",
        "Introduza uma invariante: uma tarefa nunca deve depender de si mesma, mesmo indiretamente.",
        "Depend(task, prerequisite string) bool adiciona um pré-requisito direto a uma tarefa. Ambos os IDs devem existir e ser diferentes; arestas duplicadas, tarefas de destino concluídas e arestas que criariam qualquer ciclo direcionado retornam false sem alterar o grafo.",
        'O pré-requisito já pode estar concluído. Uma dependência tem direção: Depend("ship", "build") significa que build deve terminar antes de ship; não faz build depender de ship.',
        "Dependencies(id string) []string retorna uma nova cópia dos IDs apenas dos pré-requisitos diretos, em ordem lexicográfica. IDs desconhecidos retornam uma cópia vazia; Go pode retornar nil. Modificar uma cópia não deve alterar o grafo.",
        "A detecção de ciclos deve considerar caminhos de qualquer comprimento. Rejeitar uma aresta nunca cria tarefas nem remove arestas existentes. Grafos pequenos são suficientes; não há meta de complexidade.",
      ),
      level(
        "Concluir trabalho elegível",
        "Use o grafo protegido para mostrar os próximos passos e garantir a ordem de execução.",
        "Ready() []string retorna uma nova cópia, em ordem lexicográfica, de todas as tarefas incompletas cujos pré-requisitos diretos estão concluídos. Tarefas sem pré-requisitos ficam prontas imediatamente. Consultar Ready não altera o estado.",
        "Complete(id string) bool tem sucesso apenas quando a tarefa existe, está incompleta e está pronta no momento. O sucesso a marca permanentemente como concluída; tarefas desconhecidas, bloqueadas ou já concluídas retornam false sem alterar o estado.",
        "Concluir uma tarefa preserva a tarefa, suas arestas de dependência e seu ID reservado. Dependencies e Count continuam incluindo tarefas concluídas; Ready as exclui. Uma tarefa concluída não pode receber novas dependências, mas pode ser pré-requisito de outra.",
        "As cópias retornadas por Ready são independentes do armazenamento do planejador. Todas as regras anteriores de validação e ciclos continuam valendo.",
      ),
    ],
  },
};

type ProblemContent = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  levels: {
    title: string;
    description: string;
    requirements: string[];
    examples: { input: string; output: string }[];
  }[];
};

/** Translate prose only; executable examples and every other field stay intact. */
export function localizeProblem<T extends ProblemContent>(
  problem: T,
  locale: "en" | "pt-BR",
): T {
  if (locale === "en") return problem;
  const translation = problemTranslations[problem.id];
  if (!translation) return problem;
  return {
    ...problem,
    title: translation.title,
    summary: translation.summary,
    tags: translation.tags,
    levels: problem.levels.map((item, index) => ({
      ...item,
      ...translation.levels[index],
    })),
  };
}
