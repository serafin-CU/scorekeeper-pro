import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CU } from '@/components/feed/feedConstants';
import PastPredictions from './PastPredictions';
import TriviaHistory from './TriviaHistory';

const TABS = [
    { key: 'posts', label: 'Posts' },
    { key: 'predictions', label: 'Predictions' },
    { key: 'trivia', label: 'Trivia Stats' },
];

function PostsPanel({ posts }) {
    if (!posts || posts.length === 0) {
        return (
            <div className="text-center py-8 rounded-xl text-sm" style={{ background: 'white', border: '1px dashed #e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No posts yet.
            </div>
        );
    }
    return (
        <div className="space-y-3">
            {posts.map(post => (
                <div key={post.id} className="rounded-xl p-4" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                    <p className="text-sm whitespace-pre-wrap break-words" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                        {post.content}
                    </p>
                    <div className="text-xs mt-2" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                        {post.created_date ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true }) : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ProfileTabs({ profile }) {
    const [tab, setTab] = useState('posts');

    return (
        <div>
            <div className="flex items-center gap-1 p-1 rounded-xl mb-5" style={{ background: CU.charcoal }}>
                {TABS.map(t => {
                    const isActive = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex-1 py-2 rounded-lg text-sm transition-colors"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                fontWeight: 600,
                                background: isActive ? CU.orange : 'transparent',
                                color: isActive ? CU.charcoal : 'rgba(255,255,255,0.7)',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'posts' && <PostsPanel posts={profile.posts} />}
            {tab === 'predictions' && <PastPredictions predictions={profile.past_predictions} />}
            {tab === 'trivia' && <TriviaHistory triviaPoints={profile.trivia_points} history={profile.trivia_history} />}
        </div>
    );
}