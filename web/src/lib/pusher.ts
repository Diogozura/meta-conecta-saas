import PusherServerLib from 'pusher'
import PusherClientLib from 'pusher-js'

export const createPusherServer = () => {
  return new PusherServerLib({
    appId: process.env.PUSHER_APP_ID || '123',
    key: process.env.NEXT_PUBLIC_PUSHER_KEY || '123',
    secret: process.env.PUSHER_SECRET || '123',
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'sa1',
    useTLS: true,
  })
}

export const createPusherClient = () => {
  return new PusherClientLib(process.env.NEXT_PUBLIC_PUSHER_KEY || '123', {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'sa1',
  })
}