const form = document.querySelector('form');
const input = document.querySelector('input');
const output = document.querySelector('#output');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  output.innerHTML = '<div class="console-input">$ ' + input.value + '</div>';
  
  try {
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input.value })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate response.');
    }
    
    const data = await response.json();
    const outputText = data.response;
    
    output.innerHTML += '<div class="console-output">' + outputText + '</div>';
    input.value = '';
  } catch (error) {
    output.innerHTML += '<div class="console-error">' + error.message + '</div>';
  }
});
