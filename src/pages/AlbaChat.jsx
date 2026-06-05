import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    green: '#218848',
};

const ALBA_WELCOME = "Hey! 👋 I'm Alba, your UnityCup assistant. Ask me about scoring rules, the tournament schedule, or how UnityCup works!";

const ALBA_SYSTEM_PROMPT = `You are Alba, the friendly assistant for "UnityCup", a workplace FIFA World Cup 2026 prediction & games app. Answer conversationally, warmly, and concisely. You may use light emojis.

Use ONLY the facts below. If a question is outside this knowledge (e.g. live scores, specific player stats, who will win, or anything not listed here), clearly say you don't have that information — do NOT guess and do NOT give an unrelated answer.

== PRODE (PREDICTIONS) SCORING ==
- Exact score = 5 pts
- Correct winner = 3 pts
- Wrong prediction = 0 pts
Predictions lock the moment a match kicks off. You can predict as many matches as you want and save them all at once. Points are awarded automatically after each match.

== TRIVIA RULES ==
- 5 questions per day
- 30 seconds per question
- Up to 100 points maximum per day
- One attempt per day
Questions cover World Cup history, teams, players, and stats. Trivia score shows on your Profile.

== TOURNAMENT SCHEDULE / STRUCTURE ==
FIFA World Cup 2026 — 48 teams, 104 matches across USA, Canada & Mexico.
- Group Stage: June 11–27
- Round of 32: June 28 – July 3
- Round of 16: July 4–7
- Quarterfinals: July 9–11
- Semifinals: July 14–15
- Third Place: July 18
- Final: July 19

== APP PAGES ==
- 🏠 Home — your stats, predictions & feed preview
- 🎯 Prode — predict match scores before kickoff
- 📊 Standings — group tables & knockout bracket
- 🧠 Trivia — daily quiz games
- 💬 Feed — social posts: share & react with the community
- 👤 Profile — your stats & badges
- 🌍 World Cup — live fixtures, results, standings & news
- 🤖 Alba — that's you, the assistant
- 🏆 Leaderboard — how you rank against other players

== BADGES ==
- 🎯 Perfect Matchday — predict the correct outcome for every match in a matchday. Badges appear on the Profile page.`;

const QUICK_REPLIES = [
    "How does scoring work?",
    "How do I play Trivia?",
    "Show me the app pages",
    "Tournament schedule"
];

async function getAlbaResponse(userMessage, history) {
    const conversation = history
        .filter(m => m.content)
        .map(m => `${m.role === 'user' ? 'User' : 'Alba'}: ${m.content}`)
        .join('\n');

    const prompt = `${ALBA_SYSTEM_PROMPT}\n\n== CONVERSATION SO FAR ==\n${conversation}\n\nUser: ${userMessage}\n\nReply as Alba:`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    return typeof response === 'string' ? response : (response?.response || "Sorry, I couldn't process that.");
}

function AlbaAvatar() {
    return (
        <img
            src="https://media.base44.com/images/public/697e13bb6118f7db732b8054/c94fef301_image.png"
            alt="Alba"
            className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
        />
    );
}

function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    
    useEffect(() => {
        if (!isUser && message.showQuickReplies) {
            setShowQuickReplies(true);
        }
    }, [isUser, message.showQuickReplies]);

    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <AlbaAvatar />}
            
            <div className={`flex flex-col max-w-xs ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className="rounded-xl px-4 py-2.5 text-sm break-words"
                    style={{
                        fontFamily: "'Raleway', sans-serif",
                        background: isUser ? CU.charcoal : 'white',
                        color: isUser ? 'white' : CU.charcoal,
                        border: isUser ? 'none' : `1px solid #e5e7eb`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}
                >
                    {message.content}
                </div>
                
                {showQuickReplies && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {QUICK_REPLIES.map((reply, idx) => (
                            <button
                                key={idx}
                                onClick={() => message.onQuickReply(reply)}
                                className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80"
                                style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    background: CU.orange + '20',
                                    color: CU.orange,
                                    border: `1px solid ${CU.orange}40`,
                                    cursor: 'pointer'
                                }}
                            >
                                {reply}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AlbaChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const welcomeMsg = {
            role: 'assistant',
            content: ALBA_WELCOME,
            showQuickReplies: true,
            onQuickReply: handleQuickReply
        };
        setMessages([welcomeMsg]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    function handleQuickReply(reply) {
        sendMessage(reply);
    }

    async function sendMessage(text = null) {
        const messageText = text || input.trim();
        if (!messageText || sending) return;

        setInput('');
        setSending(true);

        const userMsg = { role: 'user', content: messageText };
        setMessages(prev => [...prev, userMsg]);

        let response;
        try {
            response = await getAlbaResponse(messageText, [...messages, userMsg]);
        } catch (err) {
            response = "Sorry, I'm having trouble responding right now. Please try again in a moment.";
        }

        const albaMsg = {
            role: 'assistant',
            content: response,
            showQuickReplies: true,
            onQuickReply: handleQuickReply
        };
        setMessages(prev => [...prev, albaMsg]);
        setSending(false);
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full" style={{ background: '#f9fafb', fontFamily: "'Raleway', sans-serif" }}>
            {/* Header */}
            <div className="px-6 py-5 flex items-center gap-3" style={{ background: CU.charcoal, borderBottom: `2px solid ${CU.orange}` }}>
                <AlbaAvatar />
                <div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: 'white' }}>Alba 🤖</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Your UnityCup Assistant</div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-2xl w-full mx-auto">
                {messages.map((msg, idx) => (
                    <MessageBubble key={idx} message={msg} />
                ))}
                {sending && (
                    <div className="flex gap-3">
                        <AlbaAvatar />
                        <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'white', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                            ⏳ Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4" style={{ background: 'white', borderTop: '1px solid #e5e7eb' }}>
                <div className="flex gap-3 max-w-2xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Alba..."
                        disabled={sending}
                        className="flex-1 px-4 py-2.5 rounded-lg border text-sm"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            borderColor: '#e5e7eb',
                            background: 'white',
                            color: CU.charcoal,
                            opacity: sending ? 0.6 : 1
                        }}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || sending}
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                        style={{
                            background: !input.trim() || sending ? '#e5e7eb' : CU.magenta,
                            color: 'white',
                            border: 'none',
                            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}