'use client'

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Play, MessageSquare, ListTree, Clock, TextCursorInput, Bot, UserCheck, Square, FileText, Link2, Mail, StickyNote, MapPin, QrCode, Tag, Hash } from 'lucide-react'
import type { FluxoNode, FluxoNodeTipo } from '@/types/database'

// O React Flow exige que `data` seja um Record indexável — a interface
// FluxoNode (modelo de domínio, salvo no Firestore) não tem índice por
// padrão, então a interseção adiciona isso sem duplicar os campos.
export type FluxoNodeData = FluxoNode & Record<string, unknown>

export type FluxoRFNode = Node<FluxoNodeData, FluxoNodeTipo>

export const TIPO_INFO: Record<FluxoNodeTipo, { label: string; icon: typeof Play; corBorda: string; corFundo: string; corTexto: string }> = {
  inicio: { label: 'Início', icon: Play, corBorda: 'border-emerald-300', corFundo: 'bg-emerald-50', corTexto: 'text-emerald-700' },
  mensagem: { label: 'Mensagem', icon: MessageSquare, corBorda: 'border-blue-300', corFundo: 'bg-blue-50', corTexto: 'text-blue-700' },
  menu: { label: 'Menu', icon: ListTree, corBorda: 'border-purple-300', corFundo: 'bg-purple-50', corTexto: 'text-purple-700' },
  horario: { label: 'Horário de atendimento', icon: Clock, corBorda: 'border-cyan-300', corFundo: 'bg-cyan-50', corTexto: 'text-cyan-700' },
  coleta: { label: 'Coletar dado', icon: TextCursorInput, corBorda: 'border-teal-300', corFundo: 'bg-teal-50', corTexto: 'text-teal-700' },
  encaminhar_ia: { label: 'Encaminhar p/ IA', icon: Bot, corBorda: 'border-brand-300', corFundo: 'bg-brand-50', corTexto: 'text-brand-700' },
  encaminhar_humano: { label: 'Encaminhar p/ humano', icon: UserCheck, corBorda: 'border-amber-300', corFundo: 'bg-amber-50', corTexto: 'text-amber-700' },
  fim: { label: 'Fim', icon: Square, corBorda: 'border-ink-300', corFundo: 'bg-ink-100', corTexto: 'text-ink-600' },
  enviar_template: { label: 'Enviar template', icon: FileText, corBorda: 'border-indigo-300', corFundo: 'bg-indigo-50', corTexto: 'text-indigo-700' },
  enviar_url: { label: 'Enviar link', icon: Link2, corBorda: 'border-sky-300', corFundo: 'bg-sky-50', corTexto: 'text-sky-700' },
  enviar_email: { label: 'Enviar e-mail', icon: Mail, corBorda: 'border-rose-300', corFundo: 'bg-rose-50', corTexto: 'text-rose-700' },
  nota_interna: { label: 'Nota interna', icon: StickyNote, corBorda: 'border-yellow-300', corFundo: 'bg-yellow-50', corTexto: 'text-yellow-700' },
  solicitar_localizacao: { label: 'Solicitar localização', icon: MapPin, corBorda: 'border-lime-300', corFundo: 'bg-lime-50', corTexto: 'text-lime-700' },
  gerar_qrcode: { label: 'Gerar QR code', icon: QrCode, corBorda: 'border-slate-300', corFundo: 'bg-slate-50', corTexto: 'text-slate-700' },
  adicionar_etiqueta: { label: 'Adicionar etiqueta', icon: Tag, corBorda: 'border-fuchsia-300', corFundo: 'bg-fuchsia-50', corTexto: 'text-fuchsia-700' },
  gerar_protocolo: { label: 'Gerar protocolo', icon: Hash, corBorda: 'border-orange-300', corFundo: 'bg-orange-50', corTexto: 'text-orange-700' },
}

function NodeShell({ tipo, selected, children }: { tipo: FluxoNodeTipo; selected?: boolean; children: React.ReactNode }) {
  const info = TIPO_INFO[tipo]
  const Icon = info.icon
  return (
    <div
      className={`w-56 rounded-xl border-2 ${info.corBorda} ${info.corFundo} shadow-sm px-3 py-2.5 ${selected ? 'ring-2 ring-offset-1 ring-brand-500' : ''}`}
    >
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${info.corTexto}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {info.label}
      </div>
      {children}
    </div>
  )
}

export function InicioNode({ selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="inicio" selected={selected}>
      <p className="text-xs text-ink-500 mt-1">Toda conversa nova começa aqui.</p>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </NodeShell>
  )
}

export function MensagemNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="mensagem" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-3">{data.texto || 'Clique para escrever a mensagem…'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </NodeShell>
  )
}

export function MenuNode({ data, selected }: NodeProps<FluxoRFNode>) {
  const opcoes = data.opcoes ?? []
  return (
    <NodeShell tipo="menu" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2">{data.texto || 'Clique para escrever o menu…'}</p>
      <div className="mt-2 space-y-1">
        {opcoes.length === 0 && <p className="text-[10px] text-ink-400 italic">Sem opções ainda</p>}
        {opcoes.map((op) => (
          <div key={op.id} className="relative flex items-center justify-between gap-2 bg-white border border-purple-200 rounded-lg px-2 py-1">
            <span className="text-[11px] font-medium text-ink-700 truncate">{op.rotulo || '(vazio)'}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={op.id}
              style={{ position: 'relative', transform: 'none', right: -8 }}
              className="!bg-purple-500 !w-2.5 !h-2.5"
            />
          </div>
        ))}
      </div>
    </NodeShell>
  )
}

