# AI Reader Assistant - Deployment Guide

## Overview

This guide covers deploying the AI Reader Assistant microservices architecture in various environments, from local development to production.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for AI services)
- MongoDB 6.0+
- Redis 7+
- ChromaDB (included in Docker setup)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd smart-reader
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Development Environment
```bash
make dev
# or
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Verify Deployment
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/docs
```

## Environment Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/smart-reader
REDIS_URL=redis://localhost:6379

# Service Ports
API_GATEWAY_PORT=3000
DOCUMENT_PROCESSING_PORT=3001
CHAT_API_PORT=3002
FILE_STORAGE_PORT=3003
AI_INTEGRATION_PORT=3004
VECTOR_DB_PORT=3005

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50MB
ALLOWED_FILE_TYPES=pdf,docx,txt,md,jpg,jpeg,png,gif

# Security
JWT_SECRET=your_jwt_secret_here
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AI Model Configuration
DEFAULT_AI_MODEL=gpt-3.5-turbo
EMBEDDING_MODEL=text-embedding-ada-002
MAX_TOKENS=4000
TEMPERATURE=0.7

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

## Deployment Options

### 1. Local Development

#### Using Docker Compose (Recommended)
```bash
# Start all services
make dev

# View logs
make dev-logs

# Stop services
make dev-clean
```

#### Manual Setup
```bash
# Install dependencies
make install

# Start MongoDB and Redis
docker run -d --name mongodb -p 27017:27017 mongo:6.0
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Start each service
cd services/document-processing && npm run dev &
cd services/chat-api && npm run dev &
cd services/file-storage && npm run dev &
cd services/ai-integration && python app.py &
cd services/vector-db && python app.py &
cd services/api-gateway && npm run dev &
```

### 2. Production Deployment

#### Using Docker Compose
```bash
# Build production images
make prod-build

# Start production environment
make prod

# View logs
make prod-logs
```

#### Using Kubernetes

Create Kubernetes manifests:

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-reader
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-reader-config
  namespace: ai-reader
data:
  MONGODB_URI: "mongodb://mongodb:27017/smart-reader"
  REDIS_URL: "redis://redis:6379"
  LOG_LEVEL: "info"
---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-reader-secrets
  namespace: ai-reader
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-key>
  ANTHROPIC_API_KEY: <base64-encoded-key>
  JWT_SECRET: <base64-encoded-secret>
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: ai-reader
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: ai-reader/api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: MONGODB_URI
          valueFrom:
            configMapKeyRef:
              name: ai-reader-config
              key: MONGODB_URI
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-reader-secrets
              key: OPENAI_API_KEY
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: ai-reader
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

Deploy to Kubernetes:
```bash
kubectl apply -f k8s/
```

#### Using AWS ECS

Create ECS task definitions and services:

```json
{
  "family": "ai-reader-api-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "your-account.dkr.ecr.region.amazonaws.com/ai-reader/api-gateway:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:ai-reader/openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ai-reader",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 3. Cloud Deployment

#### AWS Deployment

1. **Set up ECS Cluster**:
```bash
aws ecs create-cluster --cluster-name ai-reader
```

2. **Create ECR Repositories**:
```bash
aws ecr create-repository --repository-name ai-reader/api-gateway
aws ecr create-repository --repository-name ai-reader/document-processing
# ... for each service
```

3. **Build and Push Images**:
```bash
# Build and tag images
docker build -t ai-reader/api-gateway ./services/api-gateway
docker tag ai-reader/api-gateway:latest your-account.dkr.ecr.region.amazonaws.com/ai-reader/api-gateway:latest

# Push to ECR
aws ecr get-login-password --region region | docker login --username AWS --password-stdin your-account.dkr.ecr.region.amazonaws.com
docker push your-account.dkr.ecr.region.amazonaws.com/ai-reader/api-gateway:latest
```

4. **Deploy with CloudFormation**:
```bash
aws cloudformation create-stack \
  --stack-name ai-reader-stack \
  --template-body file://cloudformation/ai-reader.yaml \
  --capabilities CAPABILITY_IAM
```

#### Google Cloud Platform

1. **Set up GKE Cluster**:
```bash
gcloud container clusters create ai-reader-cluster \
  --num-nodes=3 \
  --zone=us-central1-a \
  --machine-type=e2-medium
```

2. **Build and Push to GCR**:
```bash
# Build images
docker build -t gcr.io/your-project/ai-reader-api-gateway ./services/api-gateway

# Push to GCR
docker push gcr.io/your-project/ai-reader-api-gateway
```

3. **Deploy to GKE**:
```bash
kubectl apply -f k8s/
```

#### Azure Container Instances

1. **Create Resource Group**:
```bash
az group create --name ai-reader-rg --location eastus
```

2. **Deploy Container Group**:
```bash
az container create \
  --resource-group ai-reader-rg \
  --name ai-reader-group \
  --image your-registry.azurecr.io/ai-reader/api-gateway:latest \
  --dns-name-label ai-reader-app \
  --ports 3000
