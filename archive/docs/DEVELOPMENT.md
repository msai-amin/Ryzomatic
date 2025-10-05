# AI Reader Assistant - Development Guide

## Overview

This guide covers setting up a development environment for the AI Reader Assistant microservices architecture, including local development, testing, and contributing guidelines.

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+ and pip
- Docker and Docker Compose
- Git
- MongoDB 6.0+
- Redis 7+

## Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd smart-reader
```

### 2. Environment Setup
```bash
# Copy environment file
cp .env.example .env

# Edit configuration
nano .env
```

### 3. Install Dependencies
```bash
# Install all service dependencies
make install

# Or install individually
cd services/document-processing && npm install
cd services/chat-api && npm install
cd services/file-storage && npm install
cd services/ai-integration && pip install -r requirements.txt
cd services/vector-db && pip install -r requirements.txt
cd services/api-gateway && npm install
```

### 4. Start Development Environment
```bash
# Start all services with Docker
make dev

# Or start services individually
make dev-build
make dev-logs
```

## Project Structure

```
smart-reader/
├── services/
│   ├── api-gateway/           # API Gateway service
│   │   ├── src/
│   │   │   ├── app.js
│   │   │   ├── middleware/
│   │   │   ├── utils/
│   │   │   └── ...
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── document-processing/   # Document processing service
│   ├── chat-api/             # Chat API service
│   ├── file-storage/         # File storage service
│   ├── ai-integration/       # AI integration service
│   └── vector-db/            # Vector database service
├── uploads/                  # File uploads directory
├── logs/                     # Application logs
├── data/                     # Persistent data
├── docker-compose.yml        # Production compose
├── docker-compose.dev.yml    # Development compose
├── Makefile                  # Development commands
└── README.md
```

## Service Development

### Document Processing Service

**Technology**: Node.js, Express, PDF-parse, Mammoth

**Key Features**:
- PDF text extraction
- DOCX processing
- Text file handling
- OCR capabilities
- Batch processing

**Development**:
```bash
cd services/document-processing
npm install
npm run dev
```

**API Endpoints**:
- `POST /process` - Process single document
- `POST /batch-process` - Process multiple documents
- `GET /status/:id` - Get processing status

### Chat API Service

**Technology**: Node.js, Express, Socket.io, MongoDB

**Key Features**:
- Real-time messaging
- WebSocket support
- Chat history
- User management
- AI integration

**Development**:
```bash
cd services/chat-api
npm install
npm run dev
```

**API Endpoints**:
- `GET /chats` - Get user chats
- `POST /chats` - Create new chat
- `GET /chats/:id/messages` - Get chat messages
- `DELETE /chats/:id` - Delete chat

### File Storage Service

**Technology**: Node.js, Express, Multer, Sharp

**Key Features**:
- File upload/download
- Image processing
- CDN capabilities
- Metadata extraction
- Thumbnail generation

**Development**:
```bash
cd services/file-storage
npm install
npm run dev
```

**API Endpoints**:
- `POST /upload` - Upload file
- `GET /files/:id` - Get file info
- `GET /files/:id/download` - Download file
- `DELETE /files/:id` - Delete file

### AI Integration Service

**Technology**: Python, Flask, OpenAI, Anthropic

**Key Features**:
- OpenAI GPT integration
- Anthropic Claude integration
- Text summarization
- Content analysis
- Question generation

**Development**:
```bash
cd services/ai-integration
pip install -r requirements.txt
python app.py
```

**API Endpoints**:
- `POST /chat` - AI chat completion
- `POST /summarize` - Summarize text
- `POST /analyze` - Analyze text
- `POST /generate-questions` - Generate questions

### Vector Database Service

**Technology**: Python, Flask, ChromaDB, OpenAI

**Key Features**:
- Embedding generation
- Vector similarity search
- Document indexing
- Semantic search
- RAG support

**Development**:
```bash
cd services/vector-db
pip install -r requirements.txt
python app.py
```

**API Endpoints**:
- `POST /embeddings` - Create embedding
- `POST /search` - Search similar documents
- `GET /documents/:id/embeddings` - Get document embeddings

### API Gateway Service

**Technology**: Node.js, Express, http-proxy-middleware

**Key Features**:
- Service orchestration
- Request routing
- Rate limiting
- Authentication
- Load balancing

**Development**:
```bash
cd services/api-gateway
npm install
npm run dev
```

**API Endpoints**:
- `GET /health` - Health check
- `GET /api/docs` - API documentation
- All service endpoints proxied

## Database Setup

### MongoDB

**Local Development**:
```bash
# Using Docker
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=smart-reader \
  mongo:6.0

