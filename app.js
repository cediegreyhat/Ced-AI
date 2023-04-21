const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");
const { promisify } = require('util');






const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

require('dotenv').config();

const app = express();

openai.apiKey = process.env.OPENAI_API_KEY;

// Log all calls and request for debugging
app.use((req, res, next) => {
  console.log('Received request:', req.method, req.url, req.body);
  const originalSend = res.send;
  res.send = function (body) {
    console.log('Sending response:', res.statusCode, body);
    originalSend.call(res, body);
  };
  next();
});

// Use Index.html as a default landing page
app.get('/', function(req, res){
    res.sendFile('index.html', { root: __dirname + "/" } );
});

// CORS to pass the Access Control Check
app.use(cors({
  origin: 'https://lmao-hahaxd.cyclic.app'
}));

// If the request is from facebook Verify it
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers['x-hub-signature'];

  // Check if the request is not coming from Facebook
  if (req.headers['user-agent'] !== 'facebookexternalhit/1.1') {
    return;
  }

  if (!signature) {
    throw new Error('Signature not present in request headers');
  }

  const [algorithm, signatureHash] = signature.split('=');
  const expectedHash = crypto.createHmac(algorithm, process.env.APP_SECRET)
    .update(buf)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signatureHash), Buffer.from(expectedHash))) {
    throw new Error('Could not validate the request signature.');
  }
}

// Use the body-parser middleware and verify request signature
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Caching for faster processing
const cache = {};

