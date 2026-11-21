const level = (
  title: string,
  description: string,
  ...requirements: string[]
) => ({ title, description, requirements });
export const expenseTranslations = {
  "expense-splitter": {
    title: "Divisor de despesas",
    summary:
      "Divida custos compartilhados em centavos inteiros, acompanhe saldos e sugira um acerto determinístico.",
    tags: ["Dinheiro", "Divisões", "Acerto de contas"],
    levels: [
      level(
        "Membros e divisões iguais",
        "Mantenha saldos em centavos inteiros entre membros cadastrados.",
        "NewGroup() *Group começa vazio. AddMember(id string) bool cadastra um membro único e não vazio, diferenciando maiúsculas de minúsculas. Duplicatas e IDs vazios retornam false.",
        "AddEqual(id, payer string, cents int, members []string) bool registra uma despesa nova com ID único e não vazio, paga por um pagador cadastrado, com cents positivos. members deve ser um conjunto não vazio de membros cadastrados sem duplicatas; o pagador não precisa estar listado.",
        "Cada membro listado deve floor(cents / n) centavos, e os primeiros (cents % n) membros na ordem lexicográfica dos IDs listados devem um centavo a mais. O saldo líquido do pagador sobe cents e o de cada devedor cai pela sua parte. Balance(id string) (int, bool) retorna os centavos líquidos (positivo significa que outros devem a essa pessoa) ou (0, false) se desconhecido.",
      ),
      level(
        "Itens exatos",
        "Suporte despesas cujas partes são declaradas explicitamente.",
        'AddExact(id, payer string, lines []string) bool aceita um ID de despesa novo e um pagador cadastrado. Cada linha é "member:cents" com membro cadastrado, centavos não negativos e sem membros duplicados. É necessária ao menos uma linha; a soma dos centavos deve ser positiva.',
        "O pagador ganha o total; cada membro listado perde sua quantia (um pagador listado como membro fica com total menos a própria parte). Linhas inválidas, pessoas desconhecidas, IDs vazios, IDs de despesa duplicados ou total não positivo retornam false sem alterações. As regras anteriores de divisão igual continuam disponíveis.",
      ),
      level(
        "Sugestões de acerto",
        "Zere os saldos com um conjunto determinístico de transferências.",
        'Settle() []string retorna o menor número de transferências que zeram todos os saldos, no formato "from->to:cents" com centavos positivos. Pareie o menor devedor lexicográfico (saldo negativo) com o menor credor lexicográfico (saldo positivo), transfira min(-dívida, crédito) e repita com os restos atualizados.',
        "Quando todos os saldos já forem zero, retorne um resultado vazio. Settle nunca altera saldos; retorne uma cópia defensiva. Resultados vazios em Go podem ser nil ou fatias vazias. Não há conversão de moeda, taxas nem concorrência.",
      ),
    ],
  },
};
