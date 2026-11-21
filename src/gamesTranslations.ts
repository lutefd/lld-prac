const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const gamesTranslations = {
  "tic-tac-toe": {
    title: "Jogo da velha",
    summary:
      "Valide turnos em um tabuleiro, detecte vitórias e empates e depois suporte tamanhos customizados e desfazer.",
    tags: ["Jogo de tabuleiro", "Validação", "Estado"],
    levels: [
      level(
        "Colocar marcas em um tabuleiro 3×3",
        "Comece com o tabuleiro clássico em que X joga primeiro.",
        "NewTicTacToe(size, winLength int) *TicTacToe cria um tabuleiro vazio size×size quando size >= 1 e 1 <= winLength <= size; caso contrário, trate a chamada como NewTicTacToe(3, 3). As células usam índices a partir de zero.",
        'Move(row, col int) bool coloca a marca do jogador atual ("X" ou "O") em uma célula vazia dentro dos limites e alterna o turno. Chamadas fora dos limites, em células ocupadas ou com o jogo encerrado retornam false sem alterações.',
        'Cell(row, col int) (string, bool) retorna a marca ou ("", false) quando estiver fora dos limites. Células vazias retornam ("", true).',
      ),
      level(
        "Detectar vitórias e empates",
        "Encerre o jogo quando uma linha vencer ou o tabuleiro encher.",
        'Winner() (string, bool) retorna ("X", true) ou ("O", true) após uma sequência completa de winLength marcas seguidas (linha, coluna ou qualquer diagonal). Caso contrário, retorne ("", false).',
        'Turn() string retorna "X" ou "O" para o próximo jogador enquanto o jogo estiver aberto; após vitória ou empate, retorna a string vazia.',
        "Há empate quando todas as células estão preenchidas e não há vencedor. Após vitória ou empate, novas chamadas a Move falham e Winner permanece estável.",
      ),
      level(
        "Tabuleiros customizados e desfazer",
        "Suporte N×N com K em linha e reverta a última jogada válida.",
        "Size e winLength da construção valem para o jogo inteiro. Linhas vencedoras podem ser quaisquer winLength células contíguas em linha, coluna ou diagonal.",
        "Undo() bool remove o Move bem-sucedido mais recente, restaurando a marca e o turno anteriores, e retorna true. Sem jogadas para desfazer, retorne false. Undo pode reabrir um jogo encerrado.",
        "Não há refazer. Consultas a Cell são independentes de jogadas posteriores. Não há relógio real nem concorrência.",
      ),
    ],
  },
  "snakes-and-ladders": {
    title: "Cobras e escadas",
    summary:
      "Avance jogadores com dados fornecidos, aplique cobras e escadas e imponha chegada exata na ordem dos turnos.",
    tags: ["Jogo de tabuleiro", "Ordem de turnos", "Entrada determinística"],
    levels: [
      level(
        "Cadastrar jogadores em um tabuleiro numerado",
        "As casas vão de 1 até size; os jogadores começam fora do tabuleiro na posição 0.",
        "NewBoard(size int) *Board cria um tabuleiro com size >= 1 casas. size não positivo é tratado como 1.",
        "AddPlayer(id string) bool cadastra um jogador único e não vazio, diferenciando maiúsculas de minúsculas, na posição 0 e na ordem de entrada. Duplicatas e IDs vazios retornam false.",
        "Position(id string) (int, bool) retorna a casa ou (0, false) para desconhecidos. Players() []string retorna os IDs na ordem de entrada como uma cópia defensiva.",
      ),
      level(
        "Rolar, deslizar e terminar exatamente",
        "Os movimentos usam valores de dado fornecidos; cobras e escadas teleportam na hora.",
        "AddSnake(from, to int) bool exige 1 <= to < from <= size e que from não seja cabeça de outra cobra ou escada. AddLadder(from, to int) bool exige 1 <= from < to <= size com a mesma unicidade. Chamadas inválidas retornam false.",
        "Move(id string, dice int) bool avança um jogador conhecido por um valor de dado positivo quando position+dice <= size. Ao cair na cabeça de uma cobra ou escada, teleporta uma vez ao destino. Dado não positivo ou ultrapassar size não altera a posição e retorna false.",
        'Um jogador com posição igual a size terminou. Winner() (string, bool) retorna o primeiro a terminar na ordem de entrada, ou ("", false). Jogadores que terminaram rejeitam novos Move.',
      ),
      level(
        "Impor a ordem dos turnos",
        "Somente o jogador da vez pode se mover; o turno avança após cada tentativa.",
        'Current() (string, bool) retorna o próximo jogador a se mover entre os inacabados na ordem de entrada, reiniciando o ciclo quando preciso. Quando todos terminaram ou não há jogadores, retorne ("", false).',
        "Play(dice int) bool aplica Move ao Current() com as mesmas regras de dado. Após um Move bem-sucedido ou uma rejeição por ultrapassar o tamanho pelo jogador atual, o turno passa ao próximo inacabado. Dado não positivo retorna false sem avançar o turno. Move de um jogador que não é o da vez retorna false sem mudanças nem avanço de turno.",
        "Winner ainda reporta o primeiro a terminar. Não há aleatoriedade real, relógio de parede nem concorrência.",
      ),
    ],
  },
  leaderboard: {
    title: "Placar competitivo",
    summary:
      "Acumule pontuações, responda top-K e consultas de colocação com empates determinísticos e remova ou limpe jogadores.",
    tags: ["Ranking", "Empates", "Estado por chave"],
    levels: [
      level(
        "Acumular pontuações",
        "Jogadores aparecem quando recebem pontos pela primeira vez.",
        "NewLeaderboard() *Leaderboard começa vazio. AddScore(player string, points int) bool soma pontos positivos a um jogador não vazio, diferenciando maiúsculas de minúsculas, criando-o com essa pontuação quando for novo. Pontos não positivos ou nomes vazios retornam false sem alterações.",
        "Score(player string) (int, bool) retorna o total ou (0, false) se desconhecido. Totais cabem em int e no intervalo de inteiros seguros do TypeScript.",
      ),
      level(
        "Top-K e colocações",
        "Ordene por pontuação decrescente e depois por nome crescente.",
        "Top(k int) []string retorna até k nomes na ordem do ranking. k não positivo produz resultado vazio. Retorne uma cópia defensiva.",
        "Rank(player string) (int, bool) retorna a colocação de competição começando em 1: um mais o número de jogadores com pontuação estritamente maior. Empates compartilham a colocação. Desconhecidos retornam (0, false).",
      ),
      level(
        "Remover jogadores e limpar",
        "Apague indivíduos ou esvazie o placar.",
        "Remove(player string) bool remove um jogador existente e retorna true; nomes desconhecidos retornam false.",
        "Clear() bool remove todos os jogadores e retorna true mesmo quando já estiver vazio. Após Remove ou Clear, Rank e Top refletem apenas os restantes. Nomes removidos podem receber AddScore novamente como novos jogadores.",
      ),
    ],
  },
};
