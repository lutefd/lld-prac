const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const moreFundamentalsTranslations = {
  "text-editor-undo": {
    title: "Editor de texto com desfazer",
    summary:
      "Mantenha um buffer de texto e um cursor e depois empilhe desfazer e refazer com edições que limpam o histórico.",
    tags: ["Buffer", "Cursor", "Desfazer/refazer"],
    levels: [
      level(
        "Editar um buffer",
        "Insira e apague em torno de um índice explícito de cursor.",
        "NewEditor() *Editor começa com texto vazio e cursor 0. Insert(text string) bool insere o texto no cursor e avança o cursor em len(text). Texto vazio retorna false sem alterações; qualquer outra string é válida.",
        "Delete(n int) bool remove até n caracteres imediatamente antes do cursor quando n > 0, movendo o cursor para a esquerda pela quantidade removida. n < 1 ou cursor em 0 retorna false sem alterações. Apagar mais caracteres do que existem antes do cursor remove apenas o disponível e ainda retorna true.",
        "Move(pos int) bool define o cursor como pos quando 0 <= pos <= len(Text()); caso contrário, false. Text() string e Cursor() int reportam o buffer e o cursor atuais. Não há seleção nem texto rico.",
      ),
      level(
        "Desfazer edições",
        "Reverta inserções e exclusões bem-sucedidas.",
        "Undo() bool restaura o texto e o cursor de antes do Insert ou Delete bem-sucedido mais recente e retorna true. Move não cria registros de desfazer. Com histórico vazio, retorne false.",
        "Cada Insert ou Delete bem-sucedido empilha um registro. Undo desempilha um. Chamadas falhas a Insert/Delete/Move deixam o histórico inalterado.",
      ),
      level(
        "Refazer e limpar o refazer ao editar",
        "Reaplique mudanças desfeitas até uma nova edição ramificar o histórico.",
        "Redo() bool reaplica o Insert ou Delete desfeito mais recentemente, restaurando aquele texto e cursor, e retorna true. Histórico de refazer vazio retorna false.",
        "Um Undo bem-sucedido empilha no refazer. Um Redo bem-sucedido desempilha o refazer e empilha no desfazer. Um Insert ou Delete bem-sucedido limpa toda a pilha de refazer. Move nunca limpa o refazer nem cria entradas de histórico.",
      ),
    ],
  },
  "lfu-cache": {
    title: "Cache LFU",
    summary:
      "Expulse pelo menor uso com desempate pelo menos recentemente usado em uma ordem lógica de acesso.",
    tags: ["Cache", "Frequência", "Expulsão"],
    levels: [
      level(
        "Armazenar valores sob capacidade",
        "Guarde strings sob nomes não vazios e sensíveis a maiúsculas.",
        "NewLFUCache(capacity int) *LFUCache cria um cache vazio. Capacidade negativa é tratada como zero. Len() int conta as chaves armazenadas.",
        "Put(key, value string) bool insere ou sobrescreve quando a chave é não vazia e a capacidade > 0. Chaves vazias e todas as escritas com capacidade zero retornam false. Valores vazios são válidos.",
        'Get(key string) (string, bool) retorna o valor ou ("", false). Um valor vazio armazenado retorna ("", true). Neste nível, novas chaves nunca excedem a capacidade.',
      ),
      level(
        "Expulsar por frequência e depois por recência",
        "Acompanhe usos com um relógio lógico de acesso.",
        "Todo Get bem-sucedido e todo Put bem-sucedido (inclusive sobrescritas) incrementa a frequência da chave em um e a marca como a mais recentemente usada em um contador lógico de acesso.",
        "Ao inserir uma chave nova em um cache cheio de capacidade positiva, expulse antes uma chave existente: escolha a de menor frequência e, em empate, a menos recentemente usada. Put ainda retorna true após a expulsão.",
        "Get ausente e Put rejeitado não alteram frequências nem recência. Sobrescrever nunca aumenta Len().",
      ),
      level(
        "Inspecionar a ordem por frequência",
        "Exponha frequências e um instantâneo ordenado das chaves.",
        "Freq(key string) (int, bool) retorna a contagem de usos de uma chave presente, ou (0, false) se ausente. Contagens começam em 1 após o Put que cria a chave.",
        "Keys() []string retorna uma cópia defensiva ordenada por frequência crescente e, na mesma frequência, pela menos recentemente usada primeiro. Keys não conta como uso. Instantâneos vazios em Go podem ser nil ou vazios.",
      ),
    ],
  },
};
