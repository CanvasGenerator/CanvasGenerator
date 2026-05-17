/**
 * AI Assistant Module (Floating Bot Version)
 * Handles conversational recommendations in a floating widget.
 */
export function initAiAssistant(editor) {
    const chatInput = document.getElementById('ai-chat-input');
    const btnSend = document.getElementById('btn-send-ai');
    const messagesContainer = document.getElementById('ai-chat-messages');
    
    // Toggle elements
    const btnToggle = document.getElementById('btn-toggle-ai-bot');
    const btnClose = document.getElementById('btn-close-ai-bot');
    const botPanel = document.getElementById('ai-bot-panel');

    if (!btnSend || !chatInput || !btnToggle) return;

    // Toggle Logic
    btnToggle.onclick = () => {
        botPanel.classList.toggle('hidden');
        if (!botPanel.classList.contains('hidden')) {
            chatInput.focus();
        }
    };

    btnClose.onclick = () => {
        botPanel.classList.add('hidden');
    };

    btnSend.onclick = () => handleSendMessage();
    chatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    async function handleSendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // User message
        appendMessage('user', text);
        chatInput.value = '';

        // Bot thinking
        const thinkingId = appendMessage('bot', '<i class="fas fa-spinner fa-spin"></i> Je réfléchis...');

        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: text, 
                    schoolId: window.CURRENT_SCHOOL?.id,
                    context: 'floating_bot'
                })
            });
            const data = await res.json();
            
            updateMessage(thinkingId, data.text);
        } catch (e) {
            console.error(e);
            updateMessage(thinkingId, "Désolé, je rencontre une petite difficulté technique. Pouvez-vous réessayer ?");
        }
    }

    function appendMessage(sender, text) {
        const id = 'msg-' + Date.now();
        const msg = document.createElement('div');
        msg.className = `ai-msg ${sender}`;
        msg.id = id;
        msg.innerHTML = text;
        messagesContainer.appendChild(msg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function updateMessage(id, text) {
        const msg = document.getElementById(id);
        if (msg) {
            msg.innerHTML = text;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}
