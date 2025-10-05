import anthropic
import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class AnthropicService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
    
    async def chat_completion(
        self,
        message: str,
        history: List[Dict[str, str]] = None,
        context: Dict[str, Any] = None,
        model: str = "claude-3-sonnet-20240229",
        max_tokens: int = 4000,
        temperature: float = 0.7
    ) -> str:
        """Generate chat completion using Anthropic Claude API"""
        try:
            # Prepare conversation history
            conversation_text = ""
            
            if history:
                for msg in history[-10:]:  # Limit to last 10 messages
                    role = "Human" if msg['role'] == 'user' else "Assistant"
                    conversation_text += f"{role}: {msg['content']}\n\n"
            
            # Add current message
            conversation_text += f"Human: {message}\n\nAssistant:"
            
            # Add context if provided
            if context and context.get('system_prompt'):
                conversation_text = f"System: {context['system_prompt']}\n\n{conversation_text}"
            
            logger.info(f"Making Anthropic API call with model: {model}")
            
            # Make API call
            response = self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{
                    "role": "user",
                    "content": conversation_text
                }]
            )
            
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Anthropic API error: {str(e)}")
            raise e
    
    async def summarize_text(
        self,
        text: str,
        summary_type: str = "brief",
        model: str = "claude-3-sonnet-20240229",
        max_tokens: int = 1000
    ) -> str:
        """Summarize text using Anthropic Claude"""
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
            logger.error(f"Anthropic summarization error: {str(e)}")
            raise e
    
    async def analyze_sentiment(self, text: str, model: str = "claude-3-sonnet-20240229") -> Dict[str, Any]:
        """Analyze sentiment of text using Claude"""
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
            logger.error(f"Anthropic sentiment analysis error: {str(e)}")
            raise e
    
    async def extract_entities(self, text: str, model: str = "claude-3-sonnet-20240229") -> Dict[str, Any]:
        """Extract entities from text using Claude"""
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
            logger.error(f"Anthropic entity extraction error: {str(e)}")
            raise e
    
    async def generate_questions(
        self,
        text: str,
        question_type: str = "comprehension",
        count: int = 5,
        model: str = "claude-3-sonnet-20240229"
    ) -> List[str]:
        """Generate questions based on text content using Claude"""
        try:
            if question_type == "comprehension":
                prompt = f"Generate {count} comprehension questions about the following text:\n\n{text}"
            elif question_type == "critical_thinking":
                prompt = f"Generate {count} critical thinking questions about the following text:\n\n{text}"
            elif question_type == "discussion":
                prompt = f"Generate {count} discussion questions about the following text:\n\n{text}"
            else:
                prompt = f"Generate {count} questions about the following text:\n\n{text}"
            
            response = await self.chat_completion(
                message=prompt,
                model=model,
                max_tokens=1000,
                temperature=0.7
            )
            
            # Parse questions from response (assuming they're numbered or bulleted)
            questions = []
            lines = response.split('\n')
            for line in lines:
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-') or line.startswith('•')):
                    # Remove numbering/bullets
                    question = line.lstrip('0123456789.-• ').strip()
                    if question:
                        questions.append(question)
            
            return questions[:count]  # Ensure we don't exceed requested count
            
        except Exception as e:
            logger.error(f"Anthropic question generation error: {str(e)}")
            raise e
