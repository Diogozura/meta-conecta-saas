"""
Router de autenticação.

Importante: este backend é stateless em relação a sessão — não criamos
sessão de servidor nem cookie próprio. O frontend mantém o Firebase ID
Token (renovado automaticamente pelo Firebase client SDK) e o envia em
TODA requisição como `Authorization: Bearer <token>`.

/auth/session existe como um endpoint de conveniência para o frontend
validar o token logo após o login e já receber o perfil + company_id
resolvidos, replicando o que a função `setSession()` do seu login atual
faz — só que agora validado pelo backend Python, não por uma API route
do Next.js.
"""
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import AuthenticatedUser
from app.schemas.user_schema import AuthenticatedUserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/session", response_model=AuthenticatedUserResponse)
async def create_session(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Chamado pelo frontend logo após o login no Firebase (email/senha ou
    Google), enviando o ID Token no header Authorization. Retorna o
    perfil do usuário já resolvido, incluindo company_id.
    """
    return AuthenticatedUserResponse.model_validate(user)


@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_me(user: AuthenticatedUser = Depends(get_current_user)):
    """Retorna o usuário autenticado atual — útil para revalidar sessão."""
    return AuthenticatedUserResponse.model_validate(user)
