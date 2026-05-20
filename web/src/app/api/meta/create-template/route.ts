import { cookies } from 'next/headers'
import { createTemplate, type TemplateCategory, type TemplateComponent } from '@/lib/meta'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: {
    name?: string
    category?: TemplateCategory
    language?: string
    header?: string
    bodyText?: string
    footer?: string
  }

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.name || !body.category || !body.bodyText) {
    return Response.json({ error: 'Campos "name", "category" e "bodyText" são obrigatórios' }, { status: 400 })
  }

  const wabaId = process.env.META_WABA_ID
  const businessToken = process.env.META_BUSINESS_TOKEN

  if (!wabaId || !businessToken) {
    return Response.json(
      { error: 'META_WABA_ID e META_BUSINESS_TOKEN não configurados no .env.local' },
      { status: 503 },
    )
  }

  // Monta os componentes: nome do template deve ser snake_case, sem espaços
  const templateName = body.name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  const components: TemplateComponent[] = []

  if (body.header?.trim()) {
    components.push({ type: 'HEADER', format: 'TEXT', text: body.header.trim() })
  }
  components.push({ type: 'BODY', text: body.bodyText.trim() })
  if (body.footer?.trim()) {
    components.push({ type: 'FOOTER', text: body.footer.trim() })
  }

  try {
    const result = await createTemplate(wabaId, businessToken, {
      name: templateName,
      category: body.category,
      language: body.language ?? 'pt_BR',
      components,
    })
    return Response.json({ ...result, name: templateName })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
