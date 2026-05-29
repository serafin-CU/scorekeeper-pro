import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    green: '#218848',
};

const ALBA_FAQ = {
    welcome: "Hey! 👋 I'm Alba, your UnityCup assistant. Ask me about scoring rules, the tournament schedule, or how UnityCup works!",
    
    responses: [
        {
            triggers: ['score', 'points', 'scoring', 'how do points work'],
            response: "📊 UnityCup Prode (Predictions) scoring:\n\n• Exact score = 5 pts\n• Correct winner = 3 pts\n• Wrong outcome = 0 pts\n\nPredict every match and climb the leaderboard!"
        },
        {
            triggers: ['schedule', 'when', 'date', 'start', 'calendar', 'fixture', 'match'],
            response: "📅 FIFA World Cup 2026 Schedule:\n\n• Group Stage: June 11–27\n• Round of 32: June 28 – July 3\n• Round of 16: July 4–7\n• Quarterfinals: July 9–11\n• Semifinals: July 14–15\n• Third Place: July 18\n• Final: July 19 🏆\n\n48 teams, 104 matches across USA, Canada & Mexico!"
        },
        {
            triggers: ['prode', 'predict', 'prediction', 'guess'],
            response: "🎯 Prode is the prediction game!\n\nFor each match, predict the final score (home goals vs away goals). You can predict as many matches as you want and save them all at once.\n\nScoring: Exact score = 5 pts, Correct winner/draw = 3 pts.\n\nGo to 'Prode' in the nav to start predicting!"
        },
        {
            triggers: ['badge', 'achievement', 'award', 'trophy'],
            response: "🏅 UnityCup Badges:\n\n🎯 **Perfect Matchday** — Predict the correct winner for every match in a matchday\n\nMore badges to come! Your badges appear on your Profile page."
        },
        {
            triggers: ['trivia', 'quiz', 'question', 'daily quiz'],
            response: "🧠 Trivia is the daily quiz game!\n\nEach day you get a fresh set of World Cup questions. Answer fast and correctly to earn points and climb the leaderboard.\n\nHead to 'Trivia' in the nav to play today's set!"
        },
        {
            triggers: ['feed', 'post', 'social', 'comment', 'community'],
            response: "💬 The Feed is your social hub!\n\nShare posts, react to others, and chat about the tournament with the community. You can also see a preview of the latest posts on your Home dashboard.\n\nOpen 'Feed' in the nav to join the conversation!"
        },
        {
            triggers: ['standings', 'table', 'ranking', 'leaderboard', 'position'],
            response: "📊 Standings show how teams are doing!\n\nCheck group tables and the knockout bracket under 'Standings'. To see how YOU rank against other players, head to the Leaderboard.\n\nThe 'World Cup' page also has live fixtures, results, standings & news."
        },
        {
            triggers: ['nav', 'page', 'navigate', 'where', 'menu', 'sections'],
            response: "🧭 Here's what you'll find in UnityCup:\n\n• 🏠 **Home** — your stats, predictions & feed preview\n• 🎯 **Prode** — predict match scores\n• 📊 **Standings** — group & knockout tables\n• 🧠 **Trivia** — daily quiz games\n• 💬 **Feed** — social posts\n• 👤 **Profile** — your stats & badges\n• 🌍 **World Cup** — fixtures, results, standings & news\n• 🤖 **Alba** — that's me, your assistant!"
        },
        {
            triggers: ['group', 'argentina', 'brazil', 'usa', 'mexico', 'england', 'france', 'spain', 'germany', 'who is in'],
            response: "🌍 12 Groups, 48 Teams!\n\nHighlights:\n• Group A: Mexico, South Korea, South Africa\n• Group C: Brazil, Morocco, Scotland\n• Group D: USA, Paraguay, Australia\n• Group H: Spain, Uruguay, Saudi Arabia\n• Group I: France, Senegal, Norway\n• Group J: Argentina, Algeria, Austria\n• Group L: England, Croatia, Ghana\n\nCheck 'Prode' to see all fixtures by matchday!"
        },
        {
            triggers: ['rules', 'how to play', 'how does this work', 'help', 'what is this', 'explain'],
            response: "🏆 Welcome to UnityCup: FIFA World Cup 2026!\n\n**Prode** — Predict match scores. Exact = 5pts, correct winner = 3pts.\n**Trivia** — Play the daily quiz to earn points.\n**Feed** — Share posts with the community.\n**Standings** — Track group & knockout tables.\n\nCompete on the leaderboard and check the 'World Cup' page for live fixtures, results & news!\n\nNeed help with something specific? Ask me about scoring, the schedule, trivia, the feed, or any page!"
        }
    ],
    
    fallback: "🤔 I'm not sure about that one! I can help with:\n• Scoring rules\n• Tournament schedule\n• Trivia & Feed\n• Standings & badges\n• Getting around the app\n\nTry asking about one of those!"
};

const QUICK_REPLIES = [
    "How does scoring work?",
    "How do I play Trivia?",
    "Show me the app pages",
    "Tournament schedule"
];

function getAlbaResponse(userMessage) {
    const lower = userMessage.toLowerCase();
    
    for (const item of ALBA_FAQ.responses) {
        for (const trigger of item.triggers) {
            if (lower.includes(trigger)) {
                return item.response;
            }
        }
    }
    
    return ALBA_FAQ.fallback;
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
            content: ALBA_FAQ.welcome,
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

        setTimeout(() => {
            const response = getAlbaResponse(messageText);
            const albaMsg = {
                role: 'assistant',
                content: response,
                showQuickReplies: true,
                onQuickReply: handleQuickReply
            };
            setMessages(prev => [...prev, albaMsg]);
            setSending(false);
        }, 300);
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