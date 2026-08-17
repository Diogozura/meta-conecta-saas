'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { TourStep } from '@/lib/tour/types'

const CARD_WIDTH = 320
const GAP = 14

export function TourOverlay({
  step,
  stepNumber,
  totalSteps,
  onNext,
  onPrev,
  onStop,
}: {
  step: TourStep
  stepNumber: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onStop: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal só pode montar após o client confirmar que document existe
    setMounted(true)
  }, [])

  useEffect(() => {
    function measure() {
      const el = document.querySelector(step.target)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    const id = window.setInterval(measure, 250)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.target])

  if (!mounted) return null

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  let cardTop: number
  let cardLeft: number

  if (rect) {
    const spaceBelow = viewportH - rect.bottom
    if (spaceBelow > 180 || spaceBelow > rect.top) {
      cardTop = Math.min(rect.bottom + GAP, viewportH - 200)
    } else {
      cardTop = Math.max(16, rect.top - GAP - 190)
    }
    cardLeft = Math.min(Math.max(16, rect.left), viewportW - CARD_WIDTH - 16)
  } else {
    cardTop = viewportH / 2 - 90
    cardLeft = viewportW / 2 - CARD_WIDTH / 2
  }

  const overlay = (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {rect ? (
        <div
          className="fixed rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink-900/60" />
      )}

      <button
        onClick={onStop}
        className="fixed inset-0 z-[100] cursor-default"
        aria-label="Fechar tour"
        tabIndex={-1}
      />

      <div
        className="fixed z-[102] bg-white rounded-2xl shadow-2xl border border-ink-200 p-5 animate-fade-in"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            {stepNumber} de {totalSteps}
          </span>
          <button onClick={onStop} className="text-ink-400 hover:text-ink-700 -m-1 p-1 rounded-md hover:bg-ink-100" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-sm font-bold text-ink-900 mb-1.5">{step.title}</h3>
        <p className="text-sm text-ink-600 leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepNumber - 1 ? 'w-4 bg-brand-600' : 'w-1.5 bg-ink-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {stepNumber > 1 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
            >
              {stepNumber === totalSteps ? 'Concluir' : 'Próximo'}
              {stepNumber !== totalSteps && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
