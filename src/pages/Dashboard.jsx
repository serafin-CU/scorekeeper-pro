import React from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { Target, TrendingUp, Loader2, ChevronRight, Award, Newspaper, Medal } from 'lucide-react';
import DashboardFeedPreview from '@/components/dashboard/DashboardFeedPreview';
import NextMatchCard from '@/components/dashboard/NextMatchCard';
import PostShortcut from '@/components/dashboard/PostShortcut';
import WCNewsTeaser from '@/components/dashboard/WCNewsTeaser';
import { StatCardSkeleton, NextMatchSkeleton } from '@/components/dashboard/DashboardSkeletons';
import HoverLift from '@/components/ui/HoverLift';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    green: '#218848',
};

function StatCard({ icon: Icon, label, value, sublabel, accentColor, gradient }) {
    return (
        <HoverLift
            style={{ background: gradient, borderRadius: '12px', overflow: 'hidden' }}
            whileHover={{
                y: 0,
                boxShadow: `0 0 18px -2px ${accentColor}88`,
            }}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.22)' }}>
                        <Icon className="w-5 h-5" style={{ color: 'white' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: 'white', lineHeight: 1 }}>{value}</div>
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', marginTop: '2px' }}>{label}</div>
                        {sublabel && <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{sublabel}</div>}
                    </div>
                </div>
            </div>
        </HoverLift>
    );
}

function RecentPredictions({ predictions, matches, teams }) {
    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const recent = [...predictions]
        .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date))
        .slice(0, 5);

    if (recent.length === 0) {
        return (
            <div className="text-center py-6">
                <p className="text-sm mb-3" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                    No predictions yet.
                </p>
                <Link to="/ProdePredictions">
                    <button
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: CU.charcoal, color: 'white', fontFamily: "'Raleway', sans-serif", border: 'none', cursor: 'pointer' }}
                    >
                        Make your first! <ChevronRight className="w-4 h-4" />
                    </button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {recent.map(pred => {
                const match = matchesMap[pred.match_id];
                if (!match) return null;
                const home = teamsMap[match.home_team_id];
                const away = teamsMap[match.away_team_id];
                const homeName = home?.fifa_code || home?.name || '???';
                const awayName = away?.fifa_code || away?.name || '???';
                const kickoff = new Date(match.kickoff_at);

                return (
                    <div key={pred.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: '#f9fafb' }}>
                        <div className="flex items-center gap-3">
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', width: '60px' }}>
                                {kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: '0.875rem', color: CU.charcoal }}>
                                {homeName} vs {awayName}
                            </div>
                        </div>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, color: CU.charcoal, fontSize: '0.95rem' }}>
                            {pred.pred_home_goals} – {pred.pred_away_goals}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SectionCard({ title, icon: Icon, iconColor, linkTo, linkLabel, children }) {
    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: iconColor }} />
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: CU.charcoal }}>{title}</span>
                </div>
                <Link to={linkTo}>
                    <button className="flex items-center gap-1 text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {linkLabel} <ChevronRight className="w-3 h-3" />
                    </button>
                </Link>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

