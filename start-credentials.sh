#!/bin/bash
# Arranca el FidelyFood Access Center (solo localhost).
set -e
cd "$(dirname "$0")/access-center"
if [ ! -d node_modules ]; then
  npm install
fi
node server.js