export function ColetaNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="coleta" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-teal-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2">{data.texto || 'Clique para escrever a pergunta…'}</p>
      <p className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 inline-block mt-1.5">
        guarda em: {data.variavel || '(defina uma chave)'}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500" />
    </NodeShell>
  )
}

const DIAS_ABREV = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function HorarioNode({ data, selected }: NodeProps<FluxoRFNode>) {
  const h = data.horario
  return (
    <NodeShell tipo="horario" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-cyan-500" />
      {h ? (
        <div className="mt-1 space-y-1">
          <div className="flex gap-0.5">
            {DIAS_ABREV.map((d, i) => (
              <span
                key={i}
                className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-semibold ${
                  h.diasSemana[i] ? 'bg-cyan-600 text-white' : 'bg-white text-ink-300 border border-ink-200'
                }`}
              >
                {d}
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-700">
            {h.horaInicio} – {h.horaFim}
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-400 italic mt-1">Clique para configurar o horário…</p>
      )}
      <div className="mt-2 space-y-1">
        <div className="relative flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-lg px-2 py-1">
          <span className="text-[11px] font-medium text-emerald-700">Dentro do horário</span>
          <Handle type="source" position={Position.Right} id="dentro" style={{ position: 'relative', transform: 'none', right: -8 }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
        </div>
        <div className="relative flex items-center justify-between gap-2 bg-white border border-red-200 rounded-lg px-2 py-1">
          <span className="text-[11px] font-medium text-red-700">Fora do horário</span>
          <Handle type="source" position={Position.Right} id="fora" style={{ position: 'relative', transform: 'none', right: -8 }} className="!bg-red-500 !w-2.5 !h-2.5" />
        </div>
      </div>
    </NodeShell>
  )
}

export function EncaminharIaNode({ selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="encaminhar_ia" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-brand-500" />
      <p className="text-xs text-ink-500 mt-1">A partir daqui, o agente de IA assume a conversa.</p>
    </NodeShell>
  )
}

export function EncaminharHumanoNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="encaminhar_humano" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <p className="text-xs text-ink-700 mt-1">{data.setor ? `Setor: ${data.setor}` : 'Fila geral (sem setor)'}</p>
    </NodeShell>
  )
}

export function EnviarTemplateNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="enviar_template" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500" />
      <p className="text-xs text-ink-700 mt-1 font-mono">{data.templateNome || 'Clique para escolher o template…'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
    </NodeShell>
  )
}

export function EnviarUrlNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="enviar_url" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-sky-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2">{data.texto || 'Clique para escrever a mensagem…'}</p>
      <p className="text-[10px] text-sky-700 truncate mt-1">{data.url || '(defina a URL)'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500" />
    </NodeShell>
  )
}

export function EnviarEmailNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="enviar_email" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-rose-500" />
      <p className="text-xs text-ink-700 mt-1 truncate">{data.emailDestinatario || 'Clique para definir o destinatário…'}</p>
      <p className="text-[10px] text-ink-500 truncate">{data.emailAssunto || '(sem assunto)'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-rose-500" />
    </NodeShell>
  )
}

export function NotaInternaNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="nota_interna" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2">{data.texto || 'Clique para escrever a nota…'}</p>
      <p className="text-[10px] text-yellow-700 bg-white border border-yellow-200 rounded px-1.5 py-0.5 inline-block mt-1.5">
        {data.estiloNota === 'alerta' ? '⚠️ alerta' : 'ℹ️ informação'} · só o atendente vê
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-500" />
    </NodeShell>
  )
}

export function SolicitarLocalizacaoNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="solicitar_localizacao" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-lime-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2">{data.texto || 'Clique para escrever o pedido…'}</p>
      <p className="text-[10px] text-lime-700 bg-white border border-lime-200 rounded px-1.5 py-0.5 inline-block mt-1.5">
        guarda em: {data.variavel || '(defina uma chave)'}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-lime-500" />
    </NodeShell>
  )
}

export function GerarQrcodeNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="gerar_qrcode" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2 font-mono">{data.texto || 'Clique para definir o conteúdo…'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </NodeShell>
  )
}

export function AdicionarEtiquetaNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="adicionar_etiqueta" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-fuchsia-500" />
      <p className="text-xs text-ink-700 mt-1">{data.etiqueta || 'Clique para definir a etiqueta…'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-fuchsia-500" />
    </NodeShell>
  )
}

export function GerarProtocoloNode({ data, selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="gerar_protocolo" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500" />
      <p className="text-xs text-ink-700 mt-1 line-clamp-2">{data.texto || 'Sem mensagem — só gera e guarda o protocolo'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500" />
    </NodeShell>
  )
}

export function FimNode({ selected }: NodeProps<FluxoRFNode>) {
  return (
    <NodeShell tipo="fim" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-ink-400" />
      <p className="text-xs text-ink-500 mt-1">Encerra a conversa.</p>
    </NodeShell>
  )
}

export const NODE_TYPES = {
  inicio: InicioNode,
  mensagem: MensagemNode,
  menu: MenuNode,
  horario: HorarioNode,
  coleta: ColetaNode,
  encaminhar_ia: EncaminharIaNode,
  encaminhar_humano: EncaminharHumanoNode,
  fim: FimNode,
  enviar_template: EnviarTemplateNode,
  enviar_url: EnviarUrlNode,
  enviar_email: EnviarEmailNode,
  nota_interna: NotaInternaNode,
  solicitar_localizacao: SolicitarLocalizacaoNode,
  gerar_qrcode: GerarQrcodeNode,
  adicionar_etiqueta: AdicionarEtiquetaNode,
  gerar_protocolo: GerarProtocoloNode,
}
