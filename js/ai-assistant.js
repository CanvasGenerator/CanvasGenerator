/**
 * AI Assistant Module (ChatGPT Style Version)
 * Handles conversational recommendations with history threads.
 */
export function initAiAssistant(editor) {
    const chatInput = document.getElementById('ai-chat-input');
    const btnSend = document.getElementById('btn-send-ai');
    const messagesContainer = document.getElementById('ai-chat-messages');
    const conversationsList = document.getElementById('ai-conversations-list');
    const btnNewChat = document.getElementById('btn-new-chat');
    
    // Toggle elements
    const btnToggle = document.getElementById('btn-toggle-ai-bot');
    const btnClose = document.getElementById('btn-close-ai-bot');
    const botPanel = document.getElementById('ai-bot-panel');

    let currentConversationId = 'chat_' + Date.now();
    let allMessages = [];

    if (!btnSend || !chatInput || !btnToggle) return;

    // Load History when the bot is initialized
    setTimeout(() => {
        const schoolId = window.CURRENT_SCHOOL?.id;
        if (schoolId) {
            loadHistory(schoolId);
        }
    }, 1000);

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

    btnNewChat.onclick = () => {
        currentConversationId = 'chat_' + Date.now();
        messagesContainer.innerHTML = `
            <div class="ai-msg bot">Bonjour ! 👋<br>Je suis votre assistant IA Reetain. De quoi avez-vous besoin pour cette nouvelle discussion ?</div>
        `;
        // Remove active class from list
        document.querySelectorAll('.ai-conv-item').forEach(item => item.classList.remove('active'));
    };

    async function loadHistory(schoolId) {
        try {
            const res = await fetch(`/api/ai/history?schoolId=${schoolId}`);
            allMessages = await res.json();
            
            renderConversationsList();
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
    }

    function renderConversationsList() {
        if (!conversationsList) return;
        conversationsList.innerHTML = '';

        // Group messages by conversation_id (we use project_id column for this)
        const groups = {};
        allMessages.forEach(msg => {
            const convId = msg.project_id || 'default';
            if (!groups[convId]) {
                groups[convId] = [];
            }
            groups[convId].push(msg);
        });

        // Render each group as a thread
        Object.keys(groups).forEach(convId => {
            const firstMsg = groups[convId].find(m => m.sender === 'user');
            const title = firstMsg ? firstMsg.message : 'Discussion sans titre';
            
            const item = document.createElement('div');
            item.className = 'ai-conv-item';
            item.title = title;
            item.innerHTML = `<i class="far fa-comment"></i> ${title}`;
            
            item.onclick = () => {
                currentConversationId = convId;
                document.querySelectorAll('.ai-conv-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                renderMessages(groups[convId]);
            };
            
            conversationsList.appendChild(item);
        });
    }

    function renderMessages(messages) {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            appendMessage(msg.sender, msg.message);
        });
    }

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
                    context: 'floating_bot',
                    projectId: currentConversationId // We pass the thread ID here
                })
            });
            const data = await res.json();
            
            updateMessage(thinkingId, data.text);
            
            // Add to local history and refresh list if it's a new conversation
            allMessages.push({ sender: 'user', message: text, project_id: currentConversationId });
            allMessages.push({ sender: 'bot', message: data.text, project_id: currentConversationId });
            renderConversationsList();
            
        } catch (e) {
            console.error(e);
            updateMessage(thinkingId, "Désolé, je rencontre une petite difficulté technique. Pouvez-vous réessayer ?");
        }
    }

    function formatMarkdown(text) {
        if (!text) return '';
        
        // Return loader as is
        if (text.includes('fa-spin') || text.includes('fa-spinner')) {
            return text;
        }

        // Escape HTML to prevent XSS
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold: **text** -> <strong>text</strong>
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Lists: Convert lines starting with "* " or "- " into list items
        const lines = html.split('\n');
        let inList = false;
        const formattedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                const content = trimmed.substring(2);
                let prefix = '';
                if (!inList) {
                    inList = true;
                    prefix = '<ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">';
                }
                return `${prefix}<li style="margin-bottom: 4px;">${content}</li>`;
            } else {
                let suffix = '';
                if (inList) {
                    inList = false;
                    suffix = '</ul>';
                }
                return suffix + line;
            }
        });

        if (inList) {
            formattedLines.push('</ul>');
        }

        return formattedLines.join('\n');
    }

    function appendMessage(sender, text) {
        const id = 'msg-' + Date.now();
        const msg = document.createElement('div');
        msg.className = `ai-msg ${sender}`;
        msg.id = id;
        msg.innerHTML = formatMarkdown(text);
        messagesContainer.appendChild(msg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function updateMessage(id, text) {
        const msg = document.getElementById(id);
        if (msg) {
            msg.innerHTML = formatMarkdown(text);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}
