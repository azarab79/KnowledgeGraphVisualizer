const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const router = express.Router();

module.exports = function(driver) {
  const HISTORY_DIR = path.join(__dirname, '..', 'data', 'chat_history');

  // Ensure history directory exists
  const ensureHistoryDir = async () => {
    try {
      await fs.access(HISTORY_DIR);
    } catch (error) {
      await fs.mkdir(HISTORY_DIR, { recursive: true });
    }
  };
  ensureHistoryDir().catch(console.error);

  // Helper to generate a unique ID
  const generateId = () => crypto.randomBytes(8).toString('hex');

  // POST /api/chat/message
  // Receives a message from the user, processes it, and returns a response.
  router.post('/message', async (req, res, next) => {
    console.log('Received POST /api/chat/message');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Content-Type:', req.headers['content-type']);

    const { message, history } = req.body;

    if (!message) {
      console.log('Error: Message is required');
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      // Call the Python QA pipeline directly
      const result = await callPythonQAPipeline(message, history);
      
      const responseMessage = {
        role: 'assistant',
        content: result.answer,
        timestamp: new Date().toISOString(),
        // Include source documents if available
        sourceDocuments: result.source_documents || [],
        // Include source nodes if available
        sourceNodes: result.source_nodes || []
      };

      res.json({
        response: responseMessage,
        updatedHistory: [...(history || []), 
          { role: 'user', content: message, timestamp: new Date().toISOString() }, 
          responseMessage
        ]
      });
    } catch (error) {
      console.error('Error calling Python QA pipeline:', error);
      
      // Fallback to a basic response if the Python service fails
      const fallbackMessage = {
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your question right now. The knowledge graph system is temporarily unavailable. Please try again in a moment.',
        timestamp: new Date().toISOString(),
        sourceDocuments: [],
        sourceNodes: []
      };

      res.json({
        response: fallbackMessage,
        updatedHistory: [...(history || []), 
          { role: 'user', content: message, timestamp: new Date().toISOString() }, 
          fallbackMessage
        ]
      });
    }
  });

  // Function to call the Python QA pipeline using the simple script
  async function callPythonQAPipeline(question, history = []) {
    return new Promise((resolve, reject) => {
      // Use the simple Python script approach
      const scriptPath = path.resolve('..', 'graphiti_hybrid_search.py');
      
      const scriptArgs = [
        scriptPath,
        question,
        '--uri', process.env.NEO4J_URI,
        '--user', process.env.NEO4J_USER,
        '--password', process.env.NEO4J_PASSWORD,
        '--database', process.env.NEO4J_DATABASE || 'neo4j'
      ];

      // Execute the Python script with the question and connection details as arguments
      const pythonProcess = spawn('python3', scriptArgs, {
        cwd: path.resolve('..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
            ...process.env, // Inherit parent process environment for other things like PATH
            GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        }
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python script error:', errorOutput);
          reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
          return;
        }

        try {
          // Parse the JSON output
          const result = JSON.parse(output.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            // Return the complete result object instead of just the answer
            resolve({
              answer: result.answer || 'I could not generate a response.',
              source_documents: result.source_documents || [],
              source_nodes: result.source_nodes || [],
              kg_success: result.kg_success,
              documents_found: result.documents_found,
              llm_used: result.llm_used
            });
          }
        } catch (parseError) {
          console.error('Failed to parse Python output:', output);
          reject(new Error('Failed to parse response from knowledge graph system'));
        }
      });

      // Set a timeout for the Python process (increased for LLM processing)
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python QA pipeline timed out'));
      }, 120000); // 2 minute timeout for enhanced Graphiti + DeepSeek processing
    });
  }

  // --- New Conversation Management Endpoints ---

  /**
   * GET /api/chat/conversations
   * List all saved conversations
   */
  router.get('/conversations', async (req, res, next) => {
    try {
      const files = await fs.readdir(HISTORY_DIR);
      const conversationFiles = files.filter(file => file.endsWith('.json'));

      const conversations = await Promise.all(
        conversationFiles.map(async (file) => {
          const filePath = path.join(HISTORY_DIR, file);
          const data = await fs.readFile(filePath, 'utf8');
          const conversation = JSON.parse(data);
          return {
            id: conversation.id,
            name: conversation.name || `Conversation from ${new Date(conversation.createdAt).toLocaleString()}`,
            createdAt: conversation.createdAt,
            messageCount: conversation.history.length,
          };
        })
      );

      // Sort by most recently created
      conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json(conversations);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/chat/conversations
   * Create a new conversation
   */
  router.post('/conversations', async (req, res, next) => {
    try {
      const { name } = req.body;
      const id = generateId();
      const createdAt = new Date().toISOString();
      const newConversation = {
        id,
        name: name || `Conversation from ${new Date(createdAt).toLocaleString()}`,
        createdAt,
        history: [{
          role: 'assistant',
          content: 'Welcome! How can I help you with the knowledge graph today?',
          timestamp: createdAt,
        }],
      };

      const filePath = path.join(HISTORY_DIR, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(newConversation, null, 2));

      res.status(201).json(newConversation);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/chat/conversations/:id
   * Retrieve a specific conversation
   */
  router.get('/conversations/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const filePath = path.join(HISTORY_DIR, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const conversation = JSON.parse(data);
      res.json(conversation);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      next(error);
    }
  });

  /**
   * PUT /api/chat/conversations/:id
   * Update (save) a conversation's history
   */
  router.put('/conversations/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { history, name } = req.body;

      // Validate that at least one field is being updated
      if (!history && !name) {
        return res.status(400).json({ error: 'History or name is required for an update.' });
      }

      const filePath = path.join(HISTORY_DIR, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const conversation = JSON.parse(data);

      // Update fields if provided
      if (history && Array.isArray(history)) {
        conversation.history = history;
      }
      if (name) {
        conversation.name = name;
      }
      
      conversation.updatedAt = new Date().toISOString();

      await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));

      res.json({ id, message: 'Conversation updated successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      next(error);
    }
  });
  
  /**
   * DELETE /api/chat/conversations/:id
   * Delete a conversation
   */
  router.delete('/conversations/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const filePath = path.join(HISTORY_DIR, `${id}.json`);
      await fs.unlink(filePath);
      res.status(200).json({ message: 'Conversation deleted successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      next(error);
    }
  });

  // Deprecating old history endpoints
  router.get('/history', (req, res) => {
    res.status(410).json({ error: 'This endpoint is deprecated. Please use /api/chat/conversations.' });
  });

  router.delete('/history', (req, res) => {
    res.status(410).json({ error: 'This endpoint is deprecated. Please use /api/chat/conversations.' });
  });

  return router;
}; 