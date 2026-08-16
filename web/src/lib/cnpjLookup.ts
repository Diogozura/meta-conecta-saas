export interface CnpjLookupResult {
  companyName: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
}

export async function fetchCompanyByCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
  if (!res.ok) throw new Error('CNPJ não encontrado.')
  const data = await res.json()
  return {
    companyName: data.nome_fantasia || data.razao_social || '',
    cep: data.cep ?? '',
    street: data.logradouro ?? '',
    number: data.numero ?? '',
    neighborhood: data.bairro ?? '',
    city: data.municipio ?? '',
    state: data.uf ?? '',
  }
}
