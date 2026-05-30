import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, Trophy, Award, Brain, Loader2 } from 'lucide-react';
import { CU } from '@/components/feed/feedConstants';
import ProfileTabs from '@/components/profile/ProfileTabs';

const BADGE_NAMES = {
    UNBREAKABLE_XI: '🛡️ Unbreakable XI',
    THE_ORIGINALS: '👑 The Originals',
    PERFECT_MATCHDAY: '🎯 Perfect Matchday',
};

export default function PublicProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['publicProfile', userId],
        queryFn: async () => {
            const res = await base44.functions.invoke('publicProfile', { user_id: userId });
            return res.data?.profile;
        },
        enabled: !!userId
    });

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto p-6 flex items-center gap-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading profile...
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="max-w-2xl mx-auto p-6 text-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                Profile not found.
            </div>
        );
    }

    const initials = profile.display_name.charAt(0).toUpperCase();

    return (
        <div className="min-h-screen p-4 sm:p-6" style={{ background: '#f9fafb' }}>
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm mb-6"
                    style={{ color: CU.charcoal, fontFamily: "'Raleway', sans-serif", background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <ChevronLeft className="w-4 h-4" /> Back
                </button>

                {/* Identity header */}
                <div className="rounded-2xl p-6 mb-6" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                    <div className="flex items-center gap-5">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.display_name} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 text-white text-2xl font-semibold"
                                style={{ background: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}>
                                {initials}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal, margin: 0 }}>
                                {profile.display_name}
                            </h1>
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                {profile.department && (
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: CU.orange + '20', color: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}>
                                        {profile.department}
                                    </span>
                                )}
                                {profile.favorite_team && (
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: CU.magenta + '15', color: CU.magenta, fontFamily: "'Raleway', sans-serif" }}>
                                        🌍 {profile.favorite_team.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Points & badges */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: CU.green + '18' }}>
                            <Trophy className="w-5 h-5" style={{ color: CU.green }} />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal, lineHeight: 1 }}>{profile.prode_points}</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#6b7280' }}>Prode Points</div>
                        </div>
                    </div>
                    <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: CU.orange + '18' }}>
                            <Brain className="w-5 h-5" style={{ color: CU.orange }} />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal, lineHeight: 1 }}>{profile.trivia_points ?? 0}</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#6b7280' }}>Trivia Points</div>
                        </div>
                    </div>
                    <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: CU.magenta + '18' }}>
                            <Award className="w-5 h-5" style={{ color: CU.magenta }} />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal, lineHeight: 1 }}>{profile.badges.length}</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#6b7280' }}>Badges</div>
                        </div>
                    </div>
                </div>

                {profile.badges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {profile.badges.map((b, i) => (
                            <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ background: CU.orange + '20', color: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}>
                                {BADGE_NAMES[b.badge_type] || b.badge_type}
                            </span>
                        ))}
                    </div>
                )}

                <ProfileTabs profile={profile} />
            </div>
        </div>
    );
}