"""Validadores utilitários compartilhados."""
import re


def normalize_cnpj(cnpj: str) -> str:
    """Remove tudo que não é dígito."""
    return re.sub(r"\D", "", cnpj or "")


def is_valid_cnpj(cnpj: str) -> bool:
    """
    Validação de CNPJ com dígitos verificadores (algoritmo padrão da
    Receita Federal). Aceita o valor com ou sem máscara.
    """
    digits = normalize_cnpj(cnpj)

    if len(digits) != 14 or len(set(digits)) == 1:
        return False

    def calculate_digit(base: str, weights: list[int]) -> int:
        total = sum(int(d) * w for d, w in zip(base, weights))
        remainder = total % 11
        return 0 if remainder < 2 else 11 - remainder

    weights_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    digit_1 = calculate_digit(digits[:12], weights_1)
    digit_2 = calculate_digit(digits[:12] + str(digit_1), weights_2)

    return digits[-2:] == f"{digit_1}{digit_2}"


_WHATSAPP_NUMBER_RE = re.compile(r"^\+\d{8,15}$")


def is_valid_whatsapp_number(number: str) -> bool:
    """Formato E.164 simplificado: '+' seguido de 8 a 15 dígitos."""
    return bool(_WHATSAPP_NUMBER_RE.match(number or ""))
