.DEFAULT_GOAL := help
.PHONY: help install up down dev dev-web dev-api test test-web test-api lint lint-web lint-api typecheck clean

API_DIR := apps/api

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (web + api)
	pnpm install
	cd $(API_DIR) && uv sync

up: ## Start Postgres + Redis via docker-compose
	docker compose up -d

down: ## Stop docker-compose services
	docker compose down

dev: ## Run web + api in watch mode (needs two terminals; this runs both via &)
	@echo "Starting API on :8000 and web on :5173 ..."
	@$(MAKE) -j2 dev-api dev-web

dev-api: ## Run the FastAPI server (watch)
	cd $(API_DIR) && uv run uvicorn app.main:app --reload --port 8000

dev-web: ## Run the Vite dev server
	pnpm --filter @sudoku/web dev

test: test-web test-api ## Run all tests

test-web: ## Run web + engine unit tests
	pnpm -r --if-present test

test-api: ## Run Python tests
	cd $(API_DIR) && uv run pytest -q

lint: lint-web lint-api ## Lint all stacks

lint-web: ## ESLint + tsc for web + engine
	pnpm -r --if-present lint
	pnpm -r --if-present typecheck

lint-api: ## ruff + mypy for the API
	cd $(API_DIR) && uv run ruff check . && uv run mypy app

typecheck: ## Type-check TS packages
	pnpm -r --if-present typecheck

clean: ## Remove build + cache artifacts
	rm -rf node_modules apps/web/node_modules packages/*/node_modules apps/web/dist packages/*/dist
	rm -rf $(API_DIR)/.venv $(API_DIR)/.pytest_cache $(API_DIR)/.mypy_cache $(API_DIR)/.ruff_cache
