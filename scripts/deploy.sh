#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== AI Governance Platform — Production Deploy ==="

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Install Docker first."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "ERROR: Docker Compose V2 is required."
  exit 1
fi

# Create .env.production if missing
if [ ! -f .env.production ]; then
  echo "Creating .env.production from template..."
  cp .env.production.example .env.production

  # Auto-generate secrets
  GENERATED_PG_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  GENERATED_JWT=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

  sed -i "s/CHANGE_ME_STRONG_PASSWORD/${GENERATED_PG_PASS}/g" .env.production
  sed -i "s/CHANGE_ME_RANDOM_SECRET_AT_LEAST_32_CHARS/${GENERATED_JWT}/g" .env.production

  echo "Generated .env.production with random secrets."
  echo "Review it before continuing: cat .env.production"
fi

echo ""
echo "Building and starting services..."
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for services to become healthy..."
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
    API_HEALTHY=$(docker compose -f docker-compose.prod.yml ps api --format '{{.Health}}' 2>/dev/null || echo "unknown")
    if [ "$API_HEALTHY" = "healthy" ]; then
      echo "All services are healthy!"
      break
    fi
  fi
  sleep 2
  echo "  Waiting... ($i/60)"
done

echo ""
echo "=== Deployment Complete ==="
echo "Web UI:  http://localhost"
echo "API:     http://localhost/api/v1/health"
echo ""
echo "View logs:  docker compose -f docker-compose.prod.yml logs -f"
echo "Stop:       docker compose -f docker-compose.prod.yml down"
