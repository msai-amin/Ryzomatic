/**
 * Test script for Structured RAG Memory System
 * Run this to verify memory extraction and search work correctly
 */

import { memoryService } from '../lib/memoryService';
import { contextBuilder } from '../lib/contextBuilder';
import { actionCacheService } from '../lib/actionCache';
import { embeddingService } from '../lib/embeddingService';

/**
 * Test 1: Memory extraction from sample conversation
 */
async function testMemoryExtraction() {
  console.log('🧪 Test 1: Memory Extraction');
  
  const sampleConversation = {
    conversationId: 'test-conv-123',
    userId: 'test-user-456',
    messages: [
      { role: 'user', content: 'What is the main argument of this paper?', id: 'msg-1' },
      { role: 'assistant', content: 'The main argument focuses on empirical research methods...', id: 'msg-2' },
      { role: 'user', content: 'How does this relate to Smith (2020)?', id: 'msg-3' },
      { role: 'assistant', content: 'Smith (2020) uses similar methodological approaches...', id: 'msg-4' },
      { role: 'user', content: 'Can you highlight the methodology section?', id: 'msg-5' },
    ],
    documentTitle: 'Empirical Methods in Research',
    documentId: 'doc-789',
  };

  try {
    const result = await memoryService.extractAndStoreMemory(sampleConversation);
    console.log('✅ Memory extraction successful:', result);
    return result.success;
  } catch (error) {
    console.error('❌ Memory extraction failed:', error);
    return false;
  }
}

/**
 * Test 2: Memory search
 */
async function testMemorySearch() {
  console.log('\n🧪 Test 2: Memory Search');
  
  try {
    const memories = await memoryService.searchMemories({
      userId: 'test-user-456',
      query: 'methodology',
      limit: 5,
    });
    
    console.log('✅ Found memories:', memories.length);
    memories.forEach((mem, i) => {
      console.log(`  ${i + 1}. [${mem.entity_type}] ${mem.entity_text.substring(0, 60)}...`);
    });
    return memories.length > 0;
  } catch (error) {
    console.error('❌ Memory search failed:', error);
    return false;
  }
}

/**
 * Test 3: Context building
 */
async function testContextBuilder() {
  console.log('\n🧪 Test 3: Context Builder');
  
  try {
    const context = await contextBuilder.buildContext({
      userId: 'test-user-456',
      query: 'What did we discuss about methodology?',
      conversationId: 'test-conv-123',
      limit: 10,
    });
    
    console.log('✅ Context built:');
    console.log(`  - Relevant memories: ${context.structuredContext.relevantMemories.length}`);
    console.log(`  - Token estimate: ${context.tokenEstimate}`);
    return context.structuredContext.relevantMemories.length > 0;
  } catch (error) {
    console.error('❌ Context builder failed:', error);
    return false;
  }
}

/**
 * Test 4: Action cache
 */
async function testActionCache() {
  console.log('\n🧪 Test 4: Action Cache');
  
  try {
    // Test action translation
    const result = await actionCacheService.getOrTranslate({
      userId: 'test-user-456',
      query: 'highlight this text in yellow on page 5',
    });
    
    console.log('✅ Action translation:', result.hit ? 'HIT' : 'MISS');
    if (result.action) {
      console.log(`  Action type: ${result.action.type}`);
      console.log(`  From cache: ${result.fromCache}`);
    }
    return result.hit;
  } catch (error) {
    console.error('❌ Action cache test failed:', error);
    return false;
  }
}

/**
 * Test 5: Embedding generation
 */
async function testEmbeddings() {
  console.log('\n🧪 Test 5: Embedding Generation');
  
  try {
    const text = 'empirical research methods';
    const embedding = await embeddingService.embed(text);
    
    console.log('✅ Embedding generated:');
    console.log(`  Dimensions: ${embedding.length}`);
    console.log(`  Format for pgvector: ${embedding.slice(0, 3).map(n => n.toFixed(4)).join(',')}...`);
    return embedding.length === 768;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Structured RAG Memory System Tests\n');
  
  const results = {
    memoryExtraction: await testMemoryExtraction(),
    memorySearch: await testMemorySearch(),
    contextBuilder: await testContextBuilder(),
    actionCache: await testActionCache(),
    embeddings: await testEmbeddings(),
  };
  
  console.log('\n📊 Test Results:');
  console.log(`  Memory Extraction: ${results.memoryExtraction ? '✅' : '❌'}`);
  console.log(`  Memory Search: ${results.memorySearch ? '✅' : '❌'}`);
  console.log(`  Context Builder: ${results.contextBuilder ? '✅' : '❌'}`);
  console.log(`  Action Cache: ${results.actionCache ? '✅' : '❌'}`);
  console.log(`  Embeddings: ${results.embeddings ? '✅' : '❌'}`);
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed! Memory system is ready to use.');
  } else {
    console.log('⚠️  Some tests failed. Check database connection and environment variables.');
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, testMemoryExtraction, testMemorySearch, testContextBuilder, testActionCache, testEmbeddings };

