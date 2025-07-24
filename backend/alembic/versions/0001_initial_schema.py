"""Initial AURA database schema

Revision ID: 0001
Revises: 
Create Date: 2024-01-24 14:17:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial AURA database schema."""
    
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    
    # Create user_profiles table
    op.create_table('user_profiles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('first_name', sa.String(length=50), nullable=True),
        sa.Column('last_name', sa.String(length=50), nullable=True),
        sa.Column('language', sa.String(length=10), nullable=True, default='fr'),
        sa.Column('timezone', sa.String(length=50), nullable=True, default='UTC'),
        sa.Column('preferences', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create presentation_sessions table
    op.create_table('presentation_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, default='active'),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create feedback_items table
    op.create_table('feedback_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=True, default='info'),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('suggestions', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['presentation_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create analytics_events table
    op.create_table('analytics_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('event_data', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['presentation_sessions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_created_at', 'users', ['created_at'])
    
    op.create_index('ix_user_profiles_user_id', 'user_profiles', ['user_id'])
    
    op.create_index('ix_presentation_sessions_user_id', 'presentation_sessions', ['user_id'])
    op.create_index('ix_presentation_sessions_status', 'presentation_sessions', ['status'])
    op.create_index('ix_presentation_sessions_created_at', 'presentation_sessions', ['created_at'])
    
    op.create_index('ix_feedback_items_session_id', 'feedback_items', ['session_id'])
    op.create_index('ix_feedback_items_type', 'feedback_items', ['type'])
    op.create_index('ix_feedback_items_category', 'feedback_items', ['category'])
    op.create_index('ix_feedback_items_timestamp', 'feedback_items', ['timestamp'])
    
    op.create_index('ix_analytics_events_session_id', 'analytics_events', ['session_id'])
    op.create_index('ix_analytics_events_user_id', 'analytics_events', ['user_id'])
    op.create_index('ix_analytics_events_event_type', 'analytics_events', ['event_type'])
    op.create_index('ix_analytics_events_timestamp', 'analytics_events', ['timestamp'])


def downgrade() -> None:
    """Drop all tables and indexes."""
    
    # Drop indexes
    op.drop_index('ix_analytics_events_timestamp')
    op.drop_index('ix_analytics_events_event_type')
    op.drop_index('ix_analytics_events_user_id')
    op.drop_index('ix_analytics_events_session_id')
    
    op.drop_index('ix_feedback_items_timestamp')
    op.drop_index('ix_feedback_items_category')
    op.drop_index('ix_feedback_items_type')
    op.drop_index('ix_feedback_items_session_id')
    
    op.drop_index('ix_presentation_sessions_created_at')
    op.drop_index('ix_presentation_sessions_status')
    op.drop_index('ix_presentation_sessions_user_id')
    
    op.drop_index('ix_user_profiles_user_id')
    
    op.drop_index('ix_users_created_at')
    op.drop_index('ix_users_username')
    op.drop_index('ix_users_email')
    
    # Drop tables in reverse order (respecting foreign key constraints)
    op.drop_table('analytics_events')
    op.drop_table('feedback_items')
    op.drop_table('presentation_sessions')
    op.drop_table('user_profiles')
    op.drop_table('users')