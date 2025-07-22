'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { getMetricStatus, getMetricColors } from '@/lib/utils'

interface MetricsCardProps {
  title: string
  value: number
  type: 'pace' | 'volume' | 'clarity'
  icon: LucideIcon
  unit?: string
  target?: string
  className?: string
}

export default function MetricsCard({
  title,
  value,
  type,
  icon: Icon,
  unit = '%',
  target,
  className = ''
}: MetricsCardProps) {
  const displayValue = type === 'pace' ? Math.round(value) : Math.round(value * 100)
  const metricStatus = getMetricStatus(type === 'pace' ? value : value, type)
  const colors = getMetricColors(metricStatus)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`card ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
          {metricStatus}
        </div>
      </div>

      <div className="text-center">
        <div className="text-sm text-gray-400 mb-2">{title}</div>
        <div className={`text-3xl font-bold mb-1 ${colors.text}`}>
          {displayValue}{type === 'pace' ? '' : unit}
        </div>
        {target && (
          <div className="text-xs text-gray-500">
            Idéal: {target}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: type === 'pace' 
                ? `${Math.min((value / 200) * 100, 100)}%`
                : `${Math.min(value * 100, 100)}%`
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-2 rounded-full ${
              metricStatus === 'excellent' ? 'bg-green-500' :
              metricStatus === 'good' ? 'bg-blue-500' :
              metricStatus === 'average' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
          />
        </div>
      </div>
    </motion.div>
  )
}