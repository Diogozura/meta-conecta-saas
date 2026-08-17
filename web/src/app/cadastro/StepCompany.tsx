import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { formatCNPJ, unformatCNPJ } from '@/lib/cnpjMask'
import { fetchCompanyByCnpj } from '@/lib/cnpjLookup'
import { fetchAddressByCep } from '@/lib/cepLookup'
import type { CadastroFormData } from './types'

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

const inputClass =
  'w-full px-3 py-2.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50'
const labelClass = 'block text-sm font-medium text-ink-700 mb-1 flex items-center gap-1.5'

type LookupStatus = 'idle' | 'loading' | 'error'

interface StepCompanyProps {
  formData: CadastroFormData
  updateField: (key: keyof CadastroFormData, value: string) => void
  onBack: () => void
  onContinue: () => void
  loading: boolean
}

export default function StepCompany({ formData, updateField, onBack, onContinue, loading }: StepCompanyProps) {
  const [cnpjStatus, setCnpjStatus] = useState<LookupStatus>('idle')
  const [cepStatus, setCepStatus] = useState<LookupStatus>('idle')

  async function handleCnpjChange(rawValue: string) {
    const formatted = formatCNPJ(rawValue)
    updateField('cnpj', formatted)

    if (unformatCNPJ(formatted).length !== 14) {
      setCnpjStatus('idle')
      return
    }

    setCnpjStatus('loading')
    try {
      const result = await fetchCompanyByCnpj(unformatCNPJ(formatted))
      updateField('companyName', result.companyName)
      updateField('cep', result.cep)
      updateField('street', result.street)
      updateField('number', result.number)
      updateField('neighborhood', result.neighborhood)
      updateField('city', result.city)
      updateField('state', result.state)
      setCnpjStatus('idle')
    } catch {
      setCnpjStatus('error')
    }
  }

  async function handleCepChange(rawValue: string) {
    updateField('cep', rawValue)
    const digits = rawValue.replace(/\D/g, '')

    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }

    setCepStatus('loading')
    try {
      const result = await fetchAddressByCep(digits)
      updateField('street', result.street)
      updateField('neighborhood', result.neighborhood)
      updateField('city', result.city)
      updateField('state', result.state)
      setCepStatus('idle')
    } catch {
      setCepStatus('error')
    }
  }

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
          <label className={labelClass}>Nome da empresa</label>
          <input
            type="text"
            required
            autoComplete="organization"
            disabled={loading}
            value={formData.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            className={inputClass}
            placeholder="Ex: Empresa ABC"
          />
        </div>

        <div>
          <label className={labelClass}>
            CNPJ
            {cnpjStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-400" />}
          </label>
          <input
            type="text"
            required
            inputMode="numeric"
            disabled={loading}
            value={formData.cnpj}
            onChange={(e) => handleCnpjChange(e.target.value)}
            className={inputClass}
            placeholder="12.345.678/0001-99"
          />
          {cnpjStatus === 'error' && (
            <p className="mt-1 text-xs text-red-600">CNPJ não encontrado — confira o número ou preencha os dados manualmente.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              CEP
              {cepStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-400" />}
            </label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={9}
              disabled={loading}
              value={formData.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              className={inputClass}
              placeholder="00000-000"
            />
            {cepStatus === 'error' && (
              <p className="mt-1 text-xs text-red-600">CEP não encontrado.</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Número</label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.number}
              onChange={(e) => updateField('number', e.target.value)}
              className={inputClass}
              placeholder="123"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Rua</label>
          <input
            type="text"
            required
            autoComplete="street-address"
            disabled={loading}
            value={formData.street}
            onChange={(e) => updateField('street', e.target.value)}
            className={inputClass}
            placeholder="Nome da rua"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className={labelClass}>Bairro</label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.neighborhood}
              onChange={(e) => updateField('neighborhood', e.target.value)}
              className={inputClass}
              placeholder="Bairro"
            />
          </div>
          <div className="col-span-1">
            <label className={labelClass}>Cidade</label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              className={inputClass}
              placeholder="Cidade"
            />
          </div>
          <div className="col-span-1">
            <label className={labelClass}>UF</label>
            <select
              required
              disabled={loading}
              value={formData.state}
              onChange={(e) => updateField('state', e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>UF</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
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
