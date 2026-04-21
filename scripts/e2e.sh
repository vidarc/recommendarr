#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/scripts/docker-compose.yml"

cleanup() {
	echo "Stopping e2e containers..."
	docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

echo "Building Docker image..."
docker build "$PROJECT_DIR" -t recommendarr:e2e

exit_code=0

# Run each browser project with a fresh container so each gets a clean database
for project in chromium firefox webkit; do
	echo ""
	echo "=== Running e2e tests: $project ==="
	echo ""

	docker compose -f "$COMPOSE_FILE" up -d --wait --build
	cd "$PROJECT_DIR"

	if ! yarn playwright test --project="$project" "$@"; then
		exit_code=1
	fi

	docker compose -f "$COMPOSE_FILE" down --volumes
done

exit "$exit_code"
