import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

/* 
  Essas credenciais precisam ser preenchidas no seu .env.local
  Para conseguir isso, crie uma conta gratuita em: https://pusher.com/
*/
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
})