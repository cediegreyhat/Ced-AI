form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = messageInput.value;
  messageInput.value = '';

  if (!message) {
    return;
  }

  try {
    const response = await axios.post('/api/message', { message });
    const text = response.data.text;

    // create the user message div
    const userMessageDiv = document.createElement('div');
    userMessageDiv.innerText = message;
    userMessageDiv.classList.add('user-message');
    chatBox.appendChild(userMessageDiv);

    // create the AI response div
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.innerText = text;
    aiMessageDiv.classList.add('chat-message');
    chatBox.appendChild(aiMessageDiv);

    // scroll to the bottom of the chat box
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (error.response.status === 401) {
        alert('You are not authorized to perform this action.');
      } else if (error.response.status === 404) {
        alert('The resource you are trying to access could not be found.');
      } else {
        alert('An error occurred. Please try again later.');
      }
    } else if (error.request) {
      // The request was made but no response was received
      alert('No response received from the server. Please try again later.');
    } else {
      // Something else happened while setting up the request
      alert('An error occurred. Please try again later.');
    }
  }
});
