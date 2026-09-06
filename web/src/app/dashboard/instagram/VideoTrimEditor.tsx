'use client'

import { useRef, useState } from 'react'
import { Scissors, VolumeX } from 'lucide-react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

export interface VideoTrimSettings {
  startSec: number
  endSec: number | null // null = "ainda não mexeu" — vira a duração real assim que o vídeo carrega
  mudo: boolean
}

export const DEFAULT_TRIM: VideoTrimSettings = { startSec: 0, endSec: null, mudo: false }

interface VideoTrimEditorProps {
  url: string
  settings: VideoTrimSettings
  onChange: (next: VideoTrimSettings) => void
}

/** Editor de corte de vídeo: início/fim + remover áudio. Preview com o `<video>` nativo do navegador. */
export default function VideoTrimEditor({ url, settings, onChange }: VideoTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const endSec = settings.endSec ?? duration ?? 0

  function seek(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      <video
        ref={videoRef}
        src={url}
        controls
        className="w-full max-h-64 rounded-lg bg-black"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          setDuration(d)
          if (settings.endSec === null) onChange({ ...settings, endSec: d })
        }}
      />

      {duration !== null && (
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-ink-400 shrink-0" />
            <span className="text-xs text-ink-500 w-10 shrink-0">Início</span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={settings.startSec}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), endSec - 0.2)
                onChange({ ...settings, startSec: v })
                seek(v)
              }}
              className="flex-1 accent-brand-600"
            />
            <span className="text-xs text-ink-500 w-10 text-right shrink-0">{settings.startSec.toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-ink-400 shrink-0" />
            <span className="text-xs text-ink-500 w-10 shrink-0">Fim</span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={endSec}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), settings.startSec + 0.2)
                onChange({ ...settings, endSec: v })
                seek(v)
              }}
              className="flex-1 accent-brand-600"
            />
            <span className="text-xs text-ink-500 w-10 text-right shrink-0">{endSec.toFixed(1)}s</span>
          </div>
          <p className="text-xs text-ink-400 text-center">Duração final: {(endSec - settings.startSec).toFixed(1)}s de {duration.toFixed(1)}s originais</p>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer self-start">
        <input type="checkbox" checked={settings.mudo} onChange={(e) => onChange({ ...settings, mudo: e.target.checked })} className="w-4 h-4 accent-brand-600" />
        <span className="flex items-center gap-1.5 text-sm text-ink-700"><VolumeX className="w-3.5 h-3.5 text-ink-400" /> Remover áudio</span>
      </label>
    </div>
  )
}

// Core do ffmpeg.wasm em single-thread — não precisa dos headers COOP/COEP que a versão
// multi-thread exige (essa é a build recomendada quando não se controla os headers do servidor
// ou não se quer arriscar quebrar outros fluxos, como popups de OAuth). Carregado só quando
// alguém realmente corta um vídeo, via import dinâmico, e reaproveitado entre exports na mesma
// sessão (recarregar o core custa alguns MB e alguns segundos toda vez).
let ffmpegSingleton: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpeg()
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegSingleton = ffmpeg
  return ffmpeg
}

/** Gera o arquivo final cortado (e sem áudio, se marcado). Sem alteração nenhuma, devolve o arquivo original. */
export async function exportTrimmedFile(file: File, settings: VideoTrimSettings): Promise<File> {
  if (settings.startSec === 0 && settings.endSec === null && !settings.mudo) {
    return file
  }

  const { fetchFile } = await import('@ffmpeg/util')
  const ffmpeg = await getFFmpeg()

  const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] ?? '.mp4')
  const outputName = 'output.mp4'
  const duracao = (settings.endSec ?? 0) - settings.startSec

  await ffmpeg.writeFile(inputName, await fetchFile(file))

  async function rodar(args: string[]) {
    await ffmpeg.exec(args)
    return ffmpeg.readFile(outputName)
  }

  let data: Awaited<ReturnType<typeof rodar>>
  try {
    // Corte rápido, sem recodificar — pode ajustar pro keyframe mais próximo do início pedido.
    data = await rodar(['-ss', String(settings.startSec), '-i', inputName, '-t', String(duracao), '-c', 'copy', ...(settings.mudo ? ['-an'] : []), outputName])
  } catch {
    // Alguns contêineres não aceitam corte "copy" fora de um keyframe — recodifica como fallback
    // (mais lento, mas preciso no segundo exato pedido).
    data = await rodar(['-i', inputName, '-ss', String(settings.startSec), '-t', String(duracao), '-c:v', 'libx264', ...(settings.mudo ? ['-an'] : ['-c:a', 'aac']), outputName])
  }

  await ffmpeg.deleteFile(inputName).catch(() => {})
  await ffmpeg.deleteFile(outputName).catch(() => {})

  const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' })
  return new File([blob], file.name.replace(/\.\w+$/, '') + '-cortado.mp4', { type: 'video/mp4' })
}
