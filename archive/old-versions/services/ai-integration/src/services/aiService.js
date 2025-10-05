const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../utils/logger');
const UsageRecord = require('../models/UsageRecord');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.availableModels = {
      openai: [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-turbo-preview',
        'text-embedding-ada-002',
        'text-embedding-3-small',
        'text-embedding-3-large'
      ],
      anthropic: [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229'
      ]
    };
  }

  async generateCompletion({ prompt, model, maxTokens, temperature, systemPrompt }) {
    try {
      const startTime = Date.now();
      
      // Determine which provider to use based on model
      const provider = this.getProviderForModel(model);
      
      let result;
      
      if (provider === 'openai') {
        result = await this.generateOpenAICompletion({
          prompt,
          model,
          maxTokens,
          temperature,
          systemPrompt
        });
      } else if (provider === 'anthropic') {
        result = await this.generateAnthropicCompletion({
          prompt,
          model,
          maxTokens,
          temperature,
          systemPrompt
        });
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }

      // Record usage
      await this.recordUsage({
        provider,
        model,
        operation: 'completion',
        tokens: result.usage?.total_tokens || 0,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Error generating completion:', error);
      throw error;
    }
  }

  async generateOpenAICompletion({ prompt, model, maxTokens, temperature, systemPrompt }) {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false
    });

    return {
      text: response.choices[0].message.content,
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason
    };
  }

  async generateAnthropicCompletion({ prompt, model, maxTokens, temperature, systemPrompt }) {
    const response = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    return {
      text: response.content[0].text,
      model: response.model,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      finishReason: response.stop_reason
    };
  }

  async generateEmbeddings({ text, model }) {
    try {
      const startTime = Date.now();
      
      const response = await this.openai.embeddings.create({
        model,
        input: text
      });

      const result = {
        embeddings: response.data[0].embedding,
        model: response.model,
        usage: response.usage
      };

      // Record usage
      await this.recordUsage({
        provider: 'openai',
        model,
        operation: 'embeddings',
        tokens: response.usage.total_tokens,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Error generating embeddings:', error);
      throw error;
    }
  }

  async summarizeText({ text, maxLength, style }) {
    try {
      const systemPrompt = this.getSummarizationPrompt(style, maxLength);
      
      const result = await this.generateCompletion({
        prompt: `Please summarize the following text:\n\n${text}`,
        model: process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo',
        maxTokens: Math.min(maxLength * 2, 1000),
        temperature: 0.3,
        systemPrompt
      });

      return {
        summary: result.text,
        originalLength: text.length,
        summaryLength: result.text.length,
        compressionRatio: (text.length - result.text.length) / text.length
      };
    } catch (error) {
      logger.error('Error summarizing text:', error);
      throw error;
    }
  }

  async answerQuestion({ text, question, context }) {
    try {
      const systemPrompt = `You are an AI assistant that answers questions based on the provided text. 
      Be accurate and only use information from the provided text. If the answer cannot be found in the text, say so clearly.
      Provide your confidence level (high, medium, low) and reasoning for your answer.`;

      const prompt = `Context: ${context || 'No additional context provided'}

Text to analyze:
${text}

Question: ${question}

Please provide a detailed answer with your confidence level and reasoning.`;

      const result = await this.generateCompletion({
        prompt,
        model: process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo',
        maxTokens: 500,
        temperature: 0.3,
        systemPrompt
      });

      // Extract confidence and reasoning from the response
      const confidence = this.extractConfidence(result.text);
      const reasoning = this.extractReasoning(result.text);

      return {
        answer: result.text,
        confidence,
        sources: [text.substring(0, 200) + '...'], // Simplified source
        reasoning
      };
    } catch (error) {
      logger.error('Error answering question:', error);
      throw error;
    }
  }

  async extractInsights({ text, type }) {
    try {
      const systemPrompt = this.getInsightPrompt(type);
      
      const result = await this.generateCompletion({
        prompt: `Extract insights from the following text:\n\n${text}`,
        model: process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo',
        maxTokens: 800,
        temperature: 0.4,
        systemPrompt
      });

      // Parse the response to extract structured insights
      const insights = this.parseInsights(result.text);

      return {
        insights: insights.insights || [],
        categories: insights.categories || [],
        keyPoints: insights.keyPoints || []
      };
    } catch (error) {
      logger.error('Error extracting insights:', error);
      throw error;
    }
  }

  getProviderForModel(model) {
    if (this.availableModels.openai.includes(model)) {
      return 'openai';
    } else if (this.availableModels.anthropic.includes(model)) {
      return 'anthropic';
    }
    return null;
  }

  getAvailableModels() {
    return this.availableModels;
  }

  getSummarizationPrompt(style, maxLength) {
    const prompts = {
      concise: `Summarize the text in a concise manner, focusing on the main points. Keep it under ${maxLength} words.`,
      detailed: `Provide a detailed summary of the text, including key points and supporting details. Keep it under ${maxLength} words.`,
      bullet: `Summarize the text using bullet points for key information. Keep it under ${maxLength} words.`,
      executive: `Create an executive summary suitable for business decision-makers. Keep it under ${maxLength} words.`
    };
    
    return prompts[style] || prompts.concise;
  }

  getInsightPrompt(type) {
    const prompts = {
      general: `Extract key insights, themes, and important information from the text. Organize them into categories and provide specific examples.`,
      business: `Extract business-relevant insights including opportunities, risks, trends, and strategic implications.`,
      technical: `Extract technical insights including methodologies, processes, tools, and technical recommendations.`,
      research: `Extract research insights including findings, conclusions, methodology, and implications for future research.`
    };
    
    return prompts[type] || prompts.general;
  }

  extractConfidence(text) {
    const confidenceMatch = text.match(/confidence[:\s]*(high|medium|low)/i);
    return confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';
  }

  extractReasoning(text) {
    // Simple extraction of reasoning - in a real implementation, this would be more sophisticated
    const reasoningMatch = text.match(/reasoning[:\s]*(.+?)(?:\n\n|\n$|$)/is);
    return reasoningMatch ? reasoningMatch[1].trim() : 'Reasoning not explicitly provided';
  }

  parseInsights(text) {
    try {
      // Try to parse as JSON first
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to simple parsing
      const lines = text.split('\n').filter(line => line.trim());
      const insights = [];
      const categories = [];
      const keyPoints = [];
      
      lines.forEach(line => {
        if (line.startsWith('-') || line.startsWith('•')) {
          insights.push(line.substring(1).trim());
        } else if (line.includes(':')) {
          categories.push(line.trim());
        } else if (line.length > 20) {
          keyPoints.push(line.trim());
        }
      });
      
      return { insights, categories, keyPoints };
    } catch (error) {
      logger.error('Error parsing insights:', error);
      return { insights: [text], categories: [], keyPoints: [] };
    }
  }

  async recordUsage({ provider, model, operation, tokens, processingTime }) {
    try {
      const usageRecord = new UsageRecord({
        provider,
        model,
        operation,
        tokens,
        processingTime,
        timestamp: new Date()
      });
      
      await usageRecord.save();
    } catch (error) {
      logger.error('Error recording usage:', error);
      // Don't throw error as this shouldn't break the main operation
    }
  }

  async getUsageStats() {
    try {
      const stats = await UsageRecord.aggregate([
        {
          $group: {
            _id: {
              provider: '$provider',
              operation: '$operation'
            },
            totalRequests: { $sum: 1 },
            totalTokens: { $sum: '$tokens' },
            avgProcessingTime: { $avg: '$processingTime' }
          }
        }
      ]);

      const totalUsage = await UsageRecord.aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalTokens: { $sum: '$tokens' },
            avgProcessingTime: { $avg: '$processingTime' }
          }
        }
      ]);

      return {
        total: totalUsage[0] || { totalRequests: 0, totalTokens: 0, avgProcessingTime: 0 },
        byProvider: stats
      };
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      throw error;
    }
  }
}

module.exports = new AIService();


