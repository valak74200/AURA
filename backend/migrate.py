#!/usr/bin/env python3
"""
AURA Database Migration Management Script

Provides convenient commands for managing database migrations with Alembic.
"""

import asyncio
import sys
import os
from pathlib import Path
from typing import Optional

import click
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.database import check_database_connection
from utils.logging import get_logger, setup_logging

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Get the directory containing this script
SCRIPT_DIR = Path(__file__).parent
ALEMBIC_CFG_PATH = SCRIPT_DIR / "alembic.ini"


def get_alembic_config() -> Config:
    """Get Alembic configuration."""
    config = Config(str(ALEMBIC_CFG_PATH))
    settings = get_settings()
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


@click.group()
def cli():
    """AURA Database Migration Management."""
    pass


@cli.command()
@click.option('--message', '-m', required=True, help='Migration message')
@click.option('--autogenerate/--no-autogenerate', default=True, help='Auto-generate migration from model changes')
def create(message: str, autogenerate: bool):
    """Create a new migration."""
    try:
        config = get_alembic_config()
        
        if autogenerate:
            logger.info(f"Creating auto-generated migration: {message}")
            command.revision(config, message=message, autogenerate=True)
        else:
            logger.info(f"Creating empty migration: {message}")
            command.revision(config, message=message)
        
        logger.info("Migration created successfully")
        
    except Exception as e:
        logger.error(f"Failed to create migration: {e}")
        sys.exit(1)


@cli.command()
@click.option('--revision', '-r', default='head', help='Target revision (default: head)')
@click.option('--sql', is_flag=True, help='Generate SQL instead of running migration')
def upgrade(revision: str, sql: bool):
    """Upgrade database to a revision."""
    try:
        config = get_alembic_config()
        
        if sql:
            logger.info(f"Generating SQL for upgrade to {revision}")
            command.upgrade(config, revision, sql=True)
        else:
            logger.info(f"Upgrading database to {revision}")
            command.upgrade(config, revision)
            logger.info("Database upgraded successfully")
        
    except Exception as e:
        logger.error(f"Failed to upgrade database: {e}")
        sys.exit(1)


@cli.command()
@click.option('--revision', '-r', required=True, help='Target revision')
@click.option('--sql', is_flag=True, help='Generate SQL instead of running migration')
def downgrade(revision: str, sql: bool):
    """Downgrade database to a revision."""
    try:
        config = get_alembic_config()
        
        if sql:
            logger.info(f"Generating SQL for downgrade to {revision}")
            command.downgrade(config, revision, sql=True)
        else:
            logger.info(f"Downgrading database to {revision}")
            command.downgrade(config, revision)
            logger.info("Database downgraded successfully")
        
    except Exception as e:
        logger.error(f"Failed to downgrade database: {e}")
        sys.exit(1)


@cli.command()
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
def current(verbose: bool):
    """Show current revision."""
    try:
        config = get_alembic_config()
        command.current(config, verbose=verbose)
        
    except Exception as e:
        logger.error(f"Failed to get current revision: {e}")
        sys.exit(1)


@cli.command()
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
def history(verbose: bool):
    """Show migration history."""
    try:
        config = get_alembic_config()
        command.history(config, verbose=verbose)
        
    except Exception as e:
        logger.error(f"Failed to get migration history: {e}")
        sys.exit(1)


@cli.command()
@click.option('--revision', '-r', default='head', help='Target revision (default: head)')
def show(revision: str):
    """Show a specific revision."""
    try:
        config = get_alembic_config()
        command.show(config, revision)
        
    except Exception as e:
        logger.error(f"Failed to show revision: {e}")
        sys.exit(1)


@cli.command()
def check():
    """Check database connection and migration status."""
    async def _check():
        try:
            settings = get_settings()
            logger.info(f"Checking database connection: {settings.database_url}")
            
            # Check database connection
            is_connected = await check_database_connection()
            if not is_connected:
                logger.error("Database connection failed")
                return False
            
            logger.info("✓ Database connection successful")
            
            # Check current migration status
            config = get_alembic_config()
            logger.info("Current migration status:")
            command.current(config, verbose=True)
            
            return True
            
        except Exception as e:
            logger.error(f"Database check failed: {e}")
            return False
    
    success = asyncio.run(_check())
    if not success:
        sys.exit(1)


@cli.command()
@click.confirmation_option(prompt='Are you sure you want to reset the database?')
def reset():
    """Reset database (drop all tables and run migrations)."""
    async def _reset():
        try:
            settings = get_settings()
            logger.warning("Resetting database - this will drop all data!")
            
            # Create engine
            engine = create_async_engine(settings.database_url)
            
            async with engine.begin() as conn:
                # Drop all tables
                logger.info("Dropping all tables...")
                await conn.run_sync(lambda sync_conn: sync_conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")))
                logger.info("All tables dropped")
            
            await engine.dispose()
            
            # Run migrations
            logger.info("Running migrations...")
            config = get_alembic_config()
            command.upgrade(config, "head")
            logger.info("Database reset completed successfully")
            
        except Exception as e:
            logger.error(f"Database reset failed: {e}")
            raise
    
    try:
        asyncio.run(_reset())
    except Exception:
        sys.exit(1)


@cli.command()
def init():
    """Initialize Alembic in an existing project (if not already initialized)."""
    try:
        if ALEMBIC_CFG_PATH.exists():
            logger.info("Alembic already initialized")
            return
        
        logger.info("Initializing Alembic...")
        command.init(get_alembic_config(), str(SCRIPT_DIR / "alembic"))
        logger.info("Alembic initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize Alembic: {e}")
        sys.exit(1)


@cli.command()
def stamp():
    """Stamp database with current head revision (for existing databases)."""
    try:
        config = get_alembic_config()
        logger.info("Stamping database with head revision...")
        command.stamp(config, "head")
        logger.info("Database stamped successfully")
        
    except Exception as e:
        logger.error(f"Failed to stamp database: {e}")
        sys.exit(1)


@cli.command()
@click.option('--revision', '-r', default='head', help='Target revision (default: head)')
def validate(revision: str):
    """Validate migration scripts."""
    try:
        config = get_alembic_config()
        logger.info(f"Validating migrations up to {revision}...")
        
        # This would run a dry-run validation
        # For now, we'll just check if the revision exists
        command.show(config, revision)
        logger.info("Migration validation completed")
        
    except Exception as e:
        logger.error(f"Migration validation failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    cli()