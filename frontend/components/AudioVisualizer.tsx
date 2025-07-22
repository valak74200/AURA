'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface AudioVisualizerProps {
  audioLevel: number
  isActive: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

export default function AudioVisualizer({ 
  audioLevel, 
  isActive, 
  size = 'md',
  color = '#667eea'
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()

  const sizeConfig = {
    sm: { width: 200, height: 60, bars: 20 },
    md: { width: 300, height: 80, bars: 30 },
    lg: { width: 400, height: 100, bars: 40 }
  }

  const config = sizeConfig[size]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, config.width, config.height)

      if (!isActive) {
        // Draw static bars when not active
        ctx.fillStyle = `${color}40`
        for (let i = 0; i < config.bars; i++) {
          const barWidth = (config.width / config.bars) - 2
          const x = i * (config.width / config.bars)
          const height = 4
          const y = (config.height - height) / 2
          
          ctx.fillRect(x, y, barWidth, height)
        }
        return
      }

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, config.height)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, `${color}80`)
      ctx.fillStyle = gradient

      // Draw animated bars
      for (let i = 0; i < config.bars; i++) {
        const barWidth = (config.width / config.bars) - 2
        const x = i * (config.width / config.bars)
        
        // Create wave effect with audio level influence
        const wave = Math.sin((Date.now() * 0.005) + (i * 0.3)) * 0.5 + 0.5
        const baseHeight = 8 + (audioLevel * 60)
        const height = Math.max(4, baseHeight * wave)
        const y = (config.height - height) / 2
        
        ctx.fillRect(x, y, barWidth, height)
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [audioLevel, isActive, config, color])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        width={config.width}
        height={config.height}
        className="rounded-lg"
        style={{ 
          filter: isActive ? 'drop-shadow(0 0 10px rgba(102, 126, 234, 0.3))' : 'none'
        }}
      />
    </motion.div>
  )
}