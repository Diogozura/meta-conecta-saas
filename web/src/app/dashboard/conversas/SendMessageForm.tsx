'use client'

import { useState } from 'react'
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type SendStatus = 'idle' | 'loading' | 'success' | 'error'

export default function SendMessageForm() {
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<SendStatus>('idle')
  const [feedback, setFeedback] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!to || !message) return

    setStatus('loading')
    setFeedback('')

    try {
      const res = await fetch('/api/meta/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message }),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? 'Erro ao enviar mensagem')
      }

      setStatus('success')
      setFeedback(`Mensagem enviada! ID: ${json.messages?.[0]?.id ?? '—'}`)
      setTo('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setFeedback(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-800 text-sm">Enviar Nova Mensagem</h3>
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Número de destino (com DDI, sem espaços ou traços)
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Ex: 5511999990000"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            required
            placeholder="Digite a mensagem..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>

        {feedback && (
          <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {status === 'success'
              ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            }
            {feedback}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !to || !message}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {status === 'loading'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
          {status === 'loading' ? 'Enviando...' : 'Enviar via WhatsApp'}
        </button>
      </form>
    </div>
  )
}
