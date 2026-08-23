import type { FluxoNode, FluxoEdge, FluxoNodeTipo } from '@/types/database'

// Mantém em sincronia com FluxoNodeTipo em vez de duplicar a lista à mão —
// já ficou desatualizada uma vez (rejeitando todo nó adicionado depois dos
// 8 tipos originais) até um fluxo real de teste expor o bug.
const TIPOS_VALIDOS: Set<FluxoNodeTipo> = new Set([
  'inicio', 'mensagem', 'menu', 'horario', 'coleta', 'encaminhar_ia', 'encaminhar_humano', 'fim',
  'enviar_template', 'enviar_url', 'enviar_email', 'nota_interna', 'solicitar_localizacao', 'gerar_qrcode', 'adicionar_etiqueta', 'gerar_protocolo',
  'definir_variavel', 'condicao_variavel', 'pausar',
  'ir_para_fluxo',
] satisfies FluxoNodeTipo[])

export function validarFluxo(body: unknown): { nome: string; ativo: boolean; nodes: FluxoNode[]; edges: FluxoEdge[] } | null {
  if (!body || typeof body !== 'object') return null
  const { nome, ativo, nodes, edges } = body as Record<string, unknown>
  if (typeof nome !== 'string' || !nome.trim()) return null
  if (typeof ativo !== 'boolean') return null
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !TIPOS_VALIDOS.has(n.tipo)) return null
  }
  for (const e of edges) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || typeof e.origem !== 'string' || typeof e.destino !== 'string') return null
  }
  if (!nodes.some((n: FluxoNode) => n.tipo === 'inicio')) return null
  return { nome: nome.trim(), ativo, nodes: nodes as FluxoNode[], edges: edges as FluxoEdge[] }
}
