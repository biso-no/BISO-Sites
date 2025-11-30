#!/bin/bash
# A simple script to copy dependencies hoisted to the monorepo root
set -e

# Target directory for the final artifact's node_modules
TARGET_DIR="./deploy/dist/node_modules"

# Get a list of dependencies from package.json (simplified approach)
# WARNING: This simple grep/cut might miss devDependencies or specific formats. 
# It's safest to manually list packages if the next step fails.
DEPS=$(grep -E '("dependencies"|"devDependencies")' ./package.json -A 50 | grep -E '":\s*"' | cut -d'"' -f 2)

echo "Copying hoisted dependencies to ${TARGET_DIR}..."

# Loop through each dependency
for PKG in $DEPS; do
    # Path to the hoisted package
    SOURCE_PATH="../../node_modules/${PKG}"
    # Path to copy the package into the artifact
    DEST_PATH="${TARGET_DIR}/${PKG}"

    # Check if the package exists at the hoisted root
    if [ -d "${SOURCE_PATH}" ]; then
        echo "  - Copying hoisted package: ${PKG}"
        mkdir -p "${DEST_PATH}"
        cp -r "${SOURCE_PATH}" "${TARGET_DIR}/"
    fi
done

echo "Hoisted dependency copying complete."