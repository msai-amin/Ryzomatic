import logging
from typing import List, Dict, Any, Optional
import asyncio

from .openai_service import OpenAIService
from .anthropic_service import AnthropicService

logger = logging.getLogger(__name__)

class TextProcessor:
    def __init__(self):
        self.openai_service = OpenAIService()
        self.anthropic_service = AnthropicService()
    
    async def summarize_text(
        self,
        text: str,
        summary_type: str = "brief",
        model: str = "gpt-3.5-turbo"
    ) -> str:
        """Summarize text using the specified model"""
        try:
            if model.startswith('gpt'):
                return await self.openai_service.summarize_text(text, summary_type, model)
            elif model.startswith('claude'):
                return await self.anthropic_service.summarize_text(text, summary_type, model)
            else:
                # Default to OpenAI
                return await self.openai_service.summarize_text(text, summary_type, model)
                
        except Exception as e:
            logger.error(f"Text summarization error: {str(e)}")
            raise e
    
    async def analyze_text(
        self,
        text: str,
        analysis_type: str = "general",
        model: str = "gpt-3.5-turbo"
    ) -> Dict[str, Any]:
        """Analyze text for various insights"""
        try:
            if analysis_type == "sentiment":
                if model.startswith('gpt'):
                    return await self.openai_service.analyze_sentiment(text, model)
                elif model.startswith('claude'):
                    return await self.anthropic_service.analyze_sentiment(text, model)
            
            elif analysis_type == "entities":
                if model.startswith('gpt'):
                    return await self.openai_service.extract_entities(text, model)
                elif model.startswith('claude'):
                    return await self.anthropic_service.extract_entities(text, model)
            
            elif analysis_type == "topics":
                return await self._extract_topics(text, model)
            
            elif analysis_type == "general":
                return await self._general_analysis(text, model)
            
            else:
                raise ValueError(f"Unsupported analysis type: {analysis_type}")
                
        except Exception as e:
            logger.error(f"Text analysis error: {str(e)}")
            raise e
    
    async def generate_questions(
        self,
        text: str,
        question_type: str = "comprehension",
        count: int = 5,
        model: str = "gpt-3.5-turbo"
    ) -> List[str]:
        """Generate questions based on text content"""
        try:
            if model.startswith('gpt'):
                return await self._generate_questions_openai(text, question_type, count, model)
            elif model.startswith('claude'):
                return await self.anthropic_service.generate_questions(text, question_type, count, model)
            else:
                # Default to OpenAI
                return await self._generate_questions_openai(text, question_type, count, model)
                
        except Exception as e:
            logger.error(f"Question generation error: {str(e)}")
            raise e
    
    async def _extract_topics(self, text: str, model: str) -> Dict[str, Any]:
        """Extract topics from text"""
        try:
            if model.startswith('gpt'):
                service = self.openai_service
            else:
                service = self.anthropic_service
            
            prompt = f"""Extract the main topics and themes from the following text. 
            Provide them as a list with brief descriptions.

            Text: {text}"""
            
            response = await service.chat_completion(
                message=prompt,
                model=model,
                max_tokens=1000,
                temperature=0.3
            )
            
            return {
                'topics': response,
                'model': model,
                'type': 'topics'
            }
            
        except Exception as e:
            logger.error(f"Topic extraction error: {str(e)}")
            raise e
    
    async def _general_analysis(self, text: str, model: str) -> Dict[str, Any]:
        """Perform general analysis of text"""
        try:
            if model.startswith('gpt'):
                service = self.openai_service
            else:
                service = self.anthropic_service
            
            prompt = f"""Analyze the following text and provide insights on:
            1. Main themes and topics
            2. Writing style and tone
            3. Key points and arguments
            4. Overall quality and coherence
            5. Suggestions for improvement (if applicable)

            Text: {text}"""
            
            response = await service.chat_completion(
                message=prompt,
                model=model,
                max_tokens=1500,
                temperature=0.3
            )
            
            return {
                'analysis': response,
                'model': model,
                'type': 'general'
            }
            
        except Exception as e:
            logger.error(f"General analysis error: {str(e)}")
            raise e
    
    async def _generate_questions_openai(
        self,
        text: str,
        question_type: str,
        count: int,
        model: str
    ) -> List[str]:
        """Generate questions using OpenAI"""
        try:
            if question_type == "comprehension":
                prompt = f"Generate {count} comprehension questions about the following text:\n\n{text}"
            elif question_type == "critical_thinking":
                prompt = f"Generate {count} critical thinking questions about the following text:\n\n{text}"
            elif question_type == "discussion":
                prompt = f"Generate {count} discussion questions about the following text:\n\n{text}"
            else:
                prompt = f"Generate {count} questions about the following text:\n\n{text}"
            
            response = await self.openai_service.chat_completion(
                message=prompt,
                model=model,
                max_tokens=1000,
                temperature=0.7
            )
            
            # Parse questions from response
            questions = []
            lines = response.split('\n')
            for line in lines:
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-') or line.startswith('•')):
                    question = line.lstrip('0123456789.-• ').strip()
                    if question:
                        questions.append(question)
            
            return questions[:count]
            
        except Exception as e:
            logger.error(f"OpenAI question generation error: {str(e)}")
            raise e
    
    async def moderate_content(self, text: str) -> Dict[str, Any]:
        """Moderate content for inappropriate material"""
        try:
            return await self.openai_service.moderate_content(text)
        except Exception as e:
            logger.error(f"Content moderation error: {str(e)}")
            raise e
    
    async def generate_embedding(self, text: str, model: str = "text-embedding-ada-002") -> List[float]:
        """Generate embedding for text"""
        try:
            return await self.openai_service.generate_embedding(text, model)
        except Exception as e:
            logger.error(f"Embedding generation error: {str(e)}")
            raise e
