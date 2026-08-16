export interface CadastroFormData {
  // Etapa 1 — Conta
  name: string
  email: string
  // Etapa 2 — Empresa
  companyName: string
  cnpj: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  // Etapa 3 — Perfil
  segment: string
  segmentOther: string
  teamSize: string
  // Etapa 4 — Canais
  channels: string[]
  // Etapa 5 — Pagamento
  paymentMethod: string
}

export const initialCadastroFormData: CadastroFormData = {
  name: '',
  email: '',
  companyName: '',
  cnpj: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  segment: '',
  segmentOther: '',
  teamSize: '',
  channels: [],
  paymentMethod: '',
}
