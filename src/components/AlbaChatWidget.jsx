import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const ALBA_FAQ = {
    welcome: (name) => `Hola${name ? ` ${name}` : ''}! 👋 I'm Alba, your UnityCup assistant. Ask me about scoring rules, squad building, the tournament schedule, or how UnityCup works!`,

    responses: [
        {
            triggers: ['score', 'points', 'scoring', 'how do points work'],
            response: "📊 UnityCup has two game modes:\n\n**Prode:** Exact score = 5 pts, Correct winner = 3 pts\n\n**Fantasy:** FWD goal = 4 pts, MID goal = 5 pts, DEF/GK goal = 6 pts, 60+ min = 1 pt, Yellow = -1 pt, Red = -3 pts. Captain gets 2x points!"
        },
        {
            triggers: ['squad', 'formation', 'team', 'players', 'how many', '4-3-3', 'build'],
            response: "⚽ Your fantasy squad needs:\n• 11 starters (1 GK, 4 DEF, 3 MID, 3 FWD)\n• 3 bench players\n• 1 captain (2x points)\n• Budget: $150M\n\nGo to 'Build Squad' in the nav!"
        },
        {
            triggers: ['transfer', 'change', 'edit', 'swap', 'lock', 'window', 'deadline'],
            response: "🔄 Transfers are FREE! You can edit your squad anytime until 48 hours before the first match of each phase. After that, your squad locks."
        },
        {
            triggers: ['schedule', 'when', 'date', 'start', 'calendar', 'fixture', 'match'],
            response: "📅 FIFA World Cup 2026:\n• Group Stage: June 11–27\n• Round of 32: June 28 – July 3\n• Round of 16: July 4–7\n• Quarterfinals: July 9–11\n• Semifinals: July 14–15\n• Final: July 19 🏆"
        },
        {
            triggers: ['prode', 'predict', 'prediction', 'guess'],
            response: "🎯 Prode is the prediction game! Predict the final score for each match. Exact score = 5 pts, Correct winner = 3 pts. Go to 'Prode' in the nav!"
        },
        {
            triggers: ['badge', 'achievement', 'award', 'trophy'],
            response: "🏅 Badges:\n🛡️ Unbreakable XI — Keep 8+ starters between knockout rounds\n👑 The Originals — Keep 9+ R32 starters to the Final\n🎯 Perfect Matchday — Predict every winner in a matchday correctly"
        },
        {
            triggers: ['captain', '2x', 'double', 'multiplier'],
            response: "©️ Your Captain earns DOUBLE points! Pick someone likely to score or play 60+ minutes. Change captain anytime before the squad locks."
        },
        {
            triggers: ['rules', 'how to play', 'how does this work', 'help', 'what is this', 'explain'],
            response: "🏆 Two ways to play:\n\n1️⃣ Prode — Predict match scores. Exact = 5pts, correct winner = 3pts.\n2️⃣ Fantasy — Build a squad of 14 real players. They earn points based on real match performance.\n\nBoth modes have separate leaderboards!"
        }
    ],

    fallback: "🤔 I can help with: scoring rules, squad building, transfer windows, tournament schedule, badges, or how to play. Try asking about one of those!"
};

const QUICK_REPLIES = [
    "How does scoring work?",
    "Squad rules",
    "Tournament schedule",
    "What are badges?",
];

function getAlbaResponse(userMessage) {
    const lower = userMessage.toLowerCase();
    for (const item of ALBA_FAQ.responses) {
        for (const trigger of item.triggers) {
            if (lower.includes(trigger)) return item.response;
        }
    }
    return ALBA_FAQ.fallback;
}

export default function AlbaChatWidget({ userName }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const panelRef = useRef(null);
    const initialized = useRef(false);

    useEffect(() => {
        if (open && !initialized.current) {
            initialized.current = true;
            setMessages([{
                role: 'assistant',
                content: ALBA_FAQ.welcome(userName),
                showQuickReplies: true,
            }]);
        }
    }, [open, userName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    function sendMessage(text) {
        const messageText = (text || input).trim();
        if (!messageText || sending) return;
        setInput('');
        setSending(true);
        setMessages(prev => [...prev, { role: 'user', content: messageText }]);
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: getAlbaResponse(messageText),
                showQuickReplies: true,
            }]);
            setSending(false);
        }, 300);
    }

    return (
        <div ref={panelRef} style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 50 }}>
            {/* Chat Panel */}
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '68px',
                        right: 0,
                        width: 'min(350px, calc(100vw - 48px))',
                        height: '450px',
                        background: '#f9fafb',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb',
                    }}
                >
                    {/* Header */}
                    <div style={{ background: CU.charcoal, borderBottom: `2px solid ${CU.orange}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                            src="https://media.base44.com/images/public/697e13bb6118f7db732b8054/c94fef301_image.png"
                            alt="Alba"
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'white' }}>Alba 🤖</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontFamily: "'Raleway', sans-serif" }}>Your UnityCup Assistant</div>
                        </div>
                        <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {messages.map((msg, idx) => (
                            <div key={idx}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        maxWidth: '80%',
                                        background: msg.role === 'user' ? CU.charcoal : 'white',
                                        color: msg.role === 'user' ? 'white' : CU.charcoal,
                                        borderRadius: '12px',
                                        padding: '8px 12px',
                                        fontSize: '0.8rem',
                                        fontFamily: "'Raleway', sans-serif",
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        border: msg.role !== 'user' ? '1px solid #e5e7eb' : 'none',
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                                {msg.showQuickReplies && idx === messages.length - 1 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                        {QUICK_REPLIES.map((reply, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(reply)}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.7rem',
                                                    fontFamily: "'Raleway', sans-serif",
                                                    background: CU.orange + '20',
                                                    color: CU.orange,
                                                    border: `1px solid ${CU.orange}40`,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {sending && (
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>⏳ Thinking...</div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '10px 12px', background: 'white', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder="Ask Alba..."
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                fontSize: '0.8rem',
                                fontFamily: "'Raleway', sans-serif",
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || sending}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '8px',
                                background: !input.trim() || sending ? '#e5e7eb' : CU.magenta,
                                color: 'white',
                                border: 'none',
                                cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Send style={{ width: 14, height: 14 }} />
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setOpen(prev => !prev)}
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: CU.orange,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    transition: 'transform 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                aria-label="Chat with Alba"
            >
                {open
                    ? <X style={{ width: 22, height: 22, color: CU.charcoal }} />
                    : <MessageSquare style={{ width: 22, height: 22, color: CU.charcoal }} />
                }
            </button>
        </div>
    );
}