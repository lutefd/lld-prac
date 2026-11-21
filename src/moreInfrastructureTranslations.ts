const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const moreInfrastructureTranslations = {
  "url-shortener": {
    title: "Encurtador de URL",
    summary:
      "Gere códigos curtos determinísticos, suporte aliases customizados, resolva URLs e conte acessos.",
    tags: ["Codificação", "Aliases", "Contadores"],
    levels: [
      level(
        "Gerar códigos curtos",
        "Mapeie URLs longas para códigos base62 determinísticos a partir de um contador.",
        'NewShortener() *Shortener começa com contador 1. Shorten(url string) (string, bool) aceita uma URL não vazia e retorna o próximo código livre. Os códigos são a codificação base62 do contador usando os dígitos 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ; em seguida o contador incrementa. URLs vazias retornam ("", false).',
        "A mesma URL encurtada duas vezes recebe dois códigos diferentes. Códigos diferenciam maiúsculas de minúsculas. Não há I/O de rede.",
      ),
      level(
        "Aliases customizados e resolução",
        "Associe códigos escolhidos e consulte URLs.",
        "Alias(code, url string) bool associa um código não vazio e ainda não usado a uma URL não vazia. Códigos já devolvidos por Shorten ou Alias não podem ser reutilizados. Chamadas inválidas retornam false.",
        'Resolve(code string) (string, bool) retorna a URL de um código conhecido ou ("", false). Alias não avança o contador de Shorten.',
      ),
      level(
        "Contar resoluções bem-sucedidas",
        "Acompanhe quantas vezes cada código é consultado.",
        "Hits(code string) (int, bool) retorna quantas chamadas Resolve bem-sucedidas ocorreram para um código conhecido, começando em zero, ou (0, false) se desconhecido.",
        "Somente Resolve que encontra um código incrementa o contador. Shorten, Alias e Resolve falho não alteram contagens.",
      ),
    ],
  },
  "circuit-breaker": {
    title: "Disjuntor de circuito",
    summary:
      "Controle chamadas pelos estados fechado, aberto e meio-aberto usando carimbos de tempo lógicos.",
    tags: ["Resiliência", "Tempo lógico", "Máquina de estados"],
    levels: [
      level(
        "Permitir chamadas enquanto fechado",
        "Comece fechado e acompanhe falhas consecutivas.",
        'NewBreaker(threshold, cooldown int) *Breaker exige threshold e cooldown positivos; valores não positivos são tratados como 1. State(now int) string retorna "closed", "open" ou "half_open" usando um tempo lógico não negativo; now negativo é tratado como o relógio atual sem avançá-lo.',
        "Allow(now int) bool retorna true enquanto fechado. Record(success bool, now int) bool aceita um resultado somente quando uma chamada foi permitida desde o último Record; caso contrário, false. No estado fechado, um Record de falha incrementa a sequência de falhas e um Record de sucesso zera a sequência.",
      ),
      level(
        "Abrir após falhas e esfriar",
        "Rejeite tráfego até o intervalo de espera terminar.",
        "Quando a sequência de falhas no estado fechado atinge o limiar, o disjuntor abre no now desse Record. Enquanto aberto, Allow retorna false e Record retorna false sem mudanças.",
        'Quando now >= openedAt + cooldown, State passa a "half_open" e um único Allow de teste pode retornar true. Os tempos não precisam ser únicos, mas as decisões de abertura usam o carimbo do Record que disparou o disjuntor.',
      ),
      level(
        "Chamadas de teste no meio-aberto",
        "Uma sonda decide se fecha ou reabre.",
        "No meio-aberto, o primeiro Allow retorna true e ocupa a vaga de teste; Allow posteriores retornam false até o Record concluir o teste. Um Record de sucesso do teste volta ao fechado com sequência de falhas zero. Um Record de falha do teste reabre com openedAt igual a esse now.",
        "State reflete o now mais recente para transições entre aberto e meio-aberto. Não há relógio de parede, temporizador em segundo plano nem concorrência.",
      ),
    ],
  },
  "elevator-controller": {
    title: "Controlador de elevadores",
    summary:
      "Simule o movimento de elevadores por alvos com ticks de Step e depois coordene vários carros.",
    tags: ["Agendamento", "Simulação", "LOOK"],
    levels: [
      level(
        "Mover um carro com Step",
        "Os andares são inteiros de 0 até floors-1.",
        'NewElevators(floors, cars int) *Elevators cria cars elevadores no andar 0 quando floors >= 2 e cars >= 1; argumentos inválidos viram floors=2 e cars=1. Floor(car int) (int, bool) e Direction(car int) (string, bool) reportam um carro; carros desconhecidos retornam ok false. Direções são "up", "down" ou "idle".',
        'Call(floor int, dir string) bool registra uma chamada de hall quando o andar está no intervalo e dir é "up" ou "down". Pares (floor, dir) duplicados ainda pendentes retornam false. Neste nível há um carro (índice 0).',
        "Step() avança um tick. Um carro sem alvo atual adota o andar da Call pendente mais antiga como alvo e define a direção up/down (idle se já estiver lá). Se ainda não estiver nesse andar, move um andar na direção do alvo no mesmo tick. Quando um Step pousa exatamente no alvo, esse mesmo Step limpa todas as Calls pendentes naquele andar (qualquer dir), remove o alvo e fica idle quando a fila estiver vazia.",
      ),
      level(
        "Atender alvos na ordem das Calls",
        "Termine o alvo atual antes de adotar a próxima Call mais antiga.",
        "Andares intermediários não são atendidos cedo: somente o andar alvo atual é limpo na chegada. Depois que um alvo é limpo, o próximo Step adota a Call restante mais antiga como novo alvo.",
        "Se o carro já estiver no novo andar alvo, o mesmo Step que o adota também limpa esse andar sem se mover. Step retorna true quando qualquer carro se moveu ou limpou uma parada no tick; caso contrário, false.",
      ),
      level(
        "Vários elevadores",
        "Atribua cada nova Call ao carro mais próximo pela distância absoluta.",
        "Quando Call tem sucesso, atribua-a ao carro com a menor distância absoluta entre seu andar atual e o andar da solicitação; empates preferem o menor índice. A solicitação entra imediatamente no conjunto pendente desse carro.",
        "Step atualiza cada carro uma vez por tick de forma independente com as mesmas regras de alvo. Floor e Direction continuam por carro. Não há temporizador de porta além da limpeza na chegada, nem limite de capacidade, nem relógio real.",
      ),
    ],
  },
};
