import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterInstagramAccess } from '@/lib/firestore'

export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ credentials: null })
  }

  const instagramAccess = await obterInstagramAccess(session.user.contaId)
  if (!instagramAccess) {
    return NextResponse.json({ credentials: null })
  }

  return NextResponse.json({
    credentials: {
      username: instagramAccess.username,
      accountType: instagramAccess.accountType,
      profilePictureUrl: instagramAccess.profilePictureUrl,
      tokenExpiraEm: instagramAccess.tokenExpiraEm,
    },
  })
}
