"""
Configuration de base de données pour AURA
Support PostgreSQL avec SQLAlchemy async
"""

import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import NullPool

from utils.logging import get_logger

logger = get_logger(__name__)

# Configuration de la base de données
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://aura_user:aura_password@localhost:5432/aura_db"
)

# Pour les tests, utiliser SQLite
if os.getenv("TESTING"):
    DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Créer le moteur de base de données
engine = create_async_engine(
    DATABASE_URL,
    poolclass=NullPool if "sqlite" in DATABASE_URL else None,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    future=True
)

# Session factory
async_session_maker = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Base pour les modèles
Base = declarative_base()

async def get_database():
    """Dependency pour obtenir une session de base de données"""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception as e:
            logger.error("Database session error", extra={"error": str(e)})
            await session.rollback()
            raise
        finally:
            await session.close()

async def create_tables():
    """Créer toutes les tables"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error("Failed to create database tables", error=str(e))
        raise

async def drop_tables():
    """Supprimer toutes les tables (pour les tests)"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logger.info("Database tables dropped successfully")
    except Exception as e:
        logger.error("Failed to drop database tables", error=str(e))
        raise

async def check_database_connection():
    """Vérifier la connexion à la base de données"""
    try:
        from sqlalchemy import text
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        logger.info("Database connection successful")
        return True
    except Exception as e:
        logger.error("Database connection failed", error=str(e))
        return False 