import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CU } from './feedConstants';

const EMOJIS = ['🔥', '❤️', '⚽'];

export default function PostReactions({ postId }) {
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: reactions = [] } = useQuery({
        queryKey: ['postReactions', postId],
        queryFn: () => base44.entities.PostReaction.filter({ postId })
    });

    const toggleMutation = useMutation({
        mutationFn: async (emoji) => {
            const existing = reactions.find(r => r.userId === currentUser.id && r.emoji === emoji);
            if (existing) {
                await base44.entities.PostReaction.delete(existing.id);
            } else {
                await base44.entities.PostReaction.create({ postId, userId: currentUser.id, emoji });
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postReactions', postId] })
    });

    return (
        <div className="flex items-center gap-2 mt-3">
            {EMOJIS.map(emoji => {
                const count = reactions.filter(r => r.emoji === emoji).length;
                const mine = currentUser && reactions.some(r => r.userId === currentUser.id && r.emoji === emoji);
                return (
                    <button
                        key={emoji}
                        onClick={() => currentUser && toggleMutation.mutate(emoji)}
                        disabled={toggleMutation.isPending}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-colors"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            background: mine ? CU.orange + '25' : '#f3f4f6',
                            border: mine ? `1px solid ${CU.orange}` : '1px solid transparent',
                            color: CU.charcoal,
                            cursor: currentUser ? 'pointer' : 'default'
                        }}
                    >
                        <span>{emoji}</span>
                        {count > 0 && <span className="text-xs font-semibold">{count}</span>}
                    </button>
                );
            })}
        </div>
    );
}