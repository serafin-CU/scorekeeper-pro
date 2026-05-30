import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PostComposer from '@/components/feed/PostComposer';
import PostCard from '@/components/feed/PostCard';
import FeedFilterTabs from '@/components/feed/FeedFilterTabs';
import { CU } from '@/components/feed/feedConstants';

export default function Feed() {
    const [filter, setFilter] = useState('all');

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    const { data: posts = [], isLoading, refetch } = useQuery({
        queryKey: ['feedPosts'],
        queryFn: () => base44.entities.FeedPost.list('-created_date', 100),
    });

    const { data: allReactions = [] } = useQuery({
        queryKey: ['allPostReactions'],
        queryFn: () => base44.entities.PostReaction.list('', 1000),
    });

    const reactionCount = {};
    for (const r of allReactions) reactionCount[r.postId] = (reactionCount[r.postId] || 0) + 1;

    let displayedPosts = posts;
    if (filter === 'popular') {
        displayedPosts = [...posts].sort((a, b) => (reactionCount[b.id] || 0) - (reactionCount[a.id] || 0));
    } else if (filter === 'following') {
        const myPostIds = new Set(allReactions.filter(r => r.userId === user?.id).map(r => r.postId));
        const filtered = posts.filter(p => myPostIds.has(p.id));
        displayedPosts = filtered.length > 0 ? filtered : posts;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8" style={{ fontFamily: "'Raleway', sans-serif" }}>
            <h1 className="mb-6" style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal }}>
                Feed
            </h1>

            <FeedFilterTabs active={filter} onChange={setFilter} />

            <PostComposer user={user} onPosted={() => refetch()} />

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="w-7 h-7 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-12 rounded-xl" style={{ background: 'white', border: '1px dashed #e5e7eb' }}>
                    <p className="text-sm" style={{ color: '#9ca3af' }}>No posts yet. Be the first to share! ⚽</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
}