export default function Dashboard() {
    const [searchParams] = useSearchParams();
    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });
    const isAdmin = currentUser?.role === 'admin';
    const previewAsParticipant = isAdmin && searchParams.get('preview_as') === 'participant';

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const { data: predictions = [], isLoading: predictionsLoading } = useQuery({
        queryKey: ['dashPredictions', currentUser?.id],
        queryFn: async () => {
            const result = await base44.functions.invoke('prodeService', {
                action: 'get_user_predictions',
                target_user_id: currentUser.id
            });
            return result.data?.predictions || [];
        },
        enabled: !!currentUser
    });

    const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
        queryKey: ['dashLedger', currentUser?.id],
        queryFn: async () => {
            return base44.entities.PointsLedger.filter({ user_id: currentUser.id });
        },
        enabled: !!currentUser
    });

    const { data: badges = [] } = useQuery({
        queryKey: ['dashBadges', currentUser?.id],
        queryFn: () => base44.entities.BadgeAward.filter({ user_id: currentUser.id }),
        enabled: !!currentUser
    });

    const { data: leaderboardRank } = useQuery({
        queryKey: ['leaderboardRank', currentUser?.id],
        queryFn: async () => {
            const result = await base44.functions.invoke('prodeService', {
                action: 'get_leaderboard_rank'
            });
            return result.data;
        },
        enabled: !!currentUser,
        staleTime: 30000
    });

    const prodePoints = ledger.filter(e => e.mode === 'PRODE').reduce((sum, e) => sum + (e.points || 0), 0);

    const hasPredictions = predictions.length > 0;

    const now = new Date();
    const upcomingMatches = matches.filter(m => new Date(m.kickoff_at) > now).length;

    const statsLoading = ledgerLoading || predictionsLoading;
    const nextMatchLoading = matchesLoading || predictionsLoading;

    if (userLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex items-center gap-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
            <Link to="/WorldCup" className="block">
                <WorldCupBanner />
            </Link>

            {/* Header */}
            <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal, margin: 0 }}>
                    Welcome{currentUser?.full_name ? `, ${currentUser.full_name}` : ''}
                </h1>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
                    Your UnityCup overview
                </p>
            </div>

            {/* Stats grid */}
            <div className="dash-enter grid gap-3 grid-cols-2 sm:grid-cols-3" style={{ animationDelay: '0ms' }}>
                {statsLoading ? (
                    <>
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </>
                ) : (
                <>
                <StatCard icon={TrendingUp} label="Prode Points" value={prodePoints} accentColor={CU.orange} gradient="linear-gradient(135deg, #FFB81C 0%, #F59E0B 50%, #D97706 100%)" />
                <StatCard icon={Medal} label="Your Ranking" value={leaderboardRank?.rank ? '#' + leaderboardRank.rank : '—'} sublabel={'of ' + (leaderboardRank?.totalUsers || 0) + ' players'} accentColor={CU.green} gradient="linear-gradient(135deg, #218848 0%, #10B981 50%, #14B8A6 100%)" />
                <StatCard icon={Award} label="Badges" value={badges.length} accentColor={CU.magenta} gradient="linear-gradient(135deg, #AA0061 0%, #C026D3 50%, #DB2777 100%)" sublabel={badges.length > 0 ? badges.map(b => {
                    const names = { UNBREAKABLE_XI: '🛡️ Unbreakable XI', THE_ORIGINALS: '👑 The Originals', PERFECT_MATCHDAY: '🎯 Perfect Matchday' };
                    return names[b.badge_type] || b.badge_type;
                }).join(', ') : 'None yet'} />
                </>
                )}
            </div>

            <div className="dash-enter" style={{ animationDelay: '100ms' }}>
                {nextMatchLoading ? (
                    <NextMatchSkeleton />
                ) : (
                    <NextMatchCard matches={matches} teams={teams} predictions={predictions} />
                )}
            </div>

            <div className="dash-enter" style={{ animationDelay: '200ms' }}>
                <PostShortcut />
            </div>

            {/* Content */}
            <div className="dash-enter grid grid-cols-1 gap-6" style={{ animationDelay: '300ms' }}>
                <SectionCard title="Recent Predictions" icon={Target} iconColor={CU.orange} linkTo="/ProdePredictions" linkLabel="All">
                    <RecentPredictions predictions={predictions} matches={matches} teams={teams} />
                </SectionCard>

                <SectionCard title="From the Feed" icon={Newspaper} iconColor={CU.magenta} linkTo="/Feed" linkLabel="See all posts">
                    <DashboardFeedPreview />
                </SectionCard>

                <WCNewsTeaser />
            </div>

            {upcomingMatches > 0 && (
                <div className="text-center text-sm pt-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {upcomingMatches} upcoming match{upcomingMatches !== 1 ? 'es' : ''} to predict
                </div>
            )}
        </div>
    );
}