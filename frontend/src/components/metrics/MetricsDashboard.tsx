import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Target,
  Calendar,
  Filter,
  Download,
  Maximize2,
  MoreHorizontal,
  Award,
  Clock,
  Users,
  Zap
} from 'lucide-react';

export interface MetricData {
  date: string;
  clarity: number;
  pace: number;
  volume: number;
  engagement: number;
  overall: number;
}

export interface StatCard {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export interface MetricsDashboardProps {
  data: MetricData[];
  timeRange?: '7d' | '30d' | '90d' | '1y';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y') => void;
  className?: string;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  data = [],
  timeRange = '30d',
  onTimeRangeChange,
  className = ''
}) => {
  const { t } = useTranslation();
  const [selectedChart, setSelectedChart] = useState<'progress' | 'comparison' | 'breakdown'>('progress');
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'clarity' | 'pace' | 'volume' | 'engagement'>('all');

  // Generate mock data if no data provided
  const mockData = useMemo(() => {
    if (data.length > 0) return data;
    
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      return {
        date: date.toISOString().split('T')[0],
        clarity: Math.floor(Math.random() * 30) + 70,
        pace: Math.floor(Math.random() * 25) + 75,
        volume: Math.floor(Math.random() * 20) + 80,
        engagement: Math.floor(Math.random() * 35) + 65,
        overall: Math.floor(Math.random() * 20) + 80,
      };
    });
  }, [data, timeRange]);

  // Calculate statistics
  const stats: StatCard[] = useMemo(() => {
    const latest = mockData[mockData.length - 1];
    const previous = mockData[mockData.length - 8] || mockData[0];
    
    const calculateChange = (current: number, prev: number) => 
      prev ? ((current - prev) / prev) * 100 : 0;

    return [
      {
        id: 'sessions',
        title: t('metrics.stats.sessions'),
        value: mockData.length,
        change: 12,
        changeType: 'increase',
        icon: Activity,
        color: 'text-blue-400'
      },
      {
        id: 'improvement',
        title: t('metrics.stats.improvement'),
        value: `${latest?.overall || 0}%`,
        change: calculateChange(latest?.overall || 0, previous?.overall || 0),
        changeType: calculateChange(latest?.overall || 0, previous?.overall || 0) >= 0 ? 'increase' : 'decrease',
        icon: TrendingUp,
        color: 'text-green-400'
      },
      {
        id: 'streak',
        title: t('metrics.stats.streak'),
        value: '12 days',
        change: 2,
        changeType: 'increase',
        icon: Target,
        color: 'text-purple-400'
      },
      {
        id: 'goals',
        title: t('metrics.stats.goals'),
        value: '8/10',
        change: 25,
        changeType: 'increase',
        icon: Award,
        color: 'text-yellow-400'
      }
    ];
  }, [mockData, t]);

  // Skill breakdown data
  const skillBreakdown = useMemo(() => {
    const latest = mockData[mockData.length - 1];
    return [
      { name: 'Clarity', value: latest?.clarity || 0, color: '#00f5ff' },
      { name: 'Pace', value: latest?.pace || 0, color: '#bf00ff' },
      { name: 'Volume', value: latest?.volume || 0, color: '#ff0080' },
      { name: 'Engagement', value: latest?.engagement || 0, color: '#00ff41' }
    ];
  }, [mockData]);

  // Radar chart data
  const radarData = useMemo(() => {
    const latest = mockData[mockData.length - 1];
    const previous = mockData[Math.max(0, mockData.length - 8)];
    
    return [
      { metric: 'Clarity', current: latest?.clarity || 0, previous: previous?.clarity || 0 },
      { metric: 'Pace', current: latest?.pace || 0, previous: previous?.pace || 0 },
      { metric: 'Volume', current: latest?.volume || 0, previous: previous?.volume || 0 },
      { metric: 'Engagement', current: latest?.engagement || 0, previous: previous?.engagement || 0 },
      { metric: 'Overall', current: latest?.overall || 0, previous: previous?.overall || 0 }
    ];
  }, [mockData]);

  const timeRangeOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];

  const chartOptions = [
    { id: 'progress', label: t('metrics.charts.progress'), icon: TrendingUp },
    { id: 'comparison', label: t('metrics.charts.comparison'), icon: BarChart3 },
    { id: 'breakdown', label: t('metrics.charts.breakdown'), icon: PieIcon }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-gray-900/95 backdrop-blur-sm border border-glass-300 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-white text-sm font-medium">
              {entry.name}: {entry.value}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('metrics.title')}</h2>
          <p className="text-gray-400">{t('metrics.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-800/50 rounded-lg p-1">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onTimeRangeChange?.(option.value as any)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  timeRange === option.value
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-glass-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {/* Actions */}
          <button className="p-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <Download className="w-4 h-4 text-gray-400" />
          </button>
          
          <button className="p-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-2xl p-6 shadow-glass"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gray-800/50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1">
                {stat.changeType === 'increase' ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : stat.changeType === 'decrease' ? (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                ) : null}
                <span className={`text-sm font-medium ${
                  stat.changeType === 'increase' ? 'text-green-400' :
                  stat.changeType === 'decrease' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {stat.changeType !== 'neutral' && (stat.change >= 0 ? '+' : '')}{stat.change.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.title}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-3xl shadow-glass overflow-hidden">
        {/* Chart Header */}
        <div className="p-6 border-b border-glass-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Performance Analysis</h3>
            <button className="p-2 hover:bg-glass-300 rounded-lg transition-colors">
              <Maximize2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {/* Chart Type Selector */}
          <div className="flex space-x-1 bg-gray-800/50 rounded-xl p-1">
            {chartOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedChart(option.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedChart === option.id
                      ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-glass-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Content */}
        <div className="p-6 h-96">
          {selectedChart === 'progress' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData}>
                <defs>
                  <linearGradient id="clarityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f5ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#bf00ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#bf00ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff0080" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff0080" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="clarity"
                  stroke="#00f5ff"
                  strokeWidth={2}
                  fill="url(#clarityGradient)"
                  name="Clarity"
                />
                <Area
                  type="monotone"
                  dataKey="pace"
                  stroke="#bf00ff"
                  strokeWidth={2}
                  fill="url(#paceGradient)"
                  name="Pace"
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#ff0080"
                  strokeWidth={2}
                  fill="url(#volumeGradient)"
                  name="Volume"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {selectedChart === 'comparison' && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  dataKey="metric"
                />
                <PolarRadiusAxis 
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  domain={[0, 100]}
                  tickCount={5}
                />
                <Radar
                  name="Current"
                  dataKey="current"
                  stroke="#00f5ff"
                  fill="#00f5ff"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Radar
                  name="Previous"
                  dataKey="previous"
                  stroke="#9CA3AF"
                  fill="#9CA3AF"
                  fillOpacity={0.1}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {selectedChart === 'breakdown' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skillBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {skillBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="space-y-4">
                {skillBreakdown.map((skill, index) => (
                  <div key={skill.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: skill.color }}
                      />
                      <span className="text-white font-medium">{skill.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">{skill.value}%</div>
                      <div className="text-sm text-gray-400">
                        {skill.value >= 90 ? 'Excellent' : 
                         skill.value >= 80 ? 'Good' :
                         skill.value >= 70 ? 'Average' : 'Needs Work'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;