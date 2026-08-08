#!/bin/bash
# ============================================================================
# Charms CLI Installation Script
# ============================================================================
#
# Builds and installs Charms CLI v15.0.0 from source.
# Required for BABTC token minting on Bitcoin.
#
# The official cargo install may fail due to SP1 zkVM dependencies.
# This script builds without the prover feature to avoid those issues.
#
# Usage:
#   ./scripts/install-charms-cli.sh
#
# Requirements:
#   - Rust toolchain (cargo)
#   - Git
#
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Configuration
CHARMS_REPO="https://github.com/CharmsDev/charms.git"
CHARMS_TAG="v15.0.0"
BUILD_DIR="/tmp/charms-build-$$"
MIN_VERSION="15.0.0"

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v cargo &> /dev/null; then
        error "Rust/Cargo not found. Install from https://rustup.rs/"
    fi

    if ! command -v git &> /dev/null; then
        error "Git not found. Please install git."
    fi

    success "Prerequisites satisfied"
}

# Check current version
check_current_version() {
    if command -v charms &> /dev/null; then
        local current_version=$(charms --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        if [ -n "$current_version" ]; then
            log "Current Charms CLI version: $current_version"

            # Simple version comparison (assumes x.y.z format)
            if [ "$(printf '%s\n' "$MIN_VERSION" "$current_version" | sort -V | head -1)" = "$MIN_VERSION" ] && \
               [ "$current_version" != "$MIN_VERSION" ]; then
                success "Charms CLI v$current_version is already installed and up to date"
                echo ""
                echo "To reinstall anyway, run:"
                echo "  FORCE_INSTALL=1 $0"
                echo ""
                if [ "${FORCE_INSTALL:-0}" != "1" ]; then
                    exit 0
                fi
            fi
        fi
    else
        log "Charms CLI not found, will install"
    fi
}

# Clone repository
clone_repo() {
    log "Cloning Charms repository to $BUILD_DIR..."

    # Clean up any existing build directory
    rm -rf "$BUILD_DIR"

    # Fetch full history so we can checkout the specific pinned tag.
    # (A --depth 1 shallow clone only fetches the default branch tip and
    # cannot checkout arbitrary tags like $CHARMS_TAG.)
    git clone "$CHARMS_REPO" "$BUILD_DIR"

    pushd "$BUILD_DIR" > /dev/null
    log "Checking out tag $CHARMS_TAG..."
    git checkout "$CHARMS_TAG"
    popd > /dev/null

    success "Repository cloned at $CHARMS_TAG"
}

# Build CLI
build_cli() {
    log "Building Charms CLI (this may take a few minutes)..."

    pushd "$BUILD_DIR" > /dev/null

    # Build without prover feature to avoid SP1 dependency issues
    # Use test profile for faster builds
    cargo build --profile=test 2>&1 | while IFS= read -r line; do
        # Show progress dots for long builds
        if [[ "$line" == *"Compiling"* ]]; then
            echo -n "."
        fi
    done
    echo ""

    success "Build completed"

    popd > /dev/null
}

# Install CLI
install_cli() {
    log "Installing Charms CLI..."

    pushd "$BUILD_DIR" > /dev/null

    cargo install --profile=test --path . --locked 2>&1 | tail -5

    popd > /dev/null

    success "Installation completed"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."

    if ! command -v charms &> /dev/null; then
        error "Charms CLI not found in PATH after installation"
    fi

    local installed_version=$(charms --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

    if [ -z "$installed_version" ]; then
        error "Could not determine installed version"
    fi

    success "Charms CLI v$installed_version installed successfully"

    echo ""
    echo "============================================"
    echo "Charms CLI is ready to use!"
    echo ""
    echo "Quick commands:"
    echo "  charms --help                    # Show help"
    echo "  charms spell check --spell=...  # Validate a spell"
    echo "  charms util dest --addr=...     # Get scriptPubKey hex"
    echo "============================================"
}

# Cleanup
cleanup() {
    log "Cleaning up..."
    rm -rf "$BUILD_DIR"
    success "Cleanup completed"
}

# Main
main() {
    echo ""
    echo "============================================"
    echo "Charms CLI Installation Script"
    echo "============================================"
    echo ""

    check_prerequisites
    check_current_version
    clone_repo
    build_cli
    install_cli
    verify_installation
    cleanup

    echo ""
}

# Run main
main "$@"
