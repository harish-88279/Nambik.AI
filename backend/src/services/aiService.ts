import { HfInference } from '@huggingface/inference';
import { logger } from '../utils/logger';

// Initialize Hugging Face client if API key is available
// For prototype, we'll provide fallback responses if the API key is not set
let hf: HfInference | null = null;
try {
  if (process.env.HUGGINGFACE_API_KEY) {
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    logger.info('Hugging Face API initialized successfully');
  } else {
    logger.warn('HUGGINGFACE_API_KEY not provided, using fallback responses for prototype');
  }
} catch (error) {
  logger.error('Failed to initialize Hugging Face API:', error);
}

// Sentiment analysis using Hugging Face (with fallback for prototype)
export const analyzeSentiment = async (text: string): Promise<number> => {
  try {
    // If Hugging Face client is available, use it
    if (hf) {
      const result = await hf.textClassification({
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        inputs: text
      });

      // Convert sentiment to -1 to 1 scale
      const sentiment = result[0];
      if (sentiment.label === 'LABEL_0') { // Negative
        return -sentiment.score;
      } else if (sentiment.label === 'LABEL_1') { // Neutral
        return 0;
      } else { // Positive
        return sentiment.score;
      }
    } else {
      // Fallback for prototype: simple keyword-based sentiment analysis
      const lowerText = text.toLowerCase();
      const positiveWords = ['happy', 'good', 'great', 'excellent', 'better', 'hopeful', 'positive'];
      const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'worse', 'hopeless', 'negative', 'depressed', 'anxious'];
      
      let score = 0;
      for (const word of positiveWords) {
        if (lowerText.includes(word)) score += 0.2;
      }
      for (const word of negativeWords) {
        if (lowerText.includes(word)) score -= 0.2;
      }
      
      // Clamp between -1 and 1
      return Math.max(-1, Math.min(1, score));
    }
  } catch (error) {
    logger.error('Sentiment analysis error:', error);
    return 0; // Default to neutral on error
  }
};

// Generate AI response for mental health support (with fallback for prototype)
export const generateAIResponse = async (userMessage: string, language: string = 'en'): Promise<string> => {
  try {
    // If Hugging Face client is available, use it
    if (hf) {
      // Use a fine-tuned mental health model or fallback to general model
      const model = 'microsoft/DialoGPT-medium';
      
      const result = await hf.textGeneration({
        model,
        inputs: `Human: ${userMessage}\nAI:`,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      });

      let response = result.generated_text;
      
      // Clean up the response
      response = response.replace(/Human:.*?AI:/s, '').trim();
      response = response.split('\n')[0].trim();
      
      // Add mental health disclaimers
      if (response.length < 10) {
        response = "I understand you're going through a difficult time. It's important to remember that I'm here to listen and provide support, but I'm not a replacement for professional help. Would you like to talk more about what's on your mind?";
      }

      // Add crisis intervention if needed
      if (userMessage.toLowerCase().includes('suicide') || 
          userMessage.toLowerCase().includes('kill myself') ||
          userMessage.toLowerCase().includes('end it all')) {
        response += "\n\nIf you're having thoughts of self-harm, please reach out to a mental health professional immediately. You can also contact a crisis helpline in your area.";
      }

      return response;
    } else {
      // Fallback responses for prototype
      const lowerMessage = userMessage.toLowerCase();
      
      // Crisis detection
      if (lowerMessage.includes('suicide') || 
          lowerMessage.includes('kill myself') ||
          lowerMessage.includes('end it all')) {
        return "I'm concerned about what you're sharing. If you're having thoughts of self-harm, please reach out to a mental health professional immediately. You can also contact a crisis helpline in your area. Would you like me to provide some resources that might help?";
      }
      
      // Anxiety responses
      if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety') || lowerMessage.includes('worried')) {
        return "It sounds like you're experiencing some anxiety. That's a common feeling, and there are strategies that might help. Deep breathing, mindfulness, and talking to someone you trust can be good first steps. Would you like to tell me more about what's making you feel anxious?";
      }
      
      // Depression responses
      if (lowerMessage.includes('depressed') || lowerMessage.includes('depression') || lowerMessage.includes('sad')) {
        return "I'm sorry to hear you're feeling down. Depression and sadness are difficult emotions to navigate. Remember that it's okay to ask for help, and there are people who care about you. Would it help to talk more about what you're experiencing?";
      }
      
      // Stress responses
      if (lowerMessage.includes('stress') || lowerMessage.includes('overwhelmed')) {
        return "Being stressed and overwhelmed can be really challenging. Taking small breaks, practicing self-care, and breaking tasks into smaller steps might help. What specific situations are causing you stress right now?";
      }
      
      // Default response
      return "I'm here to listen and support you. While I'm not a replacement for professional help, I can offer a space to talk. Could you tell me more about what you're experiencing?";
    }
  } catch (error) {
    logger.error('AI response generation error:', error);
    return "I'm here to listen and support you. Could you tell me more about what you're experiencing?";
  }
};

// Crisis detection using keyword analysis
export const detectCrisisKeywords = (text: string): { isCrisis: boolean; severity: number; keywords: string[] } => {
  const crisisKeywords = {
    high: ['suicide', 'kill myself', 'end it all', 'not worth living', 'better off dead'],
    medium: ['hopeless', 'worthless', 'can\'t go on', 'give up', 'no point'],
    low: ['sad', 'depressed', 'anxious', 'stressed', 'overwhelmed']
  };

  const lowerText = text.toLowerCase();
  const foundKeywords: string[] = [];
  let maxSeverity = 0;

  for (const [severity, keywords] of Object.entries(crisisKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        foundKeywords.push(keyword);
        if (severity === 'high') maxSeverity = Math.max(maxSeverity, 3);
        else if (severity === 'medium') maxSeverity = Math.max(maxSeverity, 2);
        else maxSeverity = Math.max(maxSeverity, 1);
      }
    }
  }

  return {
    isCrisis: maxSeverity > 0,
    severity: maxSeverity,
    keywords: foundKeywords
  };
};

// Mental health assessment scoring
export const assessMentalHealth = (responses: { [key: string]: number }): {
  phq9Score?: number;
  gad7Score?: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'severe';
  recommendations: string[];
} => {
  let phq9Score = 0;
  let gad7Score = 0;
  const recommendations: string[] = [];

  // PHQ-9 scoring (if available)
  if (responses.phq9) {
    phq9Score = responses.phq9;
    if (phq9Score >= 20) {
      recommendations.push('Consider immediate professional help');
    } else if (phq9Score >= 15) {
      recommendations.push('Moderate to severe depression - professional help recommended');
    } else if (phq9Score >= 10) {
      recommendations.push('Mild to moderate depression - consider counseling');
    }
  }

  // GAD-7 scoring (if available)
  if (responses.gad7) {
    gad7Score = responses.gad7;
    if (gad7Score >= 15) {
      recommendations.push('Severe anxiety - professional help recommended');
    } else if (gad7Score >= 10) {
      recommendations.push('Moderate anxiety - consider stress management techniques');
    }
  }

  // Determine overall risk level
  let riskLevel: 'low' | 'moderate' | 'high' | 'severe' = 'low';
  
  if (phq9Score >= 20 || gad7Score >= 15) {
    riskLevel = 'severe';
  } else if (phq9Score >= 15 || gad7Score >= 10) {
    riskLevel = 'high';
  } else if (phq9Score >= 10 || gad7Score >= 5) {
    riskLevel = 'moderate';
  }

  return {
    phq9Score,
    gad7Score,
    riskLevel,
    recommendations
  };
};
