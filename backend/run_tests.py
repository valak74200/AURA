#!/usr/bin/env python3
"""
Script de lancement des tests AURA avec différentes options.

Usage:
    python run_tests.py --all                    # Tous les tests
    python run_tests.py --integration           # Tests d'intégration seulement
    python run_tests.py --unit                  # Tests unitaires seulement
    python run_tests.py --coverage              # Avec rapport de couverture
    python run_tests.py --fast                  # Tests rapides seulement
    python run_tests.py --real-services         # Tests avec vrais services externes
    python run_tests.py --external-apis         # Tests avec vraies APIs externes (Gemini, etc.)
"""

import argparse
import subprocess
import sys
import os
from pathlib import Path


def run_command(cmd, description=""):
    """Execute une commande et affiche le résultat."""
    print(f"\n🚀 {description}")
    print(f"Commande: {' '.join(cmd)}")
    print("-" * 50)
    
    result = subprocess.run(cmd, capture_output=False)
    
    if result.returncode == 0:
        print(f"✅ {description} - SUCCÈS")
    else:
        print(f"❌ {description} - ÉCHEC (code: {result.returncode})")
    
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Lancer les tests AURA")
    parser.add_argument("--all", action="store_true", help="Lancer tous les tests")
    parser.add_argument("--integration", action="store_true", help="Tests d'intégration seulement")
    parser.add_argument("--unit", action="store_true", help="Tests unitaires seulement")
    parser.add_argument("--e2e", action="store_true", help="Tests end-to-end seulement")
    parser.add_argument("--coverage", action="store_true", help="Générer rapport de couverture")
    parser.add_argument("--fast", action="store_true", help="Tests rapides seulement")
    parser.add_argument("--real-services", action="store_true", help="Tests avec vrais services")
    parser.add_argument("--external-apis", action="store_true", help="Tests avec vraies APIs externes (Gemini, etc.)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Mode verbeux")
    parser.add_argument("--parallel", "-n", type=int, help="Nombre de processus parallèles")
    
    args = parser.parse_args()
    
    # Configuration de base
    base_cmd = ["python", "-m", "pytest"]
    
    if args.verbose:
        base_cmd.append("-v")
    
    if args.parallel:
        base_cmd.extend(["-n", str(args.parallel)])
    
    # Vérifier que nous sommes dans le bon répertoire
    if not Path("tests").exists():
        print("❌ Erreur: Répertoire 'tests' non trouvé. Lancez depuis le répertoire backend/")
        sys.exit(1)
    
    # Vérifier les variables d'environnement pour les tests avec vrais services
    if args.real_services:
        required_env = ["GEMINI_API_KEY", "DATABASE_URL"]
        missing_env = [env for env in required_env if not os.getenv(env)]
        
        if missing_env:
            print(f"❌ Variables d'environnement manquantes pour les tests réels: {missing_env}")
            print("Configurez votre fichier .env ou exportez ces variables.")
            sys.exit(1)
    
    success = True
    
    if args.all or (not any([args.integration, args.unit, args.e2e, args.fast])):
        # Lancer tous les tests
        cmd = base_cmd + ["tests/"]
        if args.coverage:
            cmd.extend(["--cov-report=html", "--cov-report=term"])
        success &= run_command(cmd, "Tous les tests")
    
    elif args.unit:
        # Tests unitaires seulement
        cmd = base_cmd + ["-m", "unit", "tests/"]
        success &= run_command(cmd, "Tests unitaires")
    
    elif args.integration:
        # Tests d'intégration
        cmd = base_cmd + ["-m", "integration", "tests/integration/"]
        if args.coverage:
            cmd.extend(["--cov-report=html"])
        success &= run_command(cmd, "Tests d'intégration")
    
    elif args.e2e:
        # Tests end-to-end
        cmd = base_cmd + ["-m", "e2e", "tests/e2e/"]
        success &= run_command(cmd, "Tests end-to-end")
    
    elif args.fast:
        # Tests rapides seulement
        cmd = base_cmd + ["-m", "not slow", "tests/"]
        success &= run_command(cmd, "Tests rapides")
    
    if args.real_services:
        # Tests avec vrais services externes
        print("\n🌐 Lancement des tests avec vrais services externes...")
        cmd = base_cmd + ["-m", "real_services", "tests/"]
        success &= run_command(cmd, "Tests avec vrais services")
    
    if args.external_apis:
        # Tests avec vraies APIs externes (nécessitent des clés API)
        print("\n🚀 Lancement des tests avec vraies APIs externes...")
        print("⚠️  ATTENTION: Ces tests consomment des quotas API réels !")
        
        # Vérifier les variables d'environnement
        required_env = ["GEMINI_API_KEY"]
        missing_env = [env for env in required_env if not os.getenv(env)]
        
        if missing_env:
            print(f"❌ Variables d'environnement manquantes: {missing_env}")
            print("Configurez votre fichier .env ou exportez ces variables.")
            print("Exemple: export GEMINI_API_KEY='votre_clé_api'")
            return False
        
        cmd = base_cmd + ["-m", "real_services", "tests/integration/test_real_external_apis.py"]
        if args.coverage:
            cmd.extend(["--cov-report=html"])
        success &= run_command(cmd, "Tests avec vraies APIs externes")
    
    # Rapport final
    print("\n" + "="*60)
    if success:
        print("🎉 TOUS LES TESTS ONT RÉUSSI!")
        if args.coverage:
            print("📊 Rapport de couverture généré dans htmlcov/index.html")
    else:
        print("💥 CERTAINS TESTS ONT ÉCHOUÉ!")
        sys.exit(1)
    
    print("="*60)


if __name__ == "__main__":
    main()