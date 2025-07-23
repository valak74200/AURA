"""
Tests pour les endpoints d'authentification AURA.

Test tous les endpoints d'auth avec différents scénarios.
"""

import pytest
from fastapi.testclient import TestClient
from fastapi import status
from typing import Dict, Any


@pytest.mark.auth
def test_register_success(test_client: TestClient):
    """Test d'inscription réussie."""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    user_data = {
        "email": f"newuser{unique_id}@example.com",
        "username": f"newuser{unique_id}",
        "password": "newpassword123",
        "confirm_password": "newpassword123",
        "first_name": "New",
        "last_name": "User",
        "language": "fr"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "username" in data
    assert data["email"] == user_data["email"]
    assert data["username"] == user_data["username"]
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.auth
def test_register_duplicate_email(test_client: TestClient, test_user: Dict[str, Any]):
    """Test d'inscription avec email déjà utilisé."""
    user_data = {
        "email": test_user["email"],  # Email déjà utilisé
        "username": "differentuser",
        "password": "password123",
        "confirm_password": "password123",
        "first_name": "Different",
        "last_name": "User",
        "language": "fr"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    data = response.json()
    assert "email" in data["message"].lower()
    


@pytest.mark.auth
def test_register_duplicate_username(test_client: TestClient, test_user: Dict[str, Any]):
    """Test d'inscription avec nom d'utilisateur déjà utilisé."""
    user_data = {
        "email": "different@example.com",
        "username": test_user["username"],  # Username déjà utilisé
        "password": "password123",
        "confirm_password": "password123",
        "first_name": "Different",
        "last_name": "User",
        "language": "fr"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    data = response.json()
    assert "utilisateur" in data["message"].lower() or "username" in data["message"].lower()
    


@pytest.mark.auth
def test_register_password_mismatch(test_client: TestClient):
    """Test d'inscription avec mots de passe différents."""
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "password123",
        "confirm_password": "differentpassword",
        "first_name": "Test",
        "last_name": "User",
        "language": "fr"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    data = response.json()
    assert "mot de passe" in data["message"].lower() or "password" in data["message"].lower()
    


@pytest.mark.auth
def test_register_invalid_email(test_client: TestClient):
    """Test d'inscription avec email invalide."""
    user_data = {
        "email": "invalid-email",
        "username": "testuser",
        "password": "password123",
        "confirm_password": "password123",
        "first_name": "Test",
        "last_name": "User",
        "language": "fr"
    }
    
    response = test_client.post("/api/v1/auth/register", json=user_data)
    
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    


@pytest.mark.auth
def test_login_success(test_client: TestClient, test_user: Dict[str, Any]):
    """Test de connexion réussie avec email."""
    login_data = {
        "email_or_username": test_user["email"],
        "password": test_user["password"]
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "token_type" in data
    assert data["token_type"] == "bearer"
    assert "expires_in" in data
    assert "user" in data
    


@pytest.mark.auth
def test_login_with_username(test_client: TestClient, test_user: Dict[str, Any]):
    """Test de connexion réussie avec nom d'utilisateur."""
    login_data = {
        "email_or_username": test_user["username"],
        "password": test_user["password"]
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    


@pytest.mark.auth
def test_login_wrong_password(test_client: TestClient, test_user: Dict[str, Any]):
    """Test de connexion avec mauvais mot de passe."""
    login_data = {
        "email_or_username": test_user["email"],
        "password": "wrongpassword"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    data = response.json()
    assert "incorrect" in data["message"].lower()
    


@pytest.mark.auth
def test_login_nonexistent_user(test_client: TestClient):
    """Test de connexion avec utilisateur inexistant."""
    login_data = {
        "email_or_username": "nonexistent@example.com",
        "password": "password123"
    }
    
    response = test_client.post("/api/v1/auth/login", json=login_data)
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    


@pytest.mark.auth
def test_get_current_user_success(test_client: TestClient, auth_headers: Dict[str, str]):
    """Test de récupération du profil utilisateur authentifié."""
    response = test_client.get("/api/v1/auth/me", headers=auth_headers)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "username" in data
    assert "password" not in data
    assert "hashed_password" not in data
    


@pytest.mark.auth
def test_get_current_user_unauthorized(test_client: TestClient):
    """Test de récupération du profil sans authentification."""
    response = test_client.get("/api/v1/auth/me")
    
    assert response.status_code == status.HTTP_403_FORBIDDEN
    


@pytest.mark.auth
def test_get_current_user_invalid_token(test_client: TestClient):
    """Test de récupération du profil avec token invalide."""
    headers = {"Authorization": "Bearer invalid-token"}
    response = test_client.get("/api/v1/auth/me", headers=headers)
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    


@pytest.mark.auth
def test_update_profile_success(test_client: TestClient, auth_headers: Dict[str, str]):
    """Test de mise à jour du profil utilisateur."""
    update_data = {
        "first_name": "Updated",
        "last_name": "Name",
        "language": "en"
    }
    
    response = test_client.put("/api/v1/auth/me", json=update_data, headers=auth_headers)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["first_name"] == update_data["first_name"]
    assert data["last_name"] == update_data["last_name"]
    assert data["language"] == update_data["language"]
    


@pytest.mark.auth
def test_change_password_success(test_client: TestClient, auth_headers: Dict[str, str], test_user: Dict[str, Any]):
    """Test de changement de mot de passe réussi."""
    change_data = {
        "current_password": test_user["password"],
        "new_password": "newpassword123",
        "confirm_password": "newpassword123"
    }
    
    response = test_client.post("/api/v1/auth/change-password", json=change_data, headers=auth_headers)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "succès" in data["message"].lower()
    
    # Vérifier que l'ancien mot de passe ne fonctionne plus
    login_data = {
        "email_or_username": test_user["email"],
        "password": test_user["password"]
    }
    response = test_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Vérifier que le nouveau mot de passe fonctionne
    login_data["password"] = "newpassword123"
    response = test_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == status.HTTP_200_OK
    


@pytest.mark.auth
def test_change_password_wrong_current(test_client: TestClient, auth_headers: Dict[str, str]):
    """Test de changement de mot de passe avec ancien mot de passe incorrect."""
    change_data = {
        "current_password": "wrongpassword",
        "new_password": "newpassword123",
        "confirm_password": "newpassword123"
    }
    
    response = test_client.post("/api/v1/auth/change-password", json=change_data, headers=auth_headers)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    data = response.json()
    assert "succès" not in data["message"].lower()
    


@pytest.mark.auth
def test_change_password_mismatch(test_client: TestClient, auth_headers: Dict[str, str], test_user: Dict[str, Any]):
    """Test de changement de mot de passe avec confirmation différente."""
    change_data = {
        "current_password": test_user["password"],
        "new_password": "newpassword123",
        "confirm_password": "differentpassword"
    }
    
    response = test_client.post("/api/v1/auth/change-password", json=change_data, headers=auth_headers)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    data = response.json()
    assert "succès" not in data["message"].lower()
    


@pytest.mark.auth
def test_logout_success(test_client: TestClient, auth_headers: Dict[str, str]):
    """Test de déconnexion réussie."""
    response = test_client.post("/api/v1/auth/logout", headers=auth_headers)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "réussie" in data["message"].lower()
    


@pytest.mark.auth
def test_check_auth_success(test_client: TestClient, auth_headers: Dict[str, str]):
    """Test de vérification d'authentification réussie."""
    response = test_client.get("/api/v1/auth/check", headers=auth_headers)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "id" in data
    assert "email" in data
    assert "username" in data
    


@pytest.mark.auth
def test_check_auth_unauthorized(test_client: TestClient):
    """Test de vérification d'authentification non authentifié."""
    response = test_client.get("/api/v1/auth/check")
    
    assert response.status_code == status.HTTP_403_FORBIDDEN
    


@pytest.mark.auth
def test_check_availability_email_available(test_client: TestClient):
    """Test de vérification de disponibilité d'email disponible."""
    check_data = {"email": "available@example.com"}
    
    response = test_client.post("/api/v1/auth/check-availability", json=check_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["available"] is True
    


@pytest.mark.auth
def test_check_availability_email_taken(test_client: TestClient, test_user: Dict[str, Any]):
    """Test de vérification de disponibilité d'email déjà pris."""
    check_data = {"email": test_user["email"]}
    
    response = test_client.post("/api/v1/auth/check-availability", json=check_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["available"] is False
    


@pytest.mark.auth
def test_check_availability_username_available(test_client: TestClient):
    """Test de vérification de disponibilité de nom d'utilisateur disponible."""
    check_data = {"username": "availableuser"}
    
    response = test_client.post("/api/v1/auth/check-availability", json=check_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["available"] is True
    


@pytest.mark.auth
def test_check_availability_username_taken(test_client: TestClient, test_user: Dict[str, Any]):
    """Test de vérification de disponibilité de nom d'utilisateur déjà pris."""
    check_data = {"username": test_user["username"]}
    
    response = test_client.post("/api/v1/auth/check-availability", json=check_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["available"] is False
    


@pytest.mark.auth
def test_check_availability_both(test_client: TestClient):
    """Test de vérification de disponibilité d'email et nom d'utilisateur."""
    check_data = {
        "email": "available@example.com",
        "username": "availableuser"
    }
    
    response = test_client.post("/api/v1/auth/check-availability", json=check_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "available" in data
    assert "message" in data
    


@pytest.mark.auth
def test_check_availability_no_data(test_client: TestClient):
    """Test de vérification de disponibilité sans données."""
    response = test_client.post("/api/v1/auth/check-availability", json={})
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["available"] is True  # Sans données, pas de conflit donc disponible
