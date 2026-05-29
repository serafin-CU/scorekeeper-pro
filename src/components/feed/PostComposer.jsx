import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Send } from 'lucide-react';
import { CU } from './feedConstants';

export default function PostComposer({ user, onPosted }) {
    const [content, setContent] = useState('');
    const [posting, setPosting] = useState(false);

    const authorName = user?.display_name || user?.full_name || 'Anonymous';
    const authorAvatar = user?.avatar_url || '';
    const initials = authorName.charAt(0).toUpperCase();

    const submit = async () => {
        const text = content.trim();
        if (!text || posting) return;
        setPosting(true);
        const post = await base44.entities.FeedPost.create({
            author_id: user?.id,
            author_name: authorName,
            author_avatar_url: authorAvatar,
            author_department: user?.department || '',
            content: text,
            like_count: 0,
            comment_count: 0,
        });
        setContent('');
        setPosting(false);
        onPosted?.(post);
    };

    return (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
            <div className="flex gap-3">
                {authorAvatar ? (
                    <img src={authorAvatar} alt={authorName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
                        style={{ background: CU.magenta, fontFamily: "'Raleway', sans-serif" }}>
                        {initials}
                    </div>
                )}
                <div className="flex-1">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Share your World Cup take..."
                        rows={3}
                        className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none"
                        style={{ fontFamily: "'Raleway', sans-serif", borderColor: '#e5e7eb', color: CU.charcoal }}
                    />
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={submit}
                            disabled={!content.trim() || posting}
                            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                background: !content.trim() || posting ? '#e5e7eb' : CU.magenta,
                                color: 'white',
                                border: 'none',
                                cursor: !content.trim() || posting ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <Send className="w-4 h-4" />
                            {posting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}