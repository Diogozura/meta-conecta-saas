'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, ZoomIn } from 'lucide-react'

export type AspectKey = 'original' | '1:1' | '4:5' | '16:9'

export interface CropSettings {
  aspect: AspectKey
  zoom: number
  panX: number
  panY: number
}

export const DEFAULT_CROP: CropSettings = { aspect: 'original', zoom: 1, panX: 0, panY: 0 }

const ASPECT_OPTIONS: { key: AspectKey; label: string; ratio?: number }[] = [
  { key: 'original', label: 'Original' },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
]

const STAGE_WIDTH = 340

function useImageSize(url: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => { if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return size
}

/** Calcula altura do palco de corte a partir da proporção escolhida (ou da imagem original). */
function stageRatio(aspect: AspectKey, natural: { w: number; h: number } | null): number {
  const opt = ASPECT_OPTIONS.find((o) => o.key === aspect)
  if (opt?.ratio) return opt.ratio
  if (natural) return natural.w / natural.h
  return 1
}

function clampPan(panX: number, panY: number, stageW: number, stageH: number, scaledW: number, scaledH: number) {
  const minX = Math.min(0, stageW - scaledW)
  const minY = Math.min(0, stageH - scaledH)
  return { x: Math.min(0, Math.max(minX, panX)), y: Math.min(0, Math.max(minY, panY)) }
}

/** Miniatura estática que reaproduz o mesmo enquadramento do CropEditor em outro tamanho (proporcional). */
export function CropThumb({ url, settings, size = 64 }: { url: string; settings: CropSettings; size?: number }) {
  const natural = useImageSize(url)
  const ratio = stageRatio(settings.aspect, natural)
  const stageH = Math.round(size / ratio)
  const factor = size / STAGE_WIDTH
  const baseScale = natural ? Math.max(size / natural.w, stageH / natural.h) : 1
  const totalScale = baseScale * settings.zoom
  const scaledW = (natural?.w ?? size) * totalScale
  const scaledH = (natural?.h ?? stageH) * totalScale

  return (
    <div className="relative overflow-hidden rounded bg-black" style={{ width: size, height: stageH }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de preview, não passa pelo otimizador do Next */}
      <img
        src={url}
        alt=""
        draggable={false}
        className="absolute top-0 left-0 max-w-none"
        style={{ width: scaledW, height: scaledH, transform: `translate(${settings.panX * factor}px, ${settings.panY * factor}px)` }}
      />
    </div>
  )
}

interface CropEditorProps {
  url: string
  settings: CropSettings
  onChange: (next: CropSettings) => void
}

/** Editor de corte estilo Instagram: escolha de proporção + arrastar/zoom da imagem dentro do quadro. */
export default function CropEditor({ url, settings, onChange }: CropEditorProps) {
  const natural = useImageSize(url)
  const ratio = stageRatio(settings.aspect, natural)
  const stageH = Math.round(STAGE_WIDTH / ratio)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const baseScale = useMemo(() => {
    if (!natural) return 1
    return Math.max(STAGE_WIDTH / natural.w, stageH / natural.h)
  }, [natural, stageH])

  const totalScale = baseScale * settings.zoom
  const scaledW = (natural?.w ?? STAGE_WIDTH) * totalScale
  const scaledH = (natural?.h ?? stageH) * totalScale

  // Recentraliza/clampa o pan sempre que a proporção ou o zoom mudam.
  useEffect(() => {
    const { x, y } = clampPan(settings.panX, settings.panY, STAGE_WIDTH, stageH, scaledW, scaledH)
    if (x !== settings.panX || y !== settings.panY) onChange({ ...settings, panX: x, panY: y })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.aspect, settings.zoom, scaledW, scaledH, stageH])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: settings.panX, panY: settings.panY }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const { x, y } = clampPan(dragRef.current.panX + dx, dragRef.current.panY + dy, STAGE_WIDTH, stageH, scaledW, scaledH)
    onChange({ ...settings, panX: x, panY: y })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative overflow-hidden rounded-lg bg-black touch-none select-none"
        style={{ width: STAGE_WIDTH, height: stageH, cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem arrastável dentro do palco de corte, não passa pelo otimizador do Next */}
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 max-w-none"
          style={{ width: scaledW, height: scaledH, transform: `translate(${settings.panX}px, ${settings.panY}px)` }}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <Maximize2 className="w-3.5 h-3.5 text-ink-400" />
        {ASPECT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange({ ...settings, aspect: opt.key })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              settings.aspect === opt.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 w-full max-w-xs">
        <ZoomIn className="w-4 h-4 text-ink-400 shrink-0" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={settings.zoom}
          onChange={(e) => onChange({ ...settings, zoom: Number(e.target.value) })}
          className="w-full accent-brand-600"
        />
      </div>
    </div>
  )
}

/** Gera o arquivo final já cortado, renderizando a região visível do palco em um canvas. */
export async function exportCroppedFile(file: File, settings: CropSettings): Promise<File> {
  if (settings.aspect === 'original' && settings.zoom === 1 && settings.panX === 0 && settings.panY === 0) {
    return file
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })

    const ratio = stageRatio(settings.aspect, { w: img.naturalWidth, h: img.naturalHeight })
    const stageH = STAGE_WIDTH / ratio
    const baseScale = Math.max(STAGE_WIDTH / img.naturalWidth, stageH / img.naturalHeight)
    const totalScale = baseScale * settings.zoom

    const sx = -settings.panX / totalScale
    const sy = -settings.panY / totalScale
    const sw = STAGE_WIDTH / totalScale
    const sh = stageH / totalScale

    const outputW = ratio >= 1 ? 1440 : Math.round(1440 * ratio)
    const outputH = ratio >= 1 ? Math.round(1440 / ratio) : 1440

    const canvas = document.createElement('canvas')
    canvas.width = outputW
    canvas.height = outputH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputW, outputH)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
