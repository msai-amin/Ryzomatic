# AI Reader Assistant - Makefile

.PHONY: help build up down logs clean dev prod test lint

# Default target
help:
	@echo "AI Reader Assistant - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  dev          Start development environment"
	@echo "  dev-build    Build development images"
	@echo "  dev-logs     Show development logs"
	@echo "  dev-clean    Clean development environment"
	@echo ""
	@echo "Production:"
	@echo "  prod         Start production environment"
	@echo "  prod-build   Build production images"
	@echo "  prod-logs    Show production logs"
	@echo "  prod-clean   Clean production environment"
	@echo ""
	@echo "General:"
	@echo "  build        Build all services"
	@echo "  up           Start all services"
	@echo "  down         Stop all services"
	@echo "  logs         Show logs for all services"
	@echo "  clean        Clean all containers and volumes"
	@echo "  test         Run tests"
	@echo "  lint         Run linting"
	@echo "  install      Install dependencies for all services"
	@echo ""

# Development environment
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Development environment started!"
	@echo "API Gateway: http://localhost:3000"
	@echo "API Docs: http://localhost:3000/api/docs"

dev-build:
	@echo "Building development images..."
	docker-compose -f docker-compose.dev.yml build

dev-logs:
	@echo "Showing development logs..."
	docker-compose -f docker-compose.dev.yml logs -f

dev-clean:
	@echo "Cleaning development environment..."
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f

# Production environment
prod:
	@echo "Starting production environment..."
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production environment started!"
	@echo "API Gateway: http://localhost:3000"
	@echo "API Docs: http://localhost:3000/api/docs"

prod-build:
	@echo "Building production images..."
	docker-compose -f docker-compose.prod.yml build

prod-logs:
	@echo "Showing production logs..."
	docker-compose -f docker-compose.prod.yml logs -f

prod-clean:
	@echo "Cleaning production environment..."
	docker-compose -f docker-compose.prod.yml down -v
	docker system prune -f

# General commands
build:
	@echo "Building all services..."
	docker-compose build

up:
	@echo "Starting all services..."
	docker-compose up -d

down:
	@echo "Stopping all services..."
	docker-compose down

logs:
	@echo "Showing logs for all services..."
	docker-compose logs -f

clean:
	@echo "Cleaning all containers and volumes..."
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

# Service-specific commands
build-docs:
	@echo "Building document processing service..."
	docker-compose build document-processing

build-chat:
	@echo "Building chat API service..."
	docker-compose build chat-api

build-files:
	@echo "Building file storage service..."
	docker-compose build file-storage

build-ai:
	@echo "Building AI integration service..."
	docker-compose build ai-integration

build-vectors:
	@echo "Building vector database service..."
	docker-compose build vector-db

build-gateway:
	@echo "Building API gateway service..."
	docker-compose build api-gateway

# Database commands
db-shell:
	@echo "Connecting to MongoDB shell..."
	docker-compose exec mongodb mongosh

redis-cli:
	@echo "Connecting to Redis CLI..."
	docker-compose exec redis redis-cli

# Testing
test:
	@echo "Running tests..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Testing $$service..."; \
			cd $$service && npm test && cd ../..; \
		fi; \
	done

test-docs:
	@echo "Testing document processing service..."
	cd services/document-processing && npm test

test-chat:
	@echo "Testing chat API service..."
	cd services/chat-api && npm test

test-files:
	@echo "Testing file storage service..."
	cd services/file-storage && npm test

test-ai:
	@echo "Testing AI integration service..."
	cd services/ai-integration && python -m pytest

test-vectors:
	@echo "Testing vector database service..."
	cd services/vector-db && python -m pytest

# Linting
lint:
	@echo "Running linting..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Linting $$service..."; \
			cd $$service && npm run lint && cd ../..; \
		fi; \
	done

# Installation
install:
	@echo "Installing dependencies for all services..."
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Installing dependencies for $$service..."; \
			cd $$service && npm install && cd ../..; \
		elif [ -f "$$service/requirements.txt" ]; then \
			echo "Installing Python dependencies for $$service..."; \
			cd $$service && pip install -r requirements.txt && cd ../..; \
		fi; \
	done

# Health checks
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health | jq .
	@curl -s http://localhost:3000/health/services | jq .

# Backup and restore
backup:
	@echo "Creating backup..."
	mkdir -p backups
	docker-compose exec mongodb mongodump --out /backup
	docker cp $$(docker-compose ps -q mongodb):/backup ./backups/mongodb-$$(date +%Y%m%d-%H%M%S)

restore:
	@echo "Restoring from backup..."
	@echo "Usage: make restore BACKUP_PATH=backups/mongodb-YYYYMMDD-HHMMSS"
	@if [ -z "$(BACKUP_PATH)" ]; then echo "Please specify BACKUP_PATH"; exit 1; fi
	docker cp $(BACKUP_PATH) $$(docker-compose ps -q mongodb):/backup
	docker-compose exec mongodb mongorestore /backup

# Monitoring
monitor:
	@echo "Starting monitoring..."
	docker stats

# Logs for specific services
logs-docs:
	docker-compose logs -f document-processing

logs-chat:
	docker-compose logs -f chat-api

logs-files:
	docker-compose logs -f file-storage

logs-ai:
	docker-compose logs -f ai-integration

logs-vectors:
	docker-compose logs -f vector-db

logs-gateway:
	docker-compose logs -f api-gateway

# Environment setup
setup:
	@echo "Setting up development environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file from .env.example"; \
		echo "Please edit .env with your configuration"; \
	fi
	@mkdir -p uploads logs data/chroma cache
	@echo "Created necessary directories"
	@echo "Setup complete! Run 'make dev' to start the development environment"
