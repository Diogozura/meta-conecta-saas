import { ArrowLeft } from 'lucide-react'
import type { CadastroFormData } from './types'

const SEGMENT_OPTIONS = [
  'Varejo', 'Saúde', 'Educação', 'Serviços', 'Indústria', 'Tecnologia', 'Alimentação', 'Outro',
] as const

const TEAM_SIZE_OPTIONS = ['Só eu', '2-10', '11-50', '51-200', '200+'] as const

const inputClass =
  'w-full px-3 py-2.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50'
const labelClass = 'block text-sm font-medium text-ink-700 mb-1'

interface StepProfileProps {
  formData: CadastroFormData
  updateField: (key: keyof CadastroFormData, value: string) => void
  onBack: () => void
  onContinue: () => void
  loading: boolean
}

export default function StepProfile({ formData, updateField, onBack, onContinue, loading }: StepProfileProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 mb-4 disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <form onSubmit={(e) => { e.preventDefault(); onContinue() }} className="space-y-4">
        <div>
          <label className={labelClass}>Atuação</label>
          <select
            required
            disabled={loading}
            value={formData.segment}
            onChange={(e) => updateField('segment', e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>Selecione o segmento</option>
            {SEGMENT_OPTIONS.map((segment) => (
              <option key={segment} value={segment}>{segment}</option>
            ))}
          </select>
        </div>

        {formData.segment === 'Outro' && (
          <div>
            <label className={labelClass}>Qual segmento?</label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.segmentOther}
              onChange={(e) => updateField('segmentOther', e.target.value)}
              className={inputClass}
              placeholder="Descreva o segmento da empresa"
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Colaboradores</label>
          <select
            required
            disabled={loading}
            value={formData.teamSize}
            onChange={(e) => updateField('teamSize', e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>Quantas pessoas trabalham com você?</option>
            {TEAM_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </form>
    </div>
  )
}
