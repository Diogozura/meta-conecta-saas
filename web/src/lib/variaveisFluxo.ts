/**
 * Troca "{{chave}}" por Conversa.dadosColetados[chave] num texto — usado
 * pelos nós que podem referenciar dados coletados antes no fluxo (ex: nó
 * "enviar_email" mandando pro e-mail que um nó "coleta" anterior guardou).
 * Token sem correspondência em `dados` fica como está (não vira string vazia
 * silenciosamente — mais fácil de notar um nome de variável errado).
 */
export function substituirVariaveis(texto: string, dados: Record<string, string> | undefined): string {
  if (!dados) return texto
  return texto.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, chave: string) => dados[chave] ?? match)
}

/** Protocolo curto e legível — data (AAMMDD) + 4 caracteres aleatórios, o bastante pra não colidir dentro do mesmo dia numa conta. */
export function gerarProtocolo(agora: Date = new Date()): string {
  const aamm = agora.toISOString().slice(2, 10).replace(/-/g, '')
  const sufixo = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${aamm}-${sufixo}`
}
