/**
 * Utilitários para conversão entre tokens e créditos
 * 
 * No sistema, 1 crédito = 1 token (input + output)
 * Isso simplifica a experiência do usuário
 */

/**
 * Converte quantidade de tokens para créditos
 * @param tokens - quantidade de tokens
 * @returns quantidade de créditos (mesmo valor)
 */
export function tokensToCredits(tokens: number): number {
  return tokens;
}

/**
 * Formata créditos para exibição
 * @param credits - quantidade de créditos
 * @returns string formatada com separadores de milhar
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString('pt-BR');
}

/**
 * Calcula créditos totais (input + output)
 * @param inputTokens - tokens de entrada
 * @param outputTokens - tokens de saída
 * @returns total de créditos
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
  const totalCredits = calculateTotalCredits(inputTokens, outputTokens);
  const creditsText = `Créditos consumidos: ${formatCredits(totalCredits)}`;
  
  if (costCents !== undefined) {
    const costText = `Custo: R$ ${(costCents / 100).toFixed(4)}`;
    return `_${creditsText} | ${costText}_`;
  }
  
  return `_${creditsText}_`;
}

/**
 * Verifica se usuário tem créditos suficientes
 * @param userBalance - saldo em centavos
 * @param requiredCredits - créditos necessários
 * @param creditCostInCents - custo de cada crédito em centavos
 * @returns true se tiver créditos suficientes
 */
export function hasEnoughCredits(
  userBalance: number, 
  requiredCredits: number, 
  creditCostInCents: number = 1
): boolean {
  const requiredCost = requiredCredits * creditCostInCents;
  return userBalance >= requiredCost;
}
