// OpenAI SDK v6+ - handle both default and named exports
const openaiModule = require('openai');
const OpenAI = openaiModule.default || openaiModule.OpenAI || openaiModule;
const { supabase } = require('../utils/supabase');

// Initialize OpenAI client
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI client initialized');
  } else {
    console.warn('⚠️  OpenAI API key not configured. AI Assistant will not work.');
    console.warn('   Set OPENAI_API_KEY environment variable to enable AI Assistant.');
  }
} catch (err) {
  console.error('❌ Failed to initialize OpenAI client:', err.message);
}

/**
 * POST /api/ai-assistant/analyze
 * Analyze a job request and provide AI suggestions
 */
exports.analyzeJobRequest = async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: 'AI Assistant is not available',
        message: 'OpenAI API key is not configured. Please set OPENAI_API_KEY in environment variables.',
      });
    }

    const { issueDescription, vehicleType, jobId } = req.body;

    if (!issueDescription) {
      return res.status(400).json({ error: 'Issue description is required' });
    }

    // Create AI prompt for mechanic-friendly analysis
    const systemPrompt = `You are an expert automotive mechanic assistant. Your role is to help mechanics diagnose vehicle problems based on user descriptions. 

Provide:
1. Probable causes (most likely to least likely)
2. Required tools for diagnosis/repair
3. Estimated repair steps (brief, numbered)
4. Translate user-friendly description to technical mechanic terms

Be concise, practical, and professional. Focus on actionable information.`;

    const userPrompt = `Vehicle Type: ${vehicleType || 'Not specified'}
User Description: "${issueDescription}"

Provide:
1. **Probable Causes** (list 3-5 most likely causes)
2. **Required Tools** (list essential tools needed)
3. **Repair Steps** (brief numbered steps)
4. **Technical Translation** (translate to mechanic terminology)`;

    // Call OpenAI API
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
        throw new Error('Invalid response from OpenAI API: missing completion data');
      }
    } catch (apiError) {
      console.error('OpenAI API call failed:', {
        message: apiError.message,
        status: apiError.status || apiError.statusCode,
        response: apiError.response?.data || apiError.error,
        code: apiError.code,
        type: apiError.type,
        fullError: JSON.stringify(apiError, Object.getOwnPropertyNames(apiError)),
      });
      throw apiError;
    }

    const aiResponse = completion.choices[0].message.content;

    // Parse the response into structured format
    const analysis = parseAIResponse(aiResponse);

    // Log the AI usage (optional - for tracking costs)
    if (jobId) {
      try {
        await supabase.from('ai_assistant_logs').insert({
          job_id: jobId,
          issue_description: issueDescription,
          vehicle_type: vehicleType,
          ai_response: aiResponse,
          tokens_used: completion.usage?.total_tokens || 0,
        }).select().single();
      } catch (logError) {
        // Non-critical - just log the error
        console.warn('Failed to log AI usage:', logError);
      }
    }

    return res.json({
      success: true,
      analysis,
      rawResponse: aiResponse,
      tokensUsed: completion.usage?.total_tokens || 0,
    });
  } catch (error) {
    console.error('AI Assistant error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code,
      type: error.type,
    });
    
    // Check if OpenAI API key is missing
    if (error.message && (error.message.includes('API key') || error.message.includes('apiKey'))) {
      return res.status(503).json({
        success: false,
        error: 'AI Assistant is not available',
        message: 'OpenAI API key is not configured or invalid. Please set OPENAI_API_KEY in environment variables.',
      });
    }
    
    // Handle OpenAI API errors - OpenAI SDK v6+ error structure
    // OpenAI errors can have status/statusCode directly or in error.response
    const statusCode = error.status || error.statusCode || error.response?.status || 500;
    const errorData = error.error || error.response?.data?.error || error.response?.data || {};
    const errorMessage = errorData.message || error.message || 'Failed to get AI response';
    
    // Handle specific OpenAI errors (429 = quota exceeded)
    if (statusCode === 429) {
      return res.status(429).json({
        success: false,
        error: 'OpenAI API Quota Exceeded',
        message: 'You exceeded your current quota, please check your plan and billing details. ' + errorMessage,
        details: 'For more information, see: https://platform.openai.com/docs/guides/error-codes/api-errors',
      });
    }
    
    if (statusCode === 401) {
      return res.status(401).json({
        success: false,
        error: 'OpenAI API Authentication Failed',
        message: 'Invalid API key. Please check your OPENAI_API_KEY.',
      });
    }
    
    // If we have a response with status, return that status code
    if (error.response || error.status || error.statusCode) {
      return res.status(statusCode).json({
        success: false,
        error: 'OpenAI API Error',
        message: errorMessage,
        code: errorData.code || error.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
    
    // Handle other errors (network, timeout, etc.)
    return res.status(500).json({
      success: false,
      error: 'AI Assistant Error',
      message: error.message || 'Failed to analyze job request',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Helper function to parse AI response into structured format
 */
function parseAIResponse(response) {
  const analysis = {
    probableCauses: [],
    requiredTools: [],
    repairSteps: [],
    technicalTranslation: '',
  };

  // Try to extract structured information
  const lines = response.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;

    // Detect sections
    if (trimmed.toLowerCase().includes('probable cause') || trimmed.toLowerCase().includes('**probable cause')) {
      currentSection = 'causes';
      continue;
    }
    if (trimmed.toLowerCase().includes('required tool') || trimmed.toLowerCase().includes('**required tool')) {
      currentSection = 'tools';
      continue;
    }
    if (trimmed.toLowerCase().includes('repair step') || trimmed.toLowerCase().includes('**repair step')) {
      currentSection = 'steps';
      continue;
    }
    if (trimmed.toLowerCase().includes('technical') || trimmed.toLowerCase().includes('**technical')) {
      currentSection = 'translation';
      continue;
    }

    // Extract content based on section
    if (currentSection === 'causes') {
      // Look for list items (numbered or bulleted)
      const causeMatch = trimmed.match(/^[-*\d+\.]\s*(.+)/i);
      if (causeMatch) {
        analysis.probableCauses.push(causeMatch[1].trim());
      }
    } else if (currentSection === 'tools') {
      const toolMatch = trimmed.match(/^[-*\d+\.]\s*(.+)/i);
      if (toolMatch) {
        analysis.requiredTools.push(toolMatch[1].trim());
      }
    } else if (currentSection === 'steps') {
      const stepMatch = trimmed.match(/^[-*\d+\.]\s*(.+)/i);
      if (stepMatch) {
        analysis.repairSteps.push(stepMatch[1].trim());
      }
    } else if (currentSection === 'translation') {
      if (!trimmed.startsWith('**') && !trimmed.startsWith('#')) {
        analysis.technicalTranslation += (analysis.technicalTranslation ? ' ' : '') + trimmed;
      }
    }
  }

  // If parsing didn't work well, provide the raw response
  if (analysis.probableCauses.length === 0 && analysis.requiredTools.length === 0) {
    analysis.rawResponse = response;
  }

  return analysis;
}

