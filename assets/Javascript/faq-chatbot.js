/**
 * Fusion FAQ AI Chatbot
 * Handles chat interactions with the Groq-powered AI assistant
 */

(function () {
    'use strict';

    const API_ENDPOINT = '/api/chat';
    const CHAT_STORAGE_KEY = 'fusion_chat_history';
    let chatHistory = [];
    let isTyping = false;

    // DOM Elements
    // DOM Elements
    const chatToggleBtn = document.getElementById('faq-chat-toggle');
    const headerAiBtn = document.getElementById('header-ai-btn');
    const mobileHeaderAiBtn = document.getElementById('mobile-header-ai-btn');
    const chatContainer = document.getElementById('faq-chat-container');
    const chatMessages = document.getElementById('faq-chat-messages');
    const chatInput = document.getElementById('faq-chat-input');
    const chatSendBtn = document.getElementById('faq-chat-send');
    const chatCloseBtn = document.getElementById('faq-chat-close');
    const chatClearBtn = document.getElementById('faq-chat-clear');
    const chatConfirmOverlay = document.getElementById('chat-confirm-overlay');
    const chatConfirmOk = document.getElementById('chat-confirm-ok');
    const chatConfirmCancel = document.getElementById('chat-confirm-cancel');
    const suggestionBtns = document.querySelectorAll('.faq-suggestion-btn');

    if (!chatContainer) return;

    // Initialize
    function init() {
        chatToggleBtn?.addEventListener('click', toggleChat);
        headerAiBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            toggleChat();
        });
        mobileHeaderAiBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            toggleChat();
        });

        chatCloseBtn?.addEventListener('click', closeChat);
        chatClearBtn?.addEventListener('click', showClearConfirmation);
        chatConfirmOk?.addEventListener('click', confirmClearChat);
        chatConfirmCancel?.addEventListener('click', hideClearConfirmation);
        chatSendBtn?.addEventListener('click', sendMessage);
        chatInput?.addEventListener('keypress', handleKeyPress);

        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                if (question) {
                    chatInput.value = question;
                    sendMessage();
                }
            });
        });



        // Load history if cookies accepted
        if (localStorage.getItem('cookie-consent') === 'accepted') {
            const savedHistory = localStorage.getItem(CHAT_STORAGE_KEY);
            if (savedHistory) {
                try {
                    const parsed = JSON.parse(savedHistory);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        chatHistory = parsed;
                        // Render history without animation
                        chatHistory.forEach(msg => {
                            addMessage(msg.content, msg.role, false, false);
                        });
                    }
                } catch (e) {
                    console.error('Failed to load chat history:', e);
                }
            }
        }
    }

    function saveChatHistory() {
        if (localStorage.getItem('cookie-consent') === 'accepted') {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
        }
    }

    function showClearConfirmation() {
        if (!chatConfirmOverlay) return;
        chatConfirmOverlay.classList.remove('hidden');
        // Small delay to allow 'hidden' to be removed before adding opacity
        setTimeout(() => {
            chatConfirmOverlay.classList.remove('opacity-0', 'scale-95');
        }, 10);
    }

    function hideClearConfirmation() {
        if (!chatConfirmOverlay) return;
        chatConfirmOverlay.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            chatConfirmOverlay.classList.add('hidden');
        }, 300);
    }

    function confirmClearChat() {
        chatHistory = [];
        localStorage.removeItem(CHAT_STORAGE_KEY);
        chatMessages.innerHTML = '';
        addMessage('Hello! 👋 I\'m your Fusion Website Assistant. Ask me about our collections, products, or store policies!', 'assistant');
        hideClearConfirmation();
    }

    function toggleChat() {
        chatContainer.classList.toggle('open');
        chatToggleBtn?.classList.toggle('active');

        if (chatContainer.classList.contains('open')) {
            chatInput?.focus();
            // Add welcome message if first time
            if (chatMessages.children.length === 0) {
                addMessage('Hello! 👋 I\'m your Fusion Website Assistant. Ask me about our collections, products, or store policies!', 'assistant');
            }
        }
    }

    function closeChat() {
        chatContainer.classList.remove('open');
        chatToggleBtn.classList.remove('active');
    }

    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    async function sendMessage() {
        const message = chatInput?.value.trim();
        if (!message || isTyping) return;

        // Add user message
        addMessage(message, 'user');
        chatInput.value = '';

        // Add to history
        chatHistory.push({ role: 'user', content: message });
        saveChatHistory();

        // Show typing indicator
        showTypingIndicator();

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: chatHistory
                })
            });

            hideTypingIndicator();

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            const aiMessage = data.message;

            // Add AI response
            addMessage(aiMessage, 'assistant');
            chatHistory.push({ role: 'assistant', content: aiMessage });
            saveChatHistory();

        } catch (error) {
            hideTypingIndicator();
            console.error('Chat error:', error);
            addMessage('Oops! Something went wrong. Please try again or check out our FAQ section above! 💫', 'assistant', true);
        }
    }

    function addMessage(content, role, isError = false, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `faq-chat-message ${role}${isError ? ' error' : ''}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = content;

        messageDiv.appendChild(bubble);
        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Animate in
        // Animate in
        if (animate) {
            requestAnimationFrame(() => {
                messageDiv.classList.add('visible');
            });
        } else {
            messageDiv.classList.add('visible');
        }

    }

    function showTypingIndicator() {
        isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'faq-chat-message assistant typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-bubble">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        requestAnimationFrame(() => {
            typingDiv.classList.add('visible');
        });
    }

    function hideTypingIndicator() {
        isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
