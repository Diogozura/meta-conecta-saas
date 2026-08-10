import { ArrowLeft, Camera, Check, MessageCircle } from 'lucide-react'

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', badgeClass: 'bg-[#25D366]', icon: MessageCircle },
  { key: 'instagram', label: 'Instagram', badgeClass: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600', icon: Camera },
  { key: 'facebook', label: 'Facebook', badgeClass: 'bg-[#1877F2]', icon: null },
] as const

interface StepChannelsProps {
  channels: string[]
  onToggleChannel: (key: string) => void
  onBack: () => void
  onContinue: () => void
  loading: boolean
}

export default function StepChannels({ channels, onToggleChannel, onBack, onContinue, loading }: StepChannelsProps) {
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

      <form onSubmit={(e) => { e.preventDefault(); onContinue() }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CHANNELS.map(({ key, label, badgeClass, icon: Icon }) => {
            const selected = channels.includes(key)
            return (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => onToggleChannel(key)}
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
                  {Icon ? <Icon className="w-5 h-5 text-white" /> : <span className="text-white text-lg font-bold">f</span>}
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </button>
            )
          })}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </form>
    </div>
  )
}
