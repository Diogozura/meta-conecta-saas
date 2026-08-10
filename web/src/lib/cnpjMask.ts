export function unformatCNPJ(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14)
}

export function formatCNPJ(value: string): string {
  const digits = unformatCNPJ(value)
  let out = digits.slice(0, 2)
  if (digits.length > 2) out += '.' + digits.slice(2, 5)
  if (digits.length > 5) out += '.' + digits.slice(5, 8)
  if (digits.length > 8) out += '/' + digits.slice(8, 12)
  if (digits.length > 12) out += '-' + digits.slice(12, 14)
  return out
}
