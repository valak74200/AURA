#!/bin/bash

echo "=== 1️⃣ Vérification de Docker et Buildx ==="
docker --version || { echo "❌ Docker n'est pas installé dans WSL."; exit 1; }

if ! docker buildx version &>/dev/null; then
    echo "⚠️ docker-buildx non trouvé, installation..."
    mkdir -p ~/.docker/cli-plugins/
    LATEST_VERSION="v0.17.1"
    curl -SL "https://github.com/docker/buildx/releases/download/$LATEST_VERSION/buildx-$LATEST_VERSION.linux-amd64" \
        -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
    echo "✅ docker-buildx installé."
else
    echo "✅ docker-buildx déjà installé."
fi

echo
echo "=== 2️⃣ Espace disque Docker AVANT nettoyage ==="
docker system df

echo
echo "=== 3️⃣ Nettoyage des images et caches inutilisés (sans toucher aux volumes) ==="
docker image prune -af
docker builder prune -af || DOCKER_BUILDKIT=0 docker builder prune -af

echo
echo "=== 4️⃣ Espace disque Docker APRÈS nettoyage ==="
docker system df

echo
echo "✅ Nettoyage terminé !"
echo "Pour libérer l'espace disque côté Windows, exécute ensuite : wsl --shutdown puis Optimize-VHD."
