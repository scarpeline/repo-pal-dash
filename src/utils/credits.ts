/**
 * Utilitários para conversão entre tokens e valores monetários em Reais
 * 
 * No sistema:
 * - 1 token (input/output) = custo variável por modelo
 * - Todos os valores são armazenados em centavos de Real (R$ 0,01)
 * - 100 centavos = R$ 1,00
 * 
 * Isso mantém tudo transparente em Reais para o usuário
 */

/**
 * Converte centavos para valor em Reais
 * @param cents - valor em centavos
 * @returns valor em Reais (ex: 1000 centavos = R$ 10,00)
 */
export function creditsToBRL(cents: number): number {
  return cents / 100;
}

/**
 * Formata centavos como valor monetário em Reais
 * @param cents - valor em centavos
 * @returns string formatada em Reais (ex: "R$ 10,00")
 */
export function formatCreditsAsBRL(cents: number): string {
  const reais = creditsToBRL(cents);
  return `R$ ${reais.toFixed(2).replace('.', ',')}`;
}

/**
 * Converte valor em Reais para centavos
 * @param reais - valor em Reais (ex: 10.00)
 * @returns valor em centavos
 */
export function BRLToCredits(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Converte quantidade de tokens para valor em centavos
 * @param tokens - quantidade de tokens
 * @returns valor em centavos (mesmo valor)
 */
export function tokensToCredits(tokens: number): number {
  return tokens;
}

/**
 * Formata valor em centavos para exibição numérica
 * @param cents - valor em centavos
 * @returns string formatada com separadores de milhar
 */
export function formatCredits(cents: number): string {
  return cents.toLocaleString('pt-BR');
}

/**
 * Calcula total de tokens (input + output)
 * @param inputTokens - tokens de entrada
 * @param outputTokens - tokens de saída
 * @returns total de tokens
 */
export function calculateTotalCredits(inputTokens: number, outputTokens: number): number {
  return inputTokens + outputTokens;
}

/**
 * Gera texto de consumo para exibição ao usuário
 * @param inputTokens - tokens de entrada
 * @param outputTokens - tokens de saída
 * @param costCents - custo em centavos
 * @returns texto formatado para exibição
 */
export function formatUsageText(inputTokens: number, outputTokens: number, costCents?: number): string {
  if (costCents !== undefined && costCents > 0) {
    const reais = (costCents / 100).toFixed(2);
    return `_💸 Valor gasto: R$ ${reais}_`;
  }
  
  return "";
}

/**
 * Verifica se usuário tem saldo suficiente
 * @param userBalance - saldo em centavos
 * @param requiredAmount - valor necessário em centavos
 * @returns true se tiver saldo suficiente
 */
export function hasEnoughCredits(
  userBalance: number, 
  requiredAmount: number
): boolean {
  return userBalance >= requiredAmount;
}
