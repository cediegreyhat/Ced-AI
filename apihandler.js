// Get DOM elements
const form = document.querySelector('#message-form');
const messageInput = document.querySelector('#message-input');
const chatBox = document.querySelector('#chat-box');

// Function to display a chat message
function displayChatMessage(text, isUser) {
  const div = document.createElement('div');
  div.innerText = text;
  div.classList.add('chat-message');
  if (isUser) {
    div.classList.add('user-message');
    div.classList.remove('chat-message');
  }
  chatBox.appendChild(div);
}

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
    const response = await axios.post('https://rose-repulsive-indri.cyclic.app/api/message', { message });

    // Display response in chat box
    const text = response.data.text;
    displayChatMessage(text, false);

  } catch (error) {
    console.error(error);
    alert('An error occurred. Please try again later.');
  }
});

// Function to initialize the chat
async function initChat() {
  try {
    // Send a welcome message to the API
    const response = await axios.post('https://rose-repulsive-indri.cyclic.app/api/message', { message: 'hi' });

    // Display the response in the chat box
    const text = response.data.text;
    displayChatMessage(text, false);

  } catch (error) {
    console.error(error);
    alert('An error occurred. Please try again later.');
  }
}

// Initialize the chat when the page loads
initChat();
