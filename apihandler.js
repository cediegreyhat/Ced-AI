// Get DOM elements
const form = document.querySelector('#message-form');
const messageInput = document.querySelector('#message-input');
const chatBox = document.querySelector('#chat-box');

// Cache object to store responses
const cache = {};

// Event listener for form submission
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = messageInput.value;
  messageInput.value = '';

  if (!message) {
    return;
  }

  try {
    let response;

    // Check if response is cached
    if (cache[message]) {
      console.log('Using cached response for message:', message);
      response = cache[message];
    } else {
      // Send message to API
      response = await axios.post('https://rose-repulsive-indri.cyclic.app/api/message', { message });
      // Cache the response
      cache[message] = response;
    }

    // Display response in chat box
    const text = response.data.text;
    const div = document.createElement('div');
    div.innerText = text;
    div.classList.add('chat-message');
    chatBox.appendChild(div);

  } catch (error) {
    console.error(error);
    alert('An error occurred. Please try again later.');
  }
});
