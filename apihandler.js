require('dotenv').config();
const express = require('express');
const { createApi } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const openai = createApi(process.env.OPENAI_API_KEY);

// Generate a response using OpenAI
async function generateResponse(message) {
  try {
    const prompt = "You are Riku a brilliant Mathematician and a Great Teacher. Users will provide some mathematical equations or concepts, and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals, or suggesting online resources for further study. If they ask you questions and topics not related to math entertain them manipulative then slowly but surely get them back to the math-related topic.\n";
    const completions = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt + message,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (!completions || completions.status !== 200 || !completions.data || !completions.data.choices) {
      console.log('OpenAI API response:', completions);
      throw new Error('Failed to generate response.');
    }

    const responseText = completions.data.choices[0].text.trim();

    console.log('Generated response:', responseText);

    return responseText;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to generate response.');
  }
}

app.use(express.static('public'));

app.get('/api', async (req, res) => {
  const message = req.query.message;

  console.log('Received message:', message);

  try {
    const response = await generateResponse(message);
    res.send(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to generate response');
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
