#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== AI Governance Platform — First-Time Deploy (with seed) ==="

# Run the standard deploy first
bash scripts/deploy.sh

echo ""
echo "Running database seed..."
docker compose -f docker-compose.prod.yml --profile init up seed

echo ""
echo "=== First-Time Deploy Complete ==="
echo "Web UI:  http://localhost"
echo "API:     http://localhost/api/v1/health"
echo ""
echo "Demo data has been seeded. For subsequent deploys, use:"
echo "  ./scripts/deploy.sh"
