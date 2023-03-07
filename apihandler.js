// Get DOM elements
const form = document.querySelector('#message-form');
const messageInput = document.querySelector('#message-input');
const chatBox = document.querySelector('#chat-box');

// Event listener for form submission
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = messageInput.value;
  messageInput.value = '';

  if (!message) {
    return;
  }

  try {
    // Send message to API
    const response = await axios.post('https://your-api-url.com/messages', { message });

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
