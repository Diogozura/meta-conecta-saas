export interface CepLookupResult {
  street: string
  neighborhood: string
  city: string
  state: string
}

export async function fetchAddressByCep(cep: string): Promise<CepLookupResult> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  if (!res.ok) throw new Error('Erro ao consultar CEP.')
  const data = await res.json()
  if (data.erro) throw new Error('CEP não encontrado.')
  return {
    street: data.logradouro ?? '',
    neighborhood: data.bairro ?? '',
    city: data.localidade ?? '',
    state: data.uf ?? '',
  }
}