# Using MongoDB Compass
# Connect to mongodb://localhost:27017
```

**Collections**:
- `documents` - Processed documents
- `chats` - Chat conversations
- `messages` - Chat messages
- `files` - File metadata
- `users` - User accounts
- `document_embeddings` - Vector embeddings

### Redis

**Local Development**:
```bash
# Using Docker
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine

# Using Redis CLI
redis-cli
```

**Usage**:
- Caching
- Session storage
- Rate limiting
- Message queues

### ChromaDB

**Local Development**:
```bash
# Using Docker
docker run -d --name chromadb \
  -p 8000:8000 \
  chromadb/chroma:latest
```

**Usage**:
- Vector storage
- Similarity search
- Document embeddings

## Testing

### Running Tests

**All Services**:
```bash
make test
```

**Individual Services**:
```bash
# Node.js services
cd services/document-processing
npm test

cd services/chat-api
npm test

cd services/file-storage
npm test

cd services/api-gateway
npm test

# Python services
cd services/ai-integration
python -m pytest

cd services/vector-db
python -m pytest
```

### Test Structure

```
services/
├── document-processing/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   └── package.json
├── chat-api/
│   ├── tests/
│   └── package.json
└── ...
```

### Writing Tests

**Node.js (Jest)**:
```javascript
// tests/unit/documentProcessor.test.js
const documentProcessor = require('../src/processors/documentProcessor');

describe('DocumentProcessor', () => {
  test('should process PDF file', async () => {
    const mockFile = {
      path: './test/fixtures/sample.pdf',
      originalname: 'sample.pdf',
      mimetype: 'application/pdf'
    };

    const result = await documentProcessor.processDocument(mockFile);
    
    expect(result).toBeDefined();
    expect(result.content).toContain('sample text');
  });
});
```

**Python (pytest)**:
```python
# tests/test_ai_service.py
import pytest
from services.ai_service import AIService

class TestAIService:
    def test_chat_completion(self):
        service = AIService()
        response = service.chat_completion("Hello, world!")
        
        assert response is not None
        assert len(response) > 0
```

### Integration Tests

**API Testing**:
```javascript
// tests/integration/api.test.js
const request = require('supertest');
const app = require('../src/app');

describe('API Integration', () => {
  test('should process document end-to-end', async () => {
    const response = await request(app)
      .post('/api/documents/process')
      .attach('document', './test/fixtures/sample.pdf')
      .field('userId', 'test-user')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.documentId).toBeDefined();
  });
});
```

## Code Quality

### Linting

**JavaScript/Node.js**:
```bash
# ESLint
npm run lint

# Fix issues
npm run lint:fix
```

**Python**:
```bash
# Flake8
flake8 services/ai-integration/
flake8 services/vector-db/

# Black (code formatting)
black services/ai-integration/
black services/vector-db/
```

### Code Style

**JavaScript**:
- Use ESLint with Airbnb config
- Prefer const/let over var
- Use async/await over callbacks
- Follow RESTful API conventions

**Python**:
- Follow PEP 8 style guide
- Use type hints
- Write docstrings
- Use meaningful variable names

### Pre-commit Hooks

```bash
# Install husky for Node.js
npm install --save-dev husky

# Install pre-commit for Python
pip install pre-commit
pre-commit install
```

## Debugging

### Local Debugging

**Node.js Services**:
```bash
# Using debugger
node --inspect src/app.js

# Using VS Code
# Set breakpoints and use F5 to debug
```

**Python Services**:
```bash
# Using pdb
python -m pdb app.py

