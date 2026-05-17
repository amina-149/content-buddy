export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private handlers = new Map<string, (data: unknown) => void>()

  constructor(url: string = 'ws://localhost:3001') {
    this.url = url
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.url}?token=${token}`)

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onerror = (error) => {
          reject(error)
        }

        this.ws.onclose = () => {
          this.attemptReconnect(token)
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as { videoId?: string }
            const handler = data.videoId ? this.handlers.get(data.videoId) : undefined
            handler?.(data)
          } catch {
            // non-JSON frame — ignore
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  subscribe(videoId: string, callback: (data: unknown) => void) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.handlers.set(videoId, callback)
    this.ws.send(JSON.stringify({ action: 'subscribe', videoId }))
  }

  unsubscribe(videoId: string) {
    this.handlers.delete(videoId)
  }

  private attemptReconnect(token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => this.connect(token), this.reconnectDelay)
    }
  }

  disconnect() {
    this.handlers.clear()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const wsService = new WebSocketService()
