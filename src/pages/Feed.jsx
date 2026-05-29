import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PostComposer from '@/components/feed/PostComposer';
import PostCard from '@/components/feed/PostCard';
import { CU } from '@/components/feed/feedConstants';

export default function Feed() {
    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    const { data: posts = [], isLoading, refetch } = useQuery({
        queryKey: ['feedPosts'],
        queryFn: () => base44.entities.FeedPost.list('-created_date', 100),
    });

    return (
        <div className="max-w-2xl mx-auto px-4 py-8" style={{ fontFamily: "'Raleway', sans-serif" }}>
            <h1 className="mb-6" style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal }}>
                Feed
            </h1>

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
                    {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
}