import { useEffect, useRef, useState, useCallback } from 'react'
import { WebSocketMessage } from '@/types'

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  reconnectAttempts?: number
  reconnectInterval?: number
  shouldReconnect?: boolean
}

interface UseWebSocketReturn {
  sendMessage: (message: WebSocketMessage | string) => void
  connectionStatus: 'Connecting' | 'Open' | 'Closing' | 'Closed'
  lastMessage: WebSocketMessage | null
  reconnect: () => void
  disconnect: () => void
}

export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    shouldReconnect = true
  } = options

  const [connectionStatus, setConnectionStatus] = useState<'Connecting' | 'Open' | 'Closing' | 'Closed'>('Closed')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectCountRef = useRef(0)
  const shouldReconnectRef = useRef(shouldReconnect)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus('Connecting')
    
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionStatus('Open')
        reconnectCountRef.current = 0
        onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
          onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        setConnectionStatus('Closed')
        onClose?.()

        // Attempt to reconnect if enabled and we haven't exceeded max attempts
        if (shouldReconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionStatus('Closed')
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectAttempts, reconnectInterval])

  const sendMessage = useCallback((message: WebSocketMessage | string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message)
      wsRef.current.send(messageString)
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message)
    }
  }, [])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      setConnectionStatus('Closing')
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    shouldReconnectRef.current = true
    reconnectCountRef.current = 0
    setTimeout(connect, 100)
  }, [connect, disconnect])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  useEffect(() => {
    shouldReconnectRef.current = shouldReconnect
  }, [shouldReconnect])

  return {
    sendMessage,
    connectionStatus,
    lastMessage,
    reconnect,
    disconnect
  }
}