// Webhook for receiving messages from Facebook Messenger
app.post('/webhook', async (req, res) => {
  try {
    const { object, entry: entries, standby } = req.body;

    // Function to check if a message is from the user
    const isUserMessage = (message) => {
      return message.message && message.message.text && !message.message.is_echo;
    }

    // Function to request thread ownership for a conversation
    const requestThreadOwnership = async (recipientId) => {
      try {
        const response = await axios.post(
          `https://graph.facebook.com/v16.0/me/take_thread_control?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
          {
            recipient: {
              id: recipientId,
            },
            metadata: 'Requesting thread ownership for standby event',
          }
        );
        console.log('Requested thread ownership:', response.data);
      } catch (error) {
        console.error('Error requesting thread ownership:', error);
      }
    }

    // Check if the request is a standby event
    if (object === 'page' && standby) {
      console.log('Received standby event:', standby);

      // Check if there are user queries/questions in the standby event
      if (standby.some(isUserMessage)) {
        const userMsg = standby.find(isUserMessage).message.text;
        const userId = standby[0].sender.id;

        // Request thread ownership for the conversation
        await requestThreadOwnership(userId);

        // Check cache for previous response
        if (cache[userId] && cache[userId].msg === userMsg) {
          console.log('Response found in cache:', cache[userId].response);
          await sendResponse(userId, cache[userId].response);
        } else {
          // Get user message and send it to ChatGPT for processing
          const response = await generateResponse(userMsg);

          // Send response back to user via Facebook Messenger API
          await sendResponse(userId, response);

          // Store response in cache
          cache[userId] = { msg: userMsg, response };
          console.log('Sent response to standby event.');
        }
      } else {
        res.sendStatus(200);
        console.log('No user query/message found in the standby event.');
      }
    }
    // Check if the request is a regular message event or a message in standby channel
    else if (object === 'page' && entries) {
      const messaging = entries[0].messaging;

      // Add a check to make sure that messaging exists and is an array.
      if (Array.isArray(messaging)) {
        await Promise.all(messaging.map(async (message) => {
          if (isUserMessage(message)) {
            const userMsg = message.message.text;
            const userId = message.sender.id;

            // Check cache for previous response
            if (cache[userId] && cache[userId].msg === userMsg) {
              console.log('Response found in cache:', cache[userId].response);
              await sendResponse(userId, cache[userId].response);
            } else {
              // Get user message and send it to ChatGPT for processing
              const response = await generateResponse(userMsg);

              // Send response back to user via Facebook Messenger API
              await sendResponse(userId, response);

              // Store response in cache
              cache[userId] = { msg: userMsg, response };
            }
          }
        }));
      }
      res.sendStatus(200);
    }
    else {
      res.sendStatus(404);
      return;
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// API Endpoint for OpenAI Communication
app.post('/api/message', async (req, res) => {
  try {
    const { message } = req.body.object || {};

    // Check if message is present in request body
    if (!message) {
      return res.status(400).json({ error: 'Message is missing from request body.' });
    }

    // Validate message
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid message format.' });
    }

    // Generate response
    const response = await generateResponse(message);

    res.json({ success: true, response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

// Define a global variables
let conversationHistory = "";
const stopwords = ['a', 'an', 'the', 'in', 'on', 'at', 'to', 'of', 'for', 'with', 'is', 'are'];

// Generate responses using OpenAI
async function generateResponse(message, conversationHistory) {
  try {
    // Define the prompt for OpenAI API
    const prompt = "Act as Reco, you are a friendly and enthusiastic mathematical assistant. Your goal is to answer Grade 10 Mathematical problems with accuracy and reliability . You should focus on topics covered in the K-12 curriculum, specifically Grade 10 mathematics lessons.\n\nIf the questions falls outside the scope of Grade 10 mathematics, then respectfully decline to answer and ask for another response. Take note that if the questions are greetings, then reply with a greeting.\n\nMake sure to analyze the queries carefully. Pay attention to entry and exit words in the query of the respondent to improve the conversation flow and make the conversation Human-Like as possible.\n\n";

    // Check if user input is a greeting
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const isGreeting = greetings.some(greeting => message.toLowerCase().includes(greeting));

    // Check if user input contains a math-related question
    const mathRelatedKeywords = ['solve', 'calculate', 'what is', 'how many', 'how much', 'equation', 'expression', 'formula'];
    const isMathRelated = mathRelatedKeywords.some(keyword => message.toLowerCase().includes(keyword));

    // Generate response using OpenAI API
    const completions = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt + (isGreeting ? '' : message),
      temperature: 0.5,
      max_tokens: isGreeting ? 1000 : (isMathRelated ? 500 : 1000),
      top_p: 1,
      frequency_penalty: 0.05,
      presence_penalty: 0.05,
    });

    // Check if API response is valid
    if (!completions || completions.status !== 200 || !completions.data || !completions.data.choices || !completions.data.choices[0]) {
      console.log('OpenAI API response:', completions);
      throw new Error(`Failed to generate response. Status: ${completions.status}. Data: ${JSON.stringify(completions.data)}`);
    }

    // Extract response text from API response
    const responseText = completions.data.choices[0].text.trim();

    // If response is a greeting, add a personalized message
    if (isGreeting) {
      const personalizedGreeting = `Hello! I'm ReCo, your math teacher. How can I assist you with your math questions today?`;
      return personalizedGreeting;
    }

    // If response is not related to math, ask for clarification
    if (!isMathRelated) {
      const clarificationMessage = `I'm sorry, I didn't quite catch that. Could you please rephrase your question or provide more details?`;
      return clarificationMessage;
    }

    return responseText;
  } catch (error) {
    console.error(error);
    if (error.response) {
      throw new Error(`Failed to generate response. Status: ${error.response.status}. Data: ${JSON.stringify(error.response.data)}`);
    } else {
      throw new Error('Failed to generate response. Please try again later.');
    }
  }
}

// Send response back to user via Facebook Messenger API
async function sendResponse(recipientId, response) {
  try {
    // Check if recipient ID is valid
    const recipientResponse = await axios.get(`https://graph.facebook.com/v16.0/${recipientId}?fields=name&access_token=${process.env.PAGE_ACCESS_TOKEN}`);
    if (recipientResponse.status !== 200 || !recipientResponse.data.name) {
      console.log(`Invalid recipient ID: ${recipientId}`);
      return;
    }

    // Send message
    const messageResponse = await axios.post(`https://graph.facebook.com/v16.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, {
      messaging_type: 'RESPONSE',
      recipient: {
        id: recipientId,
      },
      message: {
        text: response,
      },
    });

    return messageResponse.data;
  } catch (error) {
    console.error(`Error sending message: ${error}`);
  }
}

   
// Start the server
app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening!'));
