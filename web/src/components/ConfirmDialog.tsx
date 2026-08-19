'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** true (padrão) = ação destrutiva, botão vermelho. false = ação neutra, botão na cor da marca. */
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  message: string
}

/**
 * Substituto do `window.confirm()` nativo por uma telinha própria do app.
 * Mesma assinatura em Promise<boolean> do confirm() nativo, então basta
 * trocar `if (!confirm(msg))` por `if (!(await confirm(msg)))`.
 *
 * Uso:
 *   const { confirm, ConfirmDialogElement } = useConfirmDialog()
 *   async function handleDelete() {
 *     if (!(await confirm('Remover isso?'))) return
 *     ...
 *   }
 *   return <div>...{ConfirmDialogElement}</div>
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setState({ message, ...options })
    })
  }, [])

  function responder(valor: boolean) {
    resolverRef.current?.(valor)
    resolverRef.current = null
    setState(null)
  }

  const ConfirmDialogElement =
    state && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
            <div className="fixed inset-0 bg-ink-900/60" onClick={() => responder(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-ink-200 p-5 w-full max-w-sm animate-fade-in">
              <div className="flex items-start gap-3">
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                    state.danger !== false ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div className="min-w-0 pt-1">
                  {state.title && <p className="text-sm font-semibold text-ink-900 mb-1">{state.title}</p>}
                  <p className="text-sm text-ink-600">{state.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => responder(false)}
                  className="px-3.5 py-1.5 text-sm font-medium text-ink-600 bg-ink-100 rounded-lg hover:bg-ink-200 transition-colors"
                >
                  {state.cancelLabel ?? 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={() => responder(true)}
                  autoFocus
                  className={`px-3.5 py-1.5 text-sm font-medium text-white rounded-lg transition-colors ${
                    state.danger !== false ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  {state.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return { confirm, ConfirmDialogElement }
}
