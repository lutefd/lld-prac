const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const commerceTranslations = {
  "coupon-registry": {
    title: "Cadastro de cupons",
    summary:
      "Cadastre descontos fixos, calcule compras e desative cupons sem perder suas identidades.",
    tags: ["Validação", "Valores monetários inteiros", "Cadastro"],
    levels: [
      level(
        "Cadastrar cupons",
        "Armazene descontos fixos em centavos inteiros.",
        "NewCoupons() *Coupons cria um cadastro vazio. Add(code string, cents int) bool aceita um código único e não vazio, diferenciando maiúsculas de minúsculas, e um desconto positivo.",
        "Count() int conta todos os códigos cadastrados. Inclusões inválidas retornam false sem alterar o desconto original nem reservar um código novo. A aritmética cabe em int (inteiros seguros em TypeScript).",
      ),
      level(
        "Calcular compras com desconto",
        "Aplique descontos reutilizáveis sem alterar o cadastro.",
        "Apply(code string, subtotal int) (int, bool) retorna max(0, subtotal-desconto) e true para um cupom conhecido e habilitado e um subtotal não negativo.",
        "Códigos desconhecidos ou subtotais negativos retornam (0, false). Cupons novos começam habilitados. Consultas nunca consomem um cupom, mesmo quando o subtotal é zero.",
      ),
      level(
        "Controlar disponibilidade",
        "Desative um código temporariamente preservando sua identidade e seu desconto.",
        "SetEnabled(code string, enabled bool) bool atualiza um cupom conhecido e retorna true, mesmo sem mudança. Códigos desconhecidos retornam false.",
        "Cupons desativados fazem Apply retornar (0, false). Reativar restaura o desconto original. Count inclui cupons desativados; seus códigos não podem ser cadastrados novamente.",
      ),
    ],
  },
  "restaurant-orders": {
    title: "Pedidos de restaurante",
    summary:
      "Crie pedidos editáveis, congele os totais no envio e imponha um ciclo de preparo e entrega.",
    tags: ["Máquina de estados", "Valores monetários inteiros", "Invariantes"],
    levels: [
      level(
        "Montar um pedido",
        "Mantenha um rascunho separado e um total inteiro para cada pedido.",
        'NewKitchen() *Kitchen começa vazio. Create(id string) bool cria um pedido com ID único e não vazio, estado "draft" e total zero. Status(id string) (string, bool) retorna o estado ou ("", false).',
        "Add(id string, cents int) bool soma um preço positivo ao pedido em rascunho. Total(id string) (int, bool) retorna a soma de qualquer pedido conhecido ou (0, false). Operações inválidas retornam false sem alterações. A aritmética cabe em int (inteiros seguros em TypeScript).",
      ),
      level(
        "Enviar pedidos à cozinha",
        "Congele o pedido e avance pelas etapas de preparo.",
        'Submit(id string) bool permite apenas a transição de um rascunho não vazio (total > 0) para "submitted". Advance(id string) bool muda "submitted" para "preparing" e depois "preparing" para "ready".',
        "Todas as outras transições retornam false, preservando estado e total. Add é rejeitado após o envio. Pedidos prontos não avançam mais; repetir Submit não reinicia o pedido.",
      ),
      level(
        "Cancelar ou retirar",
        "Imponha estados terminais e regras seguras de cancelamento.",
        'Cancel(id string) bool muda apenas "draft" ou "submitted" para "cancelled". Collect(id string) bool muda apenas "ready" para "collected".',
        "Pedidos cancelados e retirados são terminais. O cancelamento preserva o total e reserva o ID permanentemente. Pedidos em preparo não podem ser cancelados. Toda transição inválida é atômica; outros pedidos não são afetados.",
      ),
    ],
  },
  "auction-house": {
    title: "Casa de leilões",
    summary:
      "Coordene leilões com prazo, preço mínimo, lances crescentes e solicitações globalmente idempotentes.",
    tags: ["Tempo explícito", "Idempotência", "Atualizações atômicas"],
    levels: [
      level(
        "Cadastrar lotes",
        "Registre lotes independentes com prazos explícitos.",
        "NewAuctions() *Auctions começa vazio. List(id string, reserve, deadline int) bool registra um lote com ID único e não vazio, preço mínimo positivo em centavos e prazo não negativo em segundos. Chamadas inválidas preservam todos os dados.",
        "Highest(id string) (int, bool) retorna o maior lance aceito, inicialmente zero, ou (0, false) para lotes desconhecidos. Não há relógio real, pagamentos, concorrência nem persistência. Inteiros e aritmética cabem em int (inteiros seguros em TypeScript).",
      ),
      level(
        "Aceitar lances com repetição segura",
        "Valide a solicitação completa antes de atualizar o líder ou reservar seu ID.",
        "Bid(requestID, lotID, bidder string, cents, now int) bool exige IDs de solicitação e participante não vazios, lote conhecido e aberto, 0 <= now < deadline, cents >= reserve e valor estritamente maior que Highest. Empates são rejeitados. now é informado por chamada; os horários não precisam ser globalmente crescentes.",
        "IDs de solicitações bem-sucedidas são globais entre lotes. Repetir exatamente todos os parâmetros originais retorna true sem alterar nenhum leilão, mesmo após o fechamento ou um lance mais recente. Reutilizar o ID com qualquer parâmetro diferente retorna false. Lances rejeitados não consomem IDs. Falhas de validação preservam todos os lotes e solicitações aceitas.",
      ),
      level(
        "Encerrar leilões e declarar vencedores",
        "Finalize resultados apenas no prazo de cada lote ou depois dele.",
        "Close(id string, now int) bool só tem sucesso para um lote conhecido e aberto com now >= deadline. Fecha o lote permanentemente, mesmo sem lances. Repetições retornam false. Novos lances em um lote fechado falham independentemente do horário informado.",
        'Winner(id string) (string, bool) retorna o participante com maior lance apenas para um lote fechado com lance aceito; caso contrário retorna ("", false). Highest continua disponível após fechar. Encerrar um lote não afeta outros lotes nem apaga os registros de repetição de solicitações.',
      ),
    ],
  },
};