# Using VS Code
# Set breakpoints and use F5 to debug
```

### Docker Debugging

**View Logs**:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f document-processing
```

**Execute Commands**:
```bash
# Access container shell
docker-compose exec document-processing /bin/bash

# Run specific command
docker-compose exec document-processing npm test
```

**Debug Mode**:
```yaml
# docker-compose.dev.yml
services:
  document-processing:
    environment:
      - NODE_ENV=development
      - DEBUG=*
    volumes:
      - ./services/document-processing:/app
      - /app/node_modules
```

## Performance Optimization

### Node.js Optimization

**Memory Management**:
```javascript
// Use streams for large files
const fs = require('fs');
const stream = fs.createReadStream('large-file.pdf');

// Garbage collection
if (global.gc) {
  global.gc();
}
```

**Caching**:
```javascript
// Redis caching
const redis = require('redis');
const client = redis.createClient();

const cacheKey = `document:${documentId}`;
const cached = await client.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}
```

### Python Optimization

**Memory Management**:
```python
# Use generators for large datasets
def process_documents(documents):
    for doc in documents:
        yield process_document(doc)

# Clear unused variables
del large_data
```

**Async Operations**:
```python
# Use asyncio for concurrent operations
import asyncio

async def process_multiple_documents(documents):
    tasks = [process_document(doc) for doc in documents]
    return await asyncio.gather(*tasks)
```

## Monitoring and Logging

### Application Logging

**Structured Logging**:
```javascript
// Winston logger
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

**Python Logging**:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

### Metrics Collection

**Custom Metrics**:
```javascript
// Prometheus metrics
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});
```

## Contributing

### Development Workflow

1. **Fork Repository**:
   ```bash
   git fork <repository-url>
   git clone <your-fork-url>
   ```

2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/new-feature
   ```

3. **Make Changes**:
   - Write code
   - Add tests
   - Update documentation

4. **Test Changes**:
   ```bash
   make test
   make lint
   ```

5. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

6. **Push and Create PR**:
   ```bash
   git push origin feature/new-feature
   # Create pull request on GitHub
   ```

### Commit Convention

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

### Pull Request Guidelines

1. **Title**: Clear, descriptive title
2. **Description**: Explain what and why
3. **Tests**: Include test coverage
4. **Documentation**: Update relevant docs
5. **Breaking Changes**: Clearly mark if any

### Code Review Process

1. **Automated Checks**: CI/CD pipeline runs
2. **Peer Review**: At least one reviewer
3. **Testing**: All tests must pass
4. **Documentation**: Docs must be updated
5. **Approval**: Maintainer approval required

## Troubleshooting

### Common Issues

**Port Conflicts**:
```bash
# Check port usage
lsof -i :3000

# Kill process
kill -9 <PID>
```

**Docker Issues**:
```bash
# Clean Docker
docker system prune -a

# Rebuild images
docker-compose build --no-cache
```

**Database Connection**:
```bash
# Check MongoDB
docker-compose exec mongodb mongosh

# Check Redis
docker-compose exec redis redis-cli ping
```

**Memory Issues**:
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop -> Settings -> Resources
```

### Debug Tools

**Node.js Debugging**:
- Chrome DevTools
- VS Code debugger
- Node.js inspector

**Python Debugging**:
- pdb debugger
- VS Code debugger
- PyCharm debugger

**Database Debugging**:
- MongoDB Compass
- Redis Commander
- Database logs

## Resources

### Documentation
- [Node.js Documentation](https://nodejs.org/docs/)
- [Python Documentation](https://docs.python.org/)
- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Redis Documentation](https://redis.io/documentation)

### Tools
- [VS Code](https://code.visualstudio.com/)
- [Postman](https://www.postman.com/)
- [MongoDB Compass](https://www.mongodb.com/products/compass)
- [Redis Commander](https://github.com/joeferner/redis-commander)

### Learning Resources
- [Microservices Patterns](https://microservices.io/)
- [RESTful API Design](https://restfulapi.net/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
