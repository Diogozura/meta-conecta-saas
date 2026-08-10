'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, MessageSquare } from 'lucide-react'
import StepAccount from './StepAccount'
import StepCompany from './StepCompany'
import StepProfile from './StepProfile'
import StepChannels from './StepChannels'
import { initialCadastroFormData, type CadastroFormData } from './types'

type Step = 1 | 2 | 3 | 4

const STEPS: { number: Step; label: string }[] = [
  { number: 1, label: 'Conta' },
  { number: 2, label: 'Empresa' },
  { number: 3, label: 'Perfil' },
  { number: 4, label: 'Canais' },
]

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  1: { title: 'Crie sua conta', subtitle: 'Preencha os dados abaixo para começar' },
  2: { title: 'Dados da empresa', subtitle: 'CNPJ e CEP preenchem o endereço automaticamente' },
  3: { title: 'Perfil da empresa', subtitle: 'Conte um pouco sobre o seu negócio' },
  4: { title: 'Conecte seus canais', subtitle: 'Selecione onde você quer atender seus clientes' },
}

export default function CadastroPage() {
  const [step, setStep] = useState<Step>(1)
  const [formData, setFormData] = useState<CadastroFormData>(initialCadastroFormData)
  const [loading, setLoading] = useState(false)

  function updateField(key: keyof CadastroFormData, value: string) {
    setFormData((f) => ({ ...f, [key]: value }))
  }

  function toggleChannel(key: string) {
    setFormData((f) => ({
      ...f,
      channels: f.channels.includes(key) ? f.channels.filter((c) => c !== key) : [...f.channels, key],
    }))
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
  }

  async function handleGoogleSignup() {
    toast.info('Cadastro com Google ainda não está conectado.')
  }

  async function handleCreateAccount() {
    setLoading(true)
    try {
      // TODO: conectar à criação de conta (Firebase + empresa no backend).
      console.log(formData)
      toast.info('Cadastro ainda não está conectado ao backend.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100 py-10 px-6">
      <div className="flex items-center gap-2 justify-center mb-8">
        <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">Meta Conecta</span>
      </div>

      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Progress indicator */}
          <div className="flex items-center mb-6">
            {STEPS.map((s, i) => (
              <div key={s.number} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      step >= s.number
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-400 border border-gray-300'
                    }`}
                  >
                    {step > s.number ? <Check className="w-3.5 h-3.5" /> : s.number}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${step >= s.number ? 'text-green-700' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${step > s.number ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{STEP_COPY[step].title}</h2>
            <p className="text-sm text-gray-500 mt-1">{STEP_COPY[step].subtitle}</p>
          </div>

          {step === 1 && (
            <StepAccount
              formData={formData}
              updateField={updateField}
              onContinue={() => setStep(2)}
              onGoogleSignup={handleGoogleSignup}
              loading={loading}
            />
          )}
          {step === 2 && (
            <StepCompany
              formData={formData}
              updateField={updateField}
              onBack={goBack}
              onContinue={() => setStep(3)}
              loading={loading}
            />
          )}
          {step === 3 && (
            <StepProfile
              formData={formData}
              updateField={updateField}
              onBack={goBack}
              onContinue={() => setStep(4)}
              loading={loading}
            />
          )}
          {step === 4 && (
            <StepChannels
              channels={formData.channels}
              onToggleChannel={toggleChannel}
              onBack={goBack}
              onSubmit={handleCreateAccount}
              loading={loading}
            />
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Já tem uma conta?{' '}
            <Link href="/login" className="font-medium text-green-700 hover:text-green-800">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
