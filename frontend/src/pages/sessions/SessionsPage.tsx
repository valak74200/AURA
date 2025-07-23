import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Mic, 
  Calendar,
  Clock,
  MoreVertical,
  Play,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { useSessions, useDeleteSession } from '../../hooks/useSession';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Input, Card, Badge, LoadingSpinner } from '../../components/ui';
import type { SessionStatus, SessionType, SessionsQuery } from '../../types';

const SessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'title' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const deleteSessionMutation = useDeleteSession();

  // Build query based on filters
  const query: SessionsQuery = {
    limit: 50,
    sort_by: sortBy,
    sort_order: sortOrder
  };

  if (statusFilter !== 'all') {
    query.status = statusFilter;
  }

  const { data: sessions, isLoading, error } = useSessions(query);

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  const getSessionTypeIcon = (type: SessionType) => {
    switch (type) {
      case 'presentation': return '🎤';
      case 'conversation': return '💬';
      case 'pronunciation': return '🗣️';
      case 'reading': return '📖';
      default: return '🎯';
    }
  };

  const filteredSessions = sessions?.data?.filter(session => 
    searchTerm === '' || 
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.session_type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      try {
        await deleteSessionMutation.mutateAsync(sessionId);
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading your sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">Failed to load sessions</p>
            <p className="text-sm mt-2">{(error as any)?.message || 'Please try again later'}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My Sessions</h1>
          <p className="text-gray-600 mt-1">
            {sessions?.total || 0} session{(sessions?.total || 0) !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button 
          variant="primary"
          onClick={() => navigate('/sessions/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search sessions by title or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SessionStatus | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="created">Created</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as 'created_at' | 'title' | 'status');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>

            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Sessions Grid */}
      {filteredSessions.length > 0 ? (
        <div className="grid gap-4">
          {filteredSessions.map((session) => (
            <Card 
              key={session.id} 
              className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
              onClick={() => navigate(`/sessions/${session.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-accent-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getSessionTypeIcon(session.session_type)}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-slate-100 truncate">{session.title}</h3>
                      <Badge variant={getStatusColor(session.status)} size="sm">
                        {session.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="capitalize">{session.session_type}</span>
                      <span className="uppercase font-medium">{session.language}</span>
                      {session.duration && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{Math.round(session.duration / 60)}min</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(session.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                    
                    {session.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {session.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Menu */}
                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  {session.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/sessions/${session.id}`)}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => console.log('Edit session:', session.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSession(session.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    disabled={deleteSessionMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        // Empty State
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="w-12 h-12 text-gray-400" />
            </div>
            
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'No sessions found' 
                : 'No sessions yet'
              }
            </h3>
            
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filters to find what you\'re looking for.'
                : 'Create your first speech coaching session to get started with AURA.'
              }
            </p>
            
            <div className="flex justify-center space-x-3">
              {(searchTerm || statusFilter !== 'all') && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
              
              <Button 
                variant="primary"
                onClick={() => navigate('/sessions/new')}
              >
                <Plus className="w-4 h-4 mr-2" />
                {sessions?.total === 0 ? 'Create Your First Session' : 'New Session'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {sessions && sessions.total > sessions.limit && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {Math.min(sessions.limit, sessions.total)} of {sessions.total} sessions
            </p>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SessionsPage;