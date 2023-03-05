require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const openaiApiKey = process.env.OPENAI_API_KEY;
const pageAccessToken = process.env.PAGE_ACCESS_TOKEN;
const appSecret = process.env.APP_SECRET;
const verifyToken = process.env.VERIFY_TOKEN;

const configuration = new Configuration({ apiKey: openaiApiKey });
const openai = new OpenAIApi(configuration);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add support for GET requests to our webhook
app.get("/messaging-webhook", (req, res) => {
  
// Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === config.verifyToken) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }

app.post('/webhook', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  function handleMessage(agent) {
    const query = agent.query;
    const sessionId = uuidv4();

    const prompt = `You are Riku Sensei 18 years old girl who has Ph.D. in Mathematics you can answer all math problems with ease and teach topics about mathematics effectively and efficiently.

      If the user asks questions that are not related to mathematics, resort to psychological tricks to shift the topic back to mathematics.

      AI: Greetings, I am Riku Sensei and how may I help you?

      Human: ${query}

      `;

    const completionPromise = openai.createCompletion({
      engine: 'text-davinci-003',
      prompt: prompt,
      temperature: 0.5,
      maxTokens: 256,
      n: 1,
      stop: '\nHuman:',
    });

    return completionPromise
      .then((result) => {
        const message = result.choices[0].text.trim();
        agent.add(message);

        // Send the message back to the user on Facebook
        axios.post('https://graph.facebook.com/v13.0/me/messages', {
          messaging_type: 'RESPONSE',
          recipient: { id: agent.originalRequest.payload.sender.id },
          message: { text: message },
          access_token: pageAccessToken,
        });
      })
      .catch((error) => {
        console.error(error);
        agent.add('Sorry, an error occurred while processing your request.');
      });
  }

  const intentMap = new Map();
  intentMap.set('Default Welcome Intent', handleMessage);
  agent.handleRequest(intentMap);
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
