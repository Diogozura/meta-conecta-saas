import { describe, expect, it } from 'vitest'
import { encontrarTermosProibidos, encontrarRiscosPolitica } from './textoRiscos'

describe('encontrarTermosProibidos', () => {
  it('sem lista configurada, não acusa nada', () => {
    expect(encontrarTermosProibidos('qualquer legenda aqui', undefined)).toEqual([])
    expect(encontrarTermosProibidos('qualquer legenda aqui', [])).toEqual([])
  })

  it('encontra um termo proibido presente na legenda, ignorando maiúsculas/minúsculas', () => {
    expect(encontrarTermosProibidos('Compre já na ConcorrenteX hoje', ['concorrentex'])).toEqual(['concorrentex'])
  })

  it('não acusa quando o termo não aparece', () => {
    expect(encontrarTermosProibidos('Legenda totalmente normal', ['concorrentex'])).toEqual([])
  })

  it('ignora termos vazios ou só com espaço na lista', () => {
    expect(encontrarTermosProibidos('legenda qualquer', ['', '   '])).toEqual([])
  })

  it('devolve todos os termos proibidos encontrados, não só o primeiro', () => {
    const achados = encontrarTermosProibidos('Termo A e termo B na mesma legenda', ['termo a', 'termo b', 'termo c'])
    expect(achados).toEqual(['termo a', 'termo b'])
  })

  it('usa substring simples (sem word boundary) — documenta a limitação: "treinar" contém "reina"', () => {
    expect(encontrarTermosProibidos('Vamos treinar amanhã', ['reina'])).toEqual(['reina'])
  })
})

describe('encontrarRiscosPolitica', () => {
  it('legenda comum não aciona nenhum risco', () => {
    expect(encontrarRiscosPolitica('Confira nosso novo produto, chegou hoje na loja!')).toEqual([])
  })

  it('detecta pedido de marcar amigos (engagement bait)', () => {
    expect(encontrarRiscosPolitica('Marque 3 amigos para participar do sorteio')).toHaveLength(1)
  })

  it('detecta "siga e ganhe"', () => {
    expect(encontrarRiscosPolitica('Siga e ganhe um brinde exclusivo')).toHaveLength(1)
  })

  it('detecta alegação de saúde não comprovada', () => {
    expect(encontrarRiscosPolitica('Nosso chá é cura garantida para todos os males')).toHaveLength(1)
  })

  it('detecta promessa de emagrecimento com prazo', () => {
    expect(encontrarRiscosPolitica('Emagreça 10kg em 1 mês com esse suplemento')).toHaveLength(1)
  })

  it('detecta sorteio pedindo Pix', () => {
    expect(encontrarRiscosPolitica('Sorteio incrível, faça um Pix de R$10 para participar')).toHaveLength(1)
  })

  it('é case-insensitive', () => {
    expect(encontrarRiscosPolitica('SIGA E GANHE agora mesmo')).toHaveLength(1)
  })

  it('pode acionar mais de um risco na mesma legenda', () => {
    const riscos = encontrarRiscosPolitica('Siga e ganhe! Cura garantida pra sua ansiedade, marque 5 amigos')
    expect(riscos.length).toBeGreaterThanOrEqual(2)
  })
})
