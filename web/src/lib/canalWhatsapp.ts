/**
 * Uma conta pode ter mais de um número de WhatsApp registrado na mesma WABA
 * (ex: uma loja física por número) — o webhook chega igual pra todos (a
 * Meta só identifica pela WABA), então quem decide por qual número RESPONDER
 * é essa função: sempre o mesmo número em que o cliente escreveu, nunca
 * sempre o principal por padrão. Cai pro principal quando a conversa ainda
 * não tem canal registrado, ou o canal salvo não pertence mais à conta
 * (ex: número removido depois).
 */
export function resolverPhoneNumberId(
  metaAccess: { phoneNumberId: string; numerosAdicionais?: { phoneNumberId: string }[] },
  canalDaConversa?: string | null,
): string {
  if (!canalDaConversa) return metaAccess.phoneNumberId
  if (canalDaConversa === metaAccess.phoneNumberId) return canalDaConversa
  if (metaAccess.numerosAdicionais?.some((n) => n.phoneNumberId === canalDaConversa)) return canalDaConversa
  return metaAccess.phoneNumberId
}
