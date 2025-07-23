#!/usr/bin/env python3
"""
Script de configuration de base de données pour AURA
Configure PostgreSQL et initialise les tables
"""

import asyncio
import os
import sys
from pathlib import Path

# Ajouter le répertoire backend au path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import create_tables, drop_tables, check_database_connection
from models.user import User, UserProfile  # Import pour créer les tables
from models.session import PresentationSession  # Import pour créer les tables
import structlog

logger = structlog.get_logger(__name__)

async def setup_database():
    """Configuration complète de la base de données"""
    print("🗄️  Configuration de la base de données AURA")
    print("=" * 50)
    
    # 1. Vérifier la connexion
    print("\n1. Vérification de la connexion...")
    connected = await check_database_connection()
    
    if not connected:
        print("❌ Impossible de se connecter à la base de données")
        print("\n💡 Vérifiez que :")
        print("   - PostgreSQL est installé et démarré")
        print("   - La base de données 'aura_db' existe")
        print("   - L'utilisateur 'aura_user' existe avec les bons droits")
        print("   - Les paramètres DATABASE_URL dans .env sont corrects")
        
        print("\n🔧 Pour configurer PostgreSQL :")
        print("   sudo -u postgres psql")
        print("   CREATE DATABASE aura_db;")
        print("   CREATE USER aura_user WITH PASSWORD 'aura_password';")
        print("   GRANT ALL PRIVILEGES ON DATABASE aura_db TO aura_user;")
        print("   \\q")
        
        return False
    
    print("✅ Connexion à la base de données réussie")
    
    # 2. Créer les tables
    print("\n2. Création des tables...")
    try:
        await create_tables()
        print("✅ Tables créées avec succès")
    except Exception as e:
        print(f"❌ Erreur lors de la création des tables: {e}")
        return False
    
    print("\n🎉 Base de données configurée avec succès !")
    print("\n📊 Tables créées :")
    print("   - users (utilisateurs)")
    print("   - user_profiles (profils utilisateur)")
    print("   - presentation_sessions (sessions de présentation)")
    
    return True

async def reset_database():
    """Réinitialiser complètement la base de données"""
    print("🔄 Réinitialisation de la base de données AURA")
    print("=" * 50)
    
    response = input("\n⚠️  Êtes-vous sûr de vouloir supprimer toutes les données ? (oui/non): ")
    if response.lower() not in ['oui', 'yes', 'y']:
        print("Opération annulée")
        return False
    
    try:
        print("\n1. Suppression des tables existantes...")
        await drop_tables()
        print("✅ Tables supprimées")
        
        print("\n2. Recréation des tables...")
        await create_tables()
        print("✅ Tables recréées")
        
        print("\n🎉 Base de données réinitialisée avec succès !")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors de la réinitialisation: {e}")
        return False

async def check_status():
    """Vérifier le statut de la base de données"""
    print("📊 Statut de la base de données AURA")
    print("=" * 50)
    
    # Vérifier la connexion
    connected = await check_database_connection()
    if connected:
        print("✅ Base de données: Connectée")
        
        # Vérifier les tables (basique)
        try:
            from app.database import async_session_maker
            from sqlalchemy import text
            
            async with async_session_maker() as session:
                # Compter les utilisateurs
                result = await session.execute(text("SELECT COUNT(*) FROM users"))
                user_count = result.scalar()
                print(f"👤 Utilisateurs: {user_count}")
                
                # Compter les sessions
                result = await session.execute(text("SELECT COUNT(*) FROM presentation_sessions"))
                session_count = result.scalar()
                print(f"🎯 Sessions: {session_count}")
                
        except Exception as e:
            print(f"⚠️  Erreur lors de la vérification des tables: {e}")
    else:
        print("❌ Base de données: Non connectée")

def print_help():
    """Afficher l'aide"""
    print("🛠️  Script de configuration de base de données AURA")
    print("=" * 50)
    print("\nCommandes disponibles:")
    print("  setup    - Configurer la base de données (première fois)")
    print("  reset    - Réinitialiser complètement la base de données")
    print("  status   - Vérifier le statut de la base de données")
    print("  help     - Afficher cette aide")
    print("\nExemples:")
    print("  python setup_database.py setup")
    print("  python setup_database.py status")

async def main():
    """Fonction principale"""
    if len(sys.argv) < 2:
        print_help()
        return
    
    command = sys.argv[1].lower()
    
    if command == "setup":
        success = await setup_database()
        sys.exit(0 if success else 1)
        
    elif command == "reset":
        success = await reset_database()
        sys.exit(0 if success else 1)
        
    elif command == "status":
        await check_status()
        
    elif command == "help":
        print_help()
        
    else:
        print(f"❌ Commande inconnue: {command}")
        print_help()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 