/**
 * Lista heurística de hashtags frequentemente citadas como alvo de limitação
 * de alcance ("shadowban") no Instagram — sem fonte oficial da Meta (a API
 * não expõe isso), então é só um alerta de atenção, não uma confirmação.
 * Mistura termos genéricos saturados/de troca de curtida (PT e EN) que
 * aparecem com frequência em relatos e listas públicas sobre o assunto.
 */
export const HASHTAGS_ARRISCADAS = [
  'like4like', 'l4l', 'likeforlike', 'follow4follow', 'f4f', 'followforfollow',
  'followback', 'follome', 'likeforfollow', 'like4follow', 'tagsforlikes',
  'instalike', 'likeall', 'likesreturned', 'likebait', 'commentforcomment',
  'comment4comment', 'spam4spam', 'spamforspam', 'followtrain', 'teamfollowback',
  'unitedstates', 'instagood', 'instadaily', 'photooftheday', 'followme',
  'curtaeganheseguidor', 'seguidoresgratis', 'curtidasgratis', 'sigodevolta',
  'sdv', 'curtoquemcurtir', 'curtequecurtovolta', 'ganharseguidores',
  'trocadecurtidas', 'trocadeseguidores', 'seguidorestop', 'megaseguidores',
]

const HASHTAGS_ARRISCADAS_SET = new Set(HASHTAGS_ARRISCADAS)

/** Recebe uma legenda e devolve as hashtags dela que batem na lista de risco (sem o #, minúsculas). */
export function encontrarHashtagsArriscadas(caption: string): string[] {
  const encontradas = caption.match(/#[\p{L}0-9_]+/gu) ?? []
  const unicas = new Set(encontradas.map((h) => h.slice(1).toLowerCase()))
  return Array.from(unicas).filter((h) => HASHTAGS_ARRISCADAS_SET.has(h))
}
