export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  
  constructor(url: string = 'ws://localhost:3001') {
    this.url = url
  }
  
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.url}?token=${token}`)
        
        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          resolve()
        }
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }
        
        this.ws.onclose = () => {
          this.attemptReconnect(token)
        }
      } catch (error) {
        reject(error)
      }
    })
  }
  
  subscribe(videoId: string, callback: (data: any) => void) {
    if (!this.ws) return
    
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      videoId
    }))
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callback(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
  }
  
  private attemptReconnect(token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => this.connect(token), this.reconnectDelay)
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const wsService = new WebSocketService()
