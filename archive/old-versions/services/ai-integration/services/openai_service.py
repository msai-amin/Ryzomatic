import openai
import os
import logging
from typing import List, Dict, Any, Optional
import tiktoken

logger = logging.getLogger(__name__)

class OpenAIService:
    def __init__(self):
        self.client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.encoding.encode(text))
    
    async def chat_completion(
        self,
        message: str,
        history: List[Dict[str, str]] = None,
        context: Dict[str, Any] = None,
        model: str = "gpt-3.5-turbo",
        max_tokens: int = 4000,
        temperature: float = 0.7
    ) -> str:
        """Generate chat completion using OpenAI API"""
        try:
            # Prepare messages
            messages = []
            
            # Add system message if context provided
            if context and context.get('system_prompt'):
                messages.append({
                    "role": "system",
                    "content": context['system_prompt']
                })
            
            # Add conversation history
            if history:
                for msg in history[-10:]:  # Limit to last 10 messages
                    messages.append({
                        "role": msg['role'],
                        "content": msg['content']
                    })
            
            # Add current message
            messages.append({
                "role": "user",
                "content": message
            })
            
            # Check token count
            total_tokens = sum(self.count_tokens(msg['content']) for msg in messages)
            if total_tokens > 16000:  # Leave room for response
                # Truncate older messages
                messages = messages[-5:]  # Keep only last 5 messages
            
            logger.info(f"Making OpenAI API call with {len(messages)} messages")
            
            # Make API call
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=False
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise e
    
    async def generate_embedding(self, text: str, model: str = "text-embedding-ada-002") -> List[float]:
        """Generate embedding for text"""
        try:
            response = self.client.embeddings.create(
                model=model,
                input=text
            )
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"OpenAI embedding error: {str(e)}")
            raise e
    
    async def moderate_content(self, text: str) -> Dict[str, Any]:
        """Moderate content using OpenAI's moderation API"""
        try:
            response = self.client.moderations.create(input=text)
            return {
                'flagged': response.results[0].flagged,
                'categories': response.results[0].categories,
                'category_scores': response.results[0].category_scores
            }
            
        except Exception as e:
            logger.error(f"OpenAI moderation error: {str(e)}")
            raise e
    
    async def summarize_text(
        self,
        text: str,
        summary_type: str = "brief",
        model: str = "gpt-3.5-turbo",
        max_tokens: int = 1000
    ) -> str:
        """Summarize text using OpenAI"""
        try:
            # Create appropriate prompt based on summary type
            if summary_type == "brief":
                prompt = f"Provide a brief summary of the following text:\n\n{text}"
            elif summary_type == "detailed":
                prompt = f"Provide a detailed summary of the following text:\n\n{text}"
            elif summary_type == "bullet_points":
                prompt = f"Summarize the following text in bullet points:\n\n{text}"
            else:
                prompt = f"Summarize the following text:\n\n{text}"
            
            response = await self.chat_completion(
                message=prompt,
                model=model,
                max_tokens=max_tokens,
                temperature=0.3
            )
            
            return response
            
        except Exception as e:
            logger.error(f"OpenAI summarization error: {str(e)}")
            raise e
    
    async def analyze_sentiment(self, text: str, model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
        """Analyze sentiment of text"""
        try:
            prompt = f"""Analyze the sentiment of the following text and provide:
1. Overall sentiment (positive, negative, neutral)
2. Confidence score (0-1)
3. Key emotional indicators
4. Brief explanation

Text: {text}"""
            
            response = await self.chat_completion(
                message=prompt,
                model=model,
                max_tokens=500,
                temperature=0.3
            )
            
            return {
                'analysis': response,
                'model': model
            }
            
        except Exception as e:
            logger.error(f"OpenAI sentiment analysis error: {str(e)}")
            raise e
    
    async def extract_entities(self, text: str, model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
        """Extract entities from text"""
        try:
            prompt = f"""Extract the following entities from the text:
- People (names)
- Organizations
- Locations
- Dates
- Key topics/themes

Format as JSON with categories and lists.

Text: {text}"""
            
            response = await self.chat_completion(
                message=prompt,
                model=model,
                max_tokens=1000,
                temperature=0.3
            )
            
            return {
                'entities': response,
                'model': model
            }
            
        except Exception as e:
            logger.error(f"OpenAI entity extraction error: {str(e)}")
            raise e
