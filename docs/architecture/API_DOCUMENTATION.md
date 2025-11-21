# AI Reader Assistant - API Documentation

## Overview

The AI Reader Assistant is a comprehensive microservices-based platform that provides intelligent document processing, AI-powered chat capabilities, and advanced file management. This document outlines the complete API reference for all services.

## Base URLs

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

## Authentication

All API endpoints (except health checks) require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

## API Gateway Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

### Service Health Check
```http
GET /health/services
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "document-processing": {
      "status": "healthy",
      "responseTime": "50ms",
      "lastChecked": "2024-01-01T00:00:00.000Z"
    },
    "chat-api": {
      "status": "healthy",
      "responseTime": "30ms",
      "lastChecked": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### API Documentation
```http
GET /api/docs
```

Returns comprehensive API documentation for all services.

## Document Processing Service

Base URL: `/api/documents`

### Process Document
```http
POST /api/documents/process
Content-Type: multipart/form-data
```

**Request Body:**
- `document` (file): PDF, DOCX, or TXT file
- `userId` (string): User ID
- `metadata` (string, optional): JSON metadata

**Response:**
```json
{
  "success": true,
  "documentId": "uuid",
  "content": "extracted text content",
  "metadata": {
    "pages": 10,
    "type": "pdf",
    "processingTime": 1500
  },
  "processingTime": 1500
}
```

### Get Processing Status
```http
GET /api/documents/status/{documentId}
```

**Response:**
```json
{
  "documentId": "uuid",
  "status": "processed",
  "progress": 100,
  "processedAt": "2024-01-01T00:00:00.000Z"
}
```

### Batch Process Documents
```http
POST /api/documents/batch-process
Content-Type: multipart/form-data
```

**Request Body:**
- `documents` (files[]): Array of files
- `userId` (string): User ID

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "filename": "document.pdf",
      "documentId": "uuid",
      "content": "extracted content"
    }
  ],
  "totalFiles": 5,
  "successfulProcesses": 5
}
```

## Chat API Service

Base URL: `/api/chat`

