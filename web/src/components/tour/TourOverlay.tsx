'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { TourStep } from '@/lib/tour/types'

const CARD_WIDTH = 320
const GAP = 14
const MARGIN = 16

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
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal só pode montar após o client confirmar que document existe
    setMounted(true)
  }, [])

  useEffect(() => {
    function measureTarget() {
      const el = document.querySelector(step.target)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measureTarget()
    const id = window.setInterval(measureTarget, 250)
    window.addEventListener('resize', measureTarget)
    window.addEventListener('scroll', measureTarget, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('scroll', measureTarget, true)
    }
  }, [step.target])

  // Reposiciona usando a altura REAL do card (medida após ele renderizar o
  // conteúdo do passo atual) em vez de uma altura estimada — passos com
  // descrição maior (ex: 3 linhas) empurravam o botão "Próximo" pra fora da
  // tela quando o alvo ficava perto da borda inferior do viewport.
  useLayoutEffect(() => {
    const cardEl = cardRef.current
    if (!cardEl) return
    const cardHeight = cardEl.offsetHeight
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let top: number
    let left: number

    if (rect) {
      const spaceBelow = viewportH - rect.bottom - GAP
      const spaceAbove = rect.top - GAP
      top = spaceBelow >= cardHeight || spaceBelow >= spaceAbove
        ? rect.bottom + GAP
        : rect.top - GAP - cardHeight
      top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, viewportH - cardHeight - MARGIN))
      left = Math.min(Math.max(MARGIN, rect.left), Math.max(MARGIN, viewportW - CARD_WIDTH - MARGIN))
    } else {
      top = Math.max(MARGIN, viewportH / 2 - cardHeight / 2)
      left = viewportW / 2 - CARD_WIDTH / 2
    }
    setPos({ top, left, ready: true })
  }, [rect, step, stepNumber])

  if (!mounted) return null

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
        ref={cardRef}
        className="fixed z-[102] bg-white rounded-2xl shadow-2xl border border-ink-200 p-5 overflow-y-auto scrollbar-thin animate-fade-in"
        style={{
          top: pos.top,
          left: pos.left,
          width: CARD_WIDTH,
          maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
          visibility: pos.ready ? 'visible' : 'hidden',
        }}
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
