'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type DayMark = 'available' | 'booked' | 'both'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function AgendaCalendar({
  marks,
  selected,
  onSelect,
  legend,
  dataTour,
  onMonthChange,
}: {
  marks: Record<string, DayMark>
  selected: string | null
  onSelect: (dateKey: string) => void
  legend?: { available?: string; booked?: string }
  dataTour?: string
  /** Avisa o componente pai qual mês está visível — útil pra buscar dados só do período exibido. */
  onMonthChange?: (year: number, month: number) => void
}) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  useEffect(() => {
    onMonthChange?.(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const todayKey = toDateKey(today)

  return (
    <div data-tour={dataTour} className="bg-white rounded-xl border border-ink-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500 transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink-900">{MONTHS[month]} {year}</p>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full hover:bg-brand-100 transition-colors"
          >
            Hoje
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500 transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-ink-400 uppercase py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = toDateKey(d)
          const mark = marks[key]
          const isSelected = selected === key
          const isToday = key === todayKey
          return (
            <button
              type="button"
              key={i}
              onClick={() => onSelect(key)}
              className={`relative h-10 rounded-lg text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isSelected
                  ? 'bg-brand-600 text-white'
                  : isToday
                    ? 'bg-brand-50 text-brand-700'
                    : mark === 'available' || mark === 'both'
                      ? 'bg-brand-50/70 text-ink-700 hover:bg-brand-100'
                      : 'text-ink-700 hover:bg-ink-100'
              }`}
            >
              {d.getDate()}
              {mark && (
                <span className="flex gap-0.5">
                  {(mark === 'available' || mark === 'both') && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />
                  )}
                  {(mark === 'booked' || mark === 'both') && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-accent-500'}`} />
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {(legend?.available || legend?.booked) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink-100">
          {legend?.available && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="w-2 h-2 rounded-full bg-brand-500" /> {legend.available}
            </span>
          )}
          {legend?.booked && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="w-2 h-2 rounded-full bg-accent-500" /> {legend.booked}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
