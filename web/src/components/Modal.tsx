'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Modal genérico (overlay sobre a tela toda) — fecha com Esc, clique no fundo ou no X. */
export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  widthClass?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-ink-900/60" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl border border-ink-200 w-full ${widthClass} max-h-[85vh] flex flex-col animate-fade-in`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 shrink-0">
            <p className="text-sm font-semibold text-ink-900 capitalize">{title}</p>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}
