'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { TourStep } from './types'
import { TourOverlay } from '@/components/tour/TourOverlay'

type TourContextValue = {
  active: boolean
  steps: TourStep[]
  index: number
  start: (steps: TourStep[]) => void
  next: () => void
  prev: () => void
  stop: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)

  const start = useCallback((newSteps: TourStep[]) => {
    if (newSteps.length === 0) return
    setSteps(newSteps)
    setIndex(0)
    setActive(true)
  }, [])

  const stop = useCallback(() => setActive(false), [])

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        setActive(false)
        return i
      }
      return i + 1
    })
  }, [steps.length])

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  const value = useMemo(
    () => ({ active, steps, index, start, next, prev, stop }),
    [active, steps, index, start, next, prev, stop],
  )

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && steps[index] && (
        <TourOverlay
          step={steps[index]}
          stepNumber={index + 1}
          totalSteps={steps.length}
          onNext={next}
          onPrev={prev}
          onStop={stop}
        />
      )}
    </TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour deve ser usado dentro de um TourProvider')
  return ctx
}
