import { ArrowLeft, Check, CreditCard, Loader2, QrCode } from 'lucide-react'

const GoogleGIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const METHODS = [
  { key: 'cartao', label: 'Cartão de crédito', badgeClass: 'bg-gray-700', icon: <CreditCard className="w-5 h-5 text-white" /> },
  { key: 'pix', label: 'Pix', badgeClass: 'bg-[#32BCAD]', icon: <QrCode className="w-5 h-5 text-white" /> },
  { key: 'google_pay', label: 'Google Pay', badgeClass: 'bg-white border border-gray-200', icon: <GoogleGIcon /> },
] as const

interface StepPaymentProps {
  paymentMethod: string
  onSelectMethod: (key: string) => void
  onBack: () => void
  onSubmit: () => void
  loading: boolean
}

export default function StepPayment({ paymentMethod, onSelectMethod, onBack, onSubmit, loading }: StepPaymentProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {METHODS.map(({ key, label, badgeClass, icon }) => {
            const selected = paymentMethod === key
            return (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => onSelectMethod(selected ? '' : key)}
                className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors disabled:opacity-50 ${
                  selected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                {selected && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${badgeClass}`}>
                  {icon}
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="submit"
            disabled={loading || !paymentMethod}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Finalizar cadastro
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="w-full py-2.5 px-4 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Pular por agora e começar a usar
          </button>
        </div>
      </form>
    </div>
  )
}
