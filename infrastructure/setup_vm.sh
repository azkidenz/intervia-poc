#!/bin/bash

# ==============================================================================
# SETUP SCRIPT FOR INTERVIA NODE
# ==============================================================================
# This script prepares a clean Ubuntu VM to host the blockchain node.
# It creates the 'intervia' directory structure and placeholder keys.
# ==============================================================================

# 1. VARIABLE DEFINITIONS
PROJECT_DIR="$HOME/intervia"
DATA_DIR="$PROJECT_DIR/data"
CONFIG_DIR="$PROJECT_DIR/config"

echo "[INFO] Starting VM configuration..."

# 2. SYSTEM UPDATE AND DOCKER INSTALLATION
echo "[INFO] Updating system and installing Docker..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release

if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add current user to the docker group
    sudo usermod -aG docker $USER
    echo "[OK] Docker installed."
else
    echo "[SKIP] Docker is already installed."
fi

# 3. FIREWALL CONFIGURATION (UFW)
echo "[INFO] Configuring Firewall ports..."
# Ensure UFW is installed
sudo apt-get install -y ufw

# Essential Ports
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 30303/tcp comment 'Geth P2P TCP'
sudo ufw allow 30303/udp comment 'Geth P2P UDP'
sudo ufw allow 8545/tcp comment 'Geth RPC HTTP'
sudo ufw allow 8546/tcp comment 'Geth RPC WebSocket'

# Enable firewall (requires non-interactive confirmation)
echo "y" | sudo ufw enable
echo "[OK] Firewall configured."

# 4. DIRECTORY STRUCTURE CREATION
echo "[INFO] Creating project folder: $PROJECT_DIR..."
mkdir -p "$DATA_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR/keystore" 

# 6. GENERATION OF SAMPLE KEYS
# WARNING: These keys are for structural example only.
echo "[INFO] Creating sample key files..."

echo "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890" > "$DATA_DIR/key"

echo "0x1234567890123456789012345678901234567890" > "$DATA_DIR/key.pub"


# Set proper permissions (only user can read private key files)
chmod 600 "$DATA_DIR/key"
chmod 600 "$DATA_DIR/keystore/"*

echo "----------------------------------------------------------------"
echo "SETUP COMPLETE!"
echo "----------------------------------------------------------------"