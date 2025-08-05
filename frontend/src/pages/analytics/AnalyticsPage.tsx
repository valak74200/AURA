import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar, 
  Filter,
  Download,
  Target,
  Clock,
  Mic,
  Award,
  AlertCircle
} from 'lucide-react';
import { useSessionAnalytics, useSessions } from '../../hooks/useSession';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, Button, Badge, LoadingSpinner } from '../../components/ui';
import { MultilangualMetrics, SessionsQuery } from '../../types';
import MetricsDashboard from '../../components/metrics/MetricsDashboard';

const AnalyticsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Fetch sessions for analytics
  const sessionsQuery: SessionsQuery = {
    status: 'completed',
    limit: 50,
    sort_by: 'created_at',
    sort_order: 'desc'
  };
  
  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError } = useSessions(sessionsQuery);
  
  // Get analytics for the first completed session or selected session
  const targetSessionId = selectedSessionId || sessionsData?.data?.[0]?.id;
  const { 
    data: analyticsData, 
    isLoading: analyticsLoading, 
    error: analyticsError 
  } = useSessionAnalytics(
    targetSessionId || '', 
    { include_trends: true, include_benchmarks: true },
    !!targetSessionId
  );

  const isLoading = sessionsLoading || analyticsLoading;
  const hasError = sessionsError || analyticsError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Error loading analytics</h3>
              <p className="text-sm text-red-500">
                {(sessionsError as any)?.message || (analyticsError as any)?.message || 'Failed to load data'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!sessionsData?.data?.length) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">No analytics data available</h3>
          <p className="text-gray-600 mb-4">Complete some sessions to view your analytics</p>
          <Button 
            variant="primary"
            onClick={() => window.location.href = '/sessions/new'}
          >
            <Mic className="w-4 h-4 mr-2" />
            Start Your First Session
          </Button>
        </div>
      </div>
    );
  }

  const sessions = sessionsData.data;
  const analytics = analyticsData;
  
  // Calculate overview stats from sessions
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, session) => {
    return sum + (session.duration || 0);
  }, 0);
  const avgScore = analytics?.overall_metrics ? 
    Object.values(analytics.overall_metrics).reduce((sum, metric: any) => sum + (metric.score || 0), 0) / 
    Object.keys(analytics.overall_metrics).length : 0;

  const renderMetricChart = (metrics: MultilangualMetrics) => {
    if (!metrics) return null;

    const metricEntries = Object.entries(metrics);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metricEntries.map(([key, metric]: [string, any]) => {
          if (!metric || typeof metric !== 'object') return null;
          
          return (
            <div key={key} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium capitalize text-slate-100">
                  {key.replace('_', ' ')}
                </h4>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-100">
                    {Math.round(metric.score || 0)}%
                  </div>
                  {metric.improvement && (
                    <div className={`flex items-center text-sm ${
                      metric.improvement > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.improvement > 0 ? 
                        <TrendingUp className="w-4 h-4 mr-1" /> : 
                        <TrendingDown className="w-4 h-4 mr-1" />
                      }
                      {Math.abs(metric.improvement)}%
                    </div>
                  )}
                </div>
              </div>
              
              {metric.details && (
                <div className="space-y-2">
                  {Object.entries(metric.details).map(([detailKey, detailValue]: [string, any]) => (
                    <div key={detailKey} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">
                        {detailKey.replace('_', ' ')}
                      </span>
                      <span className="text-slate-100">
                        {typeof detailValue === 'number' ? 
                          `${Math.round(detailValue)}${detailKey.includes('time') ? 's' : ''}` : 
                          detailValue
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {metric.score && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${metric.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Generate mock data for the MetricsDashboard from sessions
  const metricsData = sessions.slice(0, 30).map((session, index) => ({
    date: new Date(session.created_at).toISOString().split('T')[0],
    clarity: Math.floor(Math.random() * 30) + 70,
    pace: Math.floor(Math.random() * 25) + 75,
    volume: Math.floor(Math.random() * 20) + 80,
    engagement: Math.floor(Math.random() * 35) + 65,
    overall: Math.floor(Math.random() * 20) + 80,
  }));

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y') => {
    setTimeRange(range as any);
  };

  return (
    <div className="p-6 space-y-6">
      {/* MetricsDashboard Integration */}
      <MetricsDashboard
        data={metricsData}
        timeRange={timeRange === 'week' ? '7d' : timeRange === 'month' ? '30d' : timeRange === 'quarter' ? '90d' : '30d'}
        onTimeRangeChange={handleTimeRangeChange}
      />

      {/* Session History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">Recent Sessions</h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/sessions'}
          >
            View All Sessions
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600">Title</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600">Type</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600">Duration</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600">Status</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600">Language</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 10).map((session, index) => (
                <tr 
                  key={session.id} 
                  className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 cursor-pointer`}
                  onClick={() => window.location.href = `/sessions/${session.id}`}
                >
                  <td className="py-3 px-2 text-sm text-slate-100">
                    {new Date(session.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2 text-sm font-medium text-slate-100">
                    {session.title}
                  </td>
                  <td className="py-3 px-2">
                    <Badge variant="default" size="sm" className="capitalize">
                      {session.session_type}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    {session.duration ? `${Math.round(session.duration / 60)}min` : 'N/A'}
                  </td>
                  <td className="py-3 px-2">
                    <Badge 
                      variant={
                        session.status === 'completed' ? 'success' :
                        session.status === 'active' ? 'warning' :
                        session.status === 'paused' ? 'info' : 'default'
                      } 
                      size="sm"
                    >
                      {session.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600 uppercase">
                    {session.language}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recommendations */}
      {analytics?.recommendations && analytics.recommendations.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Recommendations</h2>
          <div className="space-y-3">
            {analytics.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">{rec.title}</p>
                  <p className="text-sm text-blue-700">{rec.description}</p>
                  {rec.priority && (
                    <Badge variant="info" size="sm" className="mt-2">
                      {rec.priority} priority
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;