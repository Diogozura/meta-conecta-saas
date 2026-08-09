/**
 * Migração única: criptografa businessToken/appSecret de registros
 * metaAccess que ainda estão em texto puro (gravados antes de
 * src/lib/crypto.ts existir). Idempotente — registros já criptografados
 * (prefixo "enc_v1:") são pulados.
 *
 * Execute com: npx tsx scripts/migrate-encrypt-meta-credentials.ts
 */

// IMPORTANTE: Carregar dotenv ANTES de qualquer import do Firebase
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { encrypt, isEncrypted } from '../src/lib/crypto'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

async function migrate() {
  const db = getFirestore(getApps()[0], 'zybot-data')

  const contasSnapshot = await db.collection('contas').get()
  console.log(`Verificando ${contasSnapshot.size} conta(s)...\n`)

  let migrated = 0
  let alreadyEncrypted = 0
  let skippedEmpty = 0

  for (const contaDoc of contasSnapshot.docs) {
    const metaSnapshot = await contaDoc.ref.collection('metaAccess').get()

    for (const metaDoc of metaSnapshot.docs) {
      const data = metaDoc.data()
      const updates: Record<string, string> = {}

      for (const field of ['businessToken', 'appSecret'] as const) {
        const value = data[field]
        if (!value) {
          skippedEmpty++
          continue
        }
        if (isEncrypted(value)) {
          alreadyEncrypted++
          continue
        }
        updates[field] = encrypt(value)
      }

      if (Object.keys(updates).length > 0) {
        await metaDoc.ref.update(updates)
        console.log(`✅ Criptografado: contas/${contaDoc.id}/metaAccess/${metaDoc.id} (${Object.keys(updates).join(', ')})`)
        migrated++
      } else {
        console.log(`⏭️  Sem mudança: contas/${contaDoc.id}/metaAccess/${metaDoc.id}`)
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Registros migrados agora: ${migrated}`)
  console.log(`Campos já criptografados (pulados): ${alreadyEncrypted}`)
  console.log(`Campos vazios (pulados): ${skippedEmpty}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

migrate()
  .then(() => {
    console.log('\n✅ Migração concluída.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erro na migração:', error)
    process.exit(1)
  })