```

## Database Setup

### MongoDB

#### Local MongoDB
```bash
# Using Docker
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=smart-reader \
  mongo:6.0

# Create indexes
mongo smart-reader --eval "
  db.documents.createIndex({ userId: 1, createdAt: -1 });
  db.chats.createIndex({ userId: 1, updatedAt: -1 });
  db.files.createIndex({ userId: 1, createdAt: -1 });
"
```

#### MongoDB Atlas (Cloud)
1. Create cluster at https://cloud.mongodb.com
2. Get connection string
3. Update `MONGODB_URI` in environment variables

### Redis

#### Local Redis
```bash
# Using Docker
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### Redis Cloud
1. Create database at https://redis.com
2. Get connection string
3. Update `REDIS_URL` in environment variables

### ChromaDB

ChromaDB is included in the Docker setup and runs automatically.

## Monitoring and Logging

### Application Logs

#### Local Development
```bash
# View all logs
make logs

# View specific service logs
make logs-gateway
make logs-docs
make logs-chat
```

#### Production Logging

Configure centralized logging:

```yaml
# docker-compose.prod.yml
services:
  api-gateway:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### ELK Stack Integration

```yaml
# docker-compose.logging.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

### Health Monitoring

#### Health Check Endpoints
- API Gateway: `GET /health`
- Services: `GET /health/services`

#### Prometheus Metrics

Add Prometheus monitoring:

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ai-reader'
    static_configs:
      - targets: ['api-gateway:3000']
```

#### Grafana Dashboards

Create dashboards for:
- Service health
- Request rates
- Response times
- Error rates
- Resource usage

## Security

### SSL/TLS Configuration

#### Using Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d your-domain.com

# Update nginx configuration
# Add SSL configuration to nginx.conf
```

#### Using Cloud Load Balancer

Configure SSL termination at the load balancer level.

### API Security

1. **Rate Limiting**: Configured in nginx and application level
2. **Authentication**: JWT tokens with proper expiration
3. **CORS**: Configured for specific origins
4. **Input Validation**: All inputs validated and sanitized

### Network Security

```yaml
# docker-compose.security.yml
services:
  api-gateway:
    networks:
      - frontend
  document-processing:
    networks:
      - backend
  mongodb:
    networks:
      - database

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
  database:
    driver: bridge
    internal: true
```

## Backup and Recovery

### Database Backups

#### MongoDB Backup
```bash
# Create backup
docker exec mongodb mongodump --out /backup

# Restore backup
docker exec mongodb mongorestore /backup
```

#### Automated Backups
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec mongodb mongodump --out /backup_$DATE
aws s3 cp /backup_$DATE s3://your-backup-bucket/
```

### File Storage Backups

```bash
# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
aws s3 cp uploads_backup_$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```

## Scaling

### Horizontal Scaling

#### Load Balancer Configuration
```nginx
upstream api_gateway {
    server api-gateway-1:3000;
    server api-gateway-2:3000;
    server api-gateway-3:3000;
}
```

#### Auto Scaling

Configure auto-scaling based on CPU/memory usage:

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Vertical Scaling

Increase resource limits for services:

```yaml
# docker-compose.prod.yml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

## Troubleshooting

### Common Issues

1. **Service Not Starting**:
   - Check logs: `docker-compose logs service-name`
   - Verify environment variables
   - Check port conflicts

2. **Database Connection Issues**:
   - Verify MongoDB/Redis are running
   - Check connection strings
   - Verify network connectivity

3. **File Upload Issues**:
   - Check file size limits
   - Verify upload directory permissions
   - Check disk space

4. **AI Service Issues**:
   - Verify API keys
   - Check rate limits
   - Monitor API usage

### Debug Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs -f service-name

# Execute commands in container
docker-compose exec service-name /bin/bash

# Check resource usage
docker stats

# Check network connectivity
docker-compose exec api-gateway ping document-processing
```

### Performance Optimization

1. **Database Optimization**:
   - Add proper indexes
   - Optimize queries
   - Use connection pooling

2. **Caching**:
   - Enable Redis caching
   - Use CDN for static files
   - Implement application-level caching

3. **Resource Optimization**:
   - Monitor memory usage
   - Optimize Docker images
   - Use multi-stage builds

## Maintenance

### Regular Tasks

1. **Database Maintenance**:
   - Monitor disk usage
   - Clean up old data
   - Optimize indexes

2. **Log Rotation**:
   - Configure log rotation
   - Archive old logs
   - Monitor log sizes

3. **Security Updates**:
   - Update base images
   - Apply security patches
   - Review access controls

### Update Procedures

1. **Zero-Downtime Updates**:
   - Use rolling updates
   - Implement health checks
   - Use load balancer

2. **Database Migrations**:
   - Backup before migration
   - Test migration scripts
   - Plan rollback procedures

## Support

For deployment issues:
- Check logs and error messages
- Review this documentation
- Contact support team
- Check GitHub issues
