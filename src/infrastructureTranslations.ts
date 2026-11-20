const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const infrastructureTranslations = {
  "feature-flags": {
    title: "Registro de funcionalidades",
    summary:
      "Gerencie valores padrão de funcionalidades e preferências por usuário sem misturar configurações.",
    tags: ["Configuração", "Estado por chave", "Preferências"],
    levels: [
      level(
        "Definir valores padrão",
        "Armazene um valor booleano padrão para cada funcionalidade.",
        "NewFlags() *Flags cria um registro vazio. Define(flag string, enabled bool) bool adiciona um nome único e não vazio, diferenciando maiúsculas de minúsculas. Nomes vazios ou duplicados retornam false sem alterações.",
        "Enabled(flag, user string) bool inicialmente retorna o valor padrão. Funcionalidades desconhecidas retornam false; um usuário vazio é permitido nesta consulta e usa o padrão.",
      ),
      level(
        "Personalizar para um usuário",
        "Configure uma funcionalidade para uma pessoa específica.",
        "Override(flag, user string, enabled bool) bool cria ou substitui uma preferência para uma funcionalidade conhecida e um usuário não vazio. IDs diferenciam maiúsculas de minúsculas. Chamadas inválidas retornam false sem alterações; chamadas válidas repetidas retornam true.",
        "Enabled retorna a preferência explícita quando existir, inclusive false; caso contrário, retorna o padrão. Cada par (funcionalidade, usuário) é independente.",
      ),
      level(
        "Atualizar padrões e limpar preferências",
        "Altere configurações globais preservando escolhas explícitas.",
        "SetDefault(flag string, enabled bool) bool atualiza uma funcionalidade conhecida; desconhecidas retornam false. Preferências existentes são preservadas, inclusive quando iguais ao padrão anterior.",
        "ClearOverride(flag, user string) bool remove uma preferência existente e retorna true; caso contrário, false. A próxima consulta Enabled usa o padrão atual. Nenhuma operação remove funcionalidades.",
      ),
    ],
  },
  "pubsub-broker": {
    title: "Mensageria por publicação e assinatura",
    summary:
      "Encaminhe mensagens de tópicos para caixas de entrada, preservando a ordem e o isolamento das filas.",
    tags: ["Mensageria", "Distribuição", "Propriedade de filas"],
    levels: [
      level(
        "Cadastrar assinaturas",
        "Mantenha as associações exatas entre tópicos e assinantes.",
        "NewBroker() *Broker cria um serviço vazio. Subscribe(topic, subscriber string) bool aceita dois IDs não vazios, diferenciando maiúsculas de minúsculas, e cria a associação. Associações duplicadas ou inválidas retornam false sem alterações.",
        "Subscribers(topic string) []string retorna os IDs em ordem lexicográfica como uma cópia isolada. Tópicos desconhecidos retornam uma lista vazia. Um assinante pode participar de vários tópicos.",
      ),
      level(
        "Publicar nas caixas de entrada",
        "Distribua mensagens de forma síncrona para filas por assinante.",
        "Publish(topic, message string) int acrescenta a mensagem uma vez à caixa de cada assinante atual e retorna o número de destinatários. Tópicos desconhecidos ou vazios retornam zero; mensagens podem ser vazias e repetidas.",
        "Drain(subscriber string) []string retorna as mensagens na ordem das chamadas de publicação e esvazia apenas essa caixa. Todos os tópicos assinados alimentam a mesma caixa; assinantes desconhecidos retornam uma lista vazia. Não há entrega em segundo plano nem threads.",
      ),
      level(
        "Cancelar assinaturas e consultar",
        "Altere entregas futuras sem apagar mensagens pendentes.",
        "Unsubscribe(topic, subscriber string) bool remove uma associação existente e retorna true; caso contrário, false. Mensagens pendentes continuam disponíveis. É permitido assinar novamente, sem receber publicações anteriores outra vez.",
        "Peek(subscriber string) []string retorna uma cópia isolada sem consumir mensagens. Modificar resultados de Peek, Drain ou Subscribers não pode alterar o estado nem outra caixa de entrada. Resultados vazios em Go podem ser nil ou fatias vazias.",
      ),
    ],
  },
  "ttl-key-value-store": {
    title: "Armazenamento chave-valor com expiração",
    summary:
      "Mantenha valores com prazo de validade em um relógio lógico e adicione substituição condicional atômica com renovação.",
    tags: ["Expiração", "Tempo lógico", "Substituição condicional"],
    levels: [
      level(
        "Armazenar valores com prazo",
        "Comece com um relógio lógico fixado em zero.",
        "NewTTLStore() *TTLStore começa vazio no instante zero. Put(key, value string, ttl int) bool aceita uma chave não vazia, diferenciando maiúsculas de minúsculas, e prazo positivo; substitui qualquer valor anterior. Valores podem ser vazios. Chamadas inválidas retornam false sem alterações.",
        'Get(key string) (string, bool) retorna um valor válido ou ("", false). Delete(key string) bool remove uma chave válida; caso contrário, false. Prazos e somas de instantes cabem em int (inteiros seguros em TypeScript). Não há relógio real, persistência ou concorrência.',
      ),
      level(
        "Avançar o tempo e expirar",
        "Use um relógio determinístico que nunca retrocede.",
        "Advance(now int) bool define o relógio para um instante não negativo maior ou igual ao atual; instantes iguais são aceitos. Instantes negativos ou anteriores retornam false sem alterar tempo ou dados.",
        "Um Put válido expira em currentTime + ttl. Uma chave é válida apenas enquanto currentTime < expiresAt, ficando ausente exatamente na expiração. Count() int conta apenas chaves válidas. Consultas não renovam prazos. Chaves expiradas podem ser reutilizadas; nenhum valor antigo pode ser reativado.",
      ),
      level(
        "Comparar e substituir atomicamente",
        "Renove uma entrada apenas quando seu valor atual corresponder ao esperado.",
        "CompareAndSet(key, expected, replacement string, ttl int) bool aceita apenas uma chave válida cujo valor seja igual a expected, com ttl positivo. Substitui atomicamente o valor e define a expiração como currentTime + ttl. expected e replacement podem ser vazios.",
        "Chaves desconhecidas, expiradas ou vazias, valores diferentes e ttl não positivo retornam false sem alterar a entrada nem seu prazo. Substituir pelo mesmo valor também renova o prazo. Leituras e escritas rejeitadas nunca renovam a expiração.",
      ),
    ],
  },
};