### Get User Chats
```http
GET /api/chat/chats?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "chats": [
    {
      "id": "uuid",
      "title": "Chat Title",
      "messageCount": 15,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

### Create New Chat
```http
POST /api/chat/chats
```

**Request Body:**
```json
{
  "title": "New Chat",
  "metadata": {
    "tags": ["work", "important"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "chat": {
    "id": "uuid",
    "title": "New Chat",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Chat Messages
```http
GET /api/chat/chats/{chatId}/messages?page=1&limit=50
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "userId": "user123",
      "content": "Hello, how can I help you?",
      "type": "text",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### Delete Chat
```http
DELETE /api/chat/chats/{chatId}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

## File Storage Service

Base URL: `/api/files`

### Upload File
```http
POST /api/files/upload
Content-Type: multipart/form-data
```

**Request Body:**
- `file` (file): File to upload
- `metadata` (string, optional): JSON metadata
- `folder` (string, optional): Target folder

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "originalName": "document.pdf",
    "fileName": "file-uuid.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "folder": "default",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "File uploaded successfully"
}
```

### Get File Info
```http
GET /api/files/files/{fileId}
```

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "url": "/files/uuid",
    "downloadUrl": "/files/uuid/download",
    "contentUrl": "/files/uuid/content"
  }
}
```

### Download File
```http
GET /api/files/files/{fileId}/download
```

Returns the file as a download.

### Get File Content
```http
GET /api/files/files/{fileId}/content?width=300&height=300&quality=80
```

Returns file content (with optional image resizing).

### Get User Files
```http
GET /api/files/files?page=1&limit=20&folder=default&type=image&search=photo
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": "uuid",
      "originalName": "photo.jpg",
      "mimeType": "image/jpeg",
      "size": 512000,
      "folder": "default",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Delete File
```http
DELETE /api/files/files/{fileId}
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## AI Integration Service

Base URL: `/api/ai`

### Chat Completion
```http
POST /api/ai/chat
```

**Request Body:**
```json
{
  "userId": "user123",
  "message": "What is the main topic of this document?",
  "conversationId": "uuid",
  "model": "gpt-3.5-turbo",
  "context": {
    "system_prompt": "You are a helpful assistant."
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "The main topic of this document is...",
  "conversationId": "uuid",
  "model": "gpt-3.5-turbo",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Summarize Text
```http
POST /api/ai/summarize
```

**Request Body:**
```json
{
  "text": "Long text content to summarize...",
  "type": "brief",
  "model": "gpt-3.5-turbo"
}
```

**Response:**
```json
{
  "success": true,
  "summary": "Brief summary of the text...",
  "type": "brief",
  "model": "gpt-3.5-turbo",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Analyze Text
```http
POST /api/ai/analyze
```

**Request Body:**
```json
{
  "text": "Text to analyze...",
  "type": "sentiment",
  "model": "gpt-3.5-turbo"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "sentiment": "positive",
    "confidence": 0.85,
    "keywords": ["happy", "excited", "great"]
  },
  "type": "sentiment",
  "model": "gpt-3.5-turbo",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Generate Questions
```http
POST /api/ai/generate-questions
```

**Request Body:**
```json
{
  "text": "Text content...",
  "type": "comprehension",
  "count": 5,
  "model": "gpt-3.5-turbo"
}
```

**Response:**
```json
{
  "success": true,
  "questions": [
    "What is the main argument presented?",
    "How does the author support their claims?",
    "What are the key findings?"
  ],
  "type": "comprehension",
  "count": 3,
  "model": "gpt-3.5-turbo",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Vector Database Service

Base URL: `/api/vectors`

### Create Embedding
```http
POST /api/vectors/embeddings
```

**Request Body:**
```json
{
  "text": "Text to embed...",
  "documentId": "uuid",
  "userId": "user123",
  "model": "text-embedding-ada-002",
  "metadata": {
    "title": "Document Title"
  }
}
```

**Response:**
```json
{
  "success": true,
  "vectorId": "uuid",
  "documentId": "uuid",
  "model": "text-embedding-ada-002",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Search Similar Documents
```http
POST /api/vectors/search
```

**Request Body:**
```json
{
  "query": "search query",
  "userId": "user123",
  "limit": 10,
  "threshold": 0.7,
  "model": "text-embedding-ada-002"
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "uuid",
      "document": "Document content...",
      "metadata": {
        "title": "Document Title",
        "document_id": "uuid"
      },
      "similarity": 0.85,
      "distance": 0.15
    }
  ],
  "query": "search query",
  "limit": 10,
  "threshold": 0.7,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Get Document Embeddings
```http
GET /api/vectors/documents/{documentId}/embeddings?userId=user123
```

**Response:**
```json
{
  "success": true,
  "documentId": "uuid",
  "embeddings": [
    {
      "id": "uuid",
      "text": "Text chunk...",
      "model": "text-embedding-ada-002",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 5,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Calculate Similarity
```http
POST /api/vectors/similarity
```

**Request Body:**
```json
{
  "text1": "First text...",
  "text2": "Second text...",
  "model": "text-embedding-ada-002"
}
```

**Response:**
```json
{
  "success": true,
  "similarity": 0.75,
  "model": "text-embedding-ada-002",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## WebSocket Endpoints

### Chat WebSocket
```javascript
const socket = io('ws://localhost:3000/ws/chat', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Join a chat room
socket.emit('join_chat', { chatId: 'uuid' });

// Send a message
socket.emit('send_message', {
  chatId: 'uuid',
  content: 'Hello!',
  type: 'text'
});

// Listen for new messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// Listen for typing indicators
socket.on('user_typing', (data) => {
  console.log('User typing:', data);
});
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid request data",
  "details": ["Field 'userId' is required"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

### 502 Bad Gateway
```json
{
  "error": "Bad Gateway",
  "message": "Service temporarily unavailable"
}
```

### 503 Service Unavailable
```json
{
  "error": "Service Unavailable",
  "message": "Service is down for maintenance"
}
```

## Rate Limits

- **General API**: 1000 requests per 15 minutes
- **File Uploads**: 20 uploads per hour
- **Batch Operations**: 5 operations per hour
- **Downloads**: 30 downloads per minute

## Pagination

Most list endpoints support pagination:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

## Filtering and Search

Many endpoints support filtering:

- `search` or `q`: Search query
- `type`: Filter by type/category
- `folder`: Filter by folder
- `status`: Filter by status

## Webhooks

The system supports webhooks for real-time notifications:

### Webhook Events
- `document.processed`: Document processing completed
- `file.uploaded`: File upload completed
- `chat.message`: New chat message
- `ai.response`: AI response generated

### Webhook Payload
```json
{
  "event": "document.processed",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "documentId": "uuid",
    "userId": "user123",
    "status": "processed"
  }
}
```

## SDKs and Libraries

### JavaScript/Node.js
```bash
npm install @ai-reader-assistant/sdk
```

### Python
```bash
pip install ai-reader-assistant
```

### Example Usage
```javascript
import { AIReaderClient } from '@ai-reader-assistant/sdk';

const client = new AIReaderClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.aireader.com'
});

// Process a document
const result = await client.documents.process(file, {
  userId: 'user123',
  metadata: { title: 'My Document' }
});

// Chat with AI
const response = await client.ai.chat({
  message: 'Summarize this document',
  conversationId: 'chat-uuid'
});
```

## Support

For API support and questions:
- Email: support@aireader.com
- Documentation: https://docs.aireader.com
- Status Page: https://status.aireader.com
