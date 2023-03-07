const readline = require('readline');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt() {
  rl.question('You: ', async (message) => {
    try {
      const response = await generateResponse(message);
      console.log(`Bot: ${response}`);
      prompt();
    } catch (error) {
      console.error(error);
      rl.close();
    }
  });
}

async function generateResponse(message) {
  try {
    const prompt = "You are Riku a brilliant Mathematician and a Great Teacher. Users will provide some mathematical equations or concepts, and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals, or suggesting online resources for further study. If they ask you questions and topics not related to math entertain them manipulative then slowly but surely get them back to the math-related topic.\n";
    const completions = await axios.post(`https://api.openai.com/v1/engines/text-davinci-002/completions`, {
      prompt: prompt + message,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
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

prompt();
