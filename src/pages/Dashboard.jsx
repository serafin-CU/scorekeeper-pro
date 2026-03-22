import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Trophy, Users, Target, TrendingUp, Loader2, ChevronRight, Award } from 'lucide-react';
import { createPageUrl } from '@/utils';

function StatCard({ icon: Icon, label, value, sublabel, color = 'gray' }) {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        amber: 'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
        gray: 'bg-gray-50 text-gray-600'
    };
    return (
        <Card>
            <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-2xl font-bold text-gray-900">{value}</div>
                        <div className="text-sm font-medium text-gray-600">{label}</div>
                        {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
                    </div>
                </div>
            </CardContent>
        </Card>
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
            <div className="text-center py-6 text-gray-400 text-sm">
                No predictions yet. <Link to={createPageUrl('ProdePredictions')} className="text-blue-600 underline">Make your first!</Link>
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
                    <div key={pred.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="text-xs text-gray-400 w-16">
                                {kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-sm font-medium">
                                {homeName} vs {awayName}
                            </div>
                        </div>
                        <div className="text-sm font-bold text-gray-700">
                            {pred.pred_home_goals} – {pred.pred_away_goals}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SquadSummary({ currentUser, teams }) {
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const { data: squads = [], isLoading } = useQuery({
        queryKey: ['userSquadsDash', currentUser?.id],
        queryFn: () => base44.entities.FantasySquad.filter({ user_id: currentUser.id, status: 'FINAL' }),
        enabled: !!currentUser
    });

    const latestSquad = squads.sort((a, b) => new Date(b.finalized_at || b.created_date) - new Date(a.finalized_at || a.created_date))[0];

    const { data: squadPlayers = [] } = useQuery({
        queryKey: ['squadPlayersDash', latestSquad?.id],
        queryFn: () => base44.entities.FantasySquadPlayer.filter({ squad_id: latestSquad.id }),
        enabled: !!latestSquad
    });

    const { data: allPlayers = [] } = useQuery({
        queryKey: ['allPlayers'],
        queryFn: () => base44.entities.Player.list()
    });

    const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

    if (isLoading) {
        return <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading squad...</div>;
    }

    if (!latestSquad) {
        return (
            <div className="text-center py-6 text-gray-400 text-sm">
                No squad created yet. <Link to={createPageUrl('SquadManagement')} className="text-blue-600 underline">Build your squad!</Link>
            </div>
        );
    }

    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
    const captain = squadPlayers.find(sp => sp.is_captain);
    const captainPlayer = captain ? playersMap[captain.player_id] : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">Phase: <span className="font-medium text-gray-700">{latestSquad.phase}</span></div>
                <div className="text-xs text-gray-400">{starters.length}/11 starters</div>
            </div>
            {captainPlayer && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-amber-600 font-bold text-xs">C</span>
                    <span className="text-sm font-medium">{captainPlayer.full_name}</span>
                    <span className="text-xs text-gray-400">({captainPlayer.position})</span>
                    <span className="text-xs text-amber-600 ml-auto">2× points</span>
                </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
                {starters.slice(0, 6).map(sp => {
                    const player = playersMap[sp.player_id];
                    if (!player) return null;
                    const team = teamsMap[player.team_id];
                    return (
                        <div key={sp.id} className="text-xs py-1.5 px-2 bg-gray-50 rounded flex items-center justify-between">
                            <span className="truncate font-medium">{player.full_name}</span>
                            <span className="text-gray-400 ml-1">{player.position}</span>
                        </div>
                    );
                })}
                {starters.length > 6 && (
                    <div className="text-xs py-1.5 px-2 text-gray-400 flex items-center">
                        +{starters.length - 6} more
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const { data: predictions = [] } = useQuery({
        queryKey: ['dashPredictions', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            const result = await base44.functions.invoke('prodeService', {
                action: 'get_user_predictions',
                target_user_id: currentUser.id
            });
            return result.data?.predictions || [];
        },
        enabled: !!currentUser
    });

    const { data: ledger = [] } = useQuery({
        queryKey: ['dashLedger', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            return base44.entities.PointsLedger.filter({ user_id: currentUser.id });
        },
        enabled: !!currentUser
    });

    const { data: badges = [] } = useQuery({
        queryKey: ['dashBadges', currentUser?.id],
        queryFn: () => base44.entities.BadgeAward.filter({ user_id: currentUser.id }),
        enabled: !!currentUser
    });

    // Compute totals
    const prodePoints = ledger.filter(e => e.mode === 'PRODE').reduce((sum, e) => sum + (e.points || 0), 0);
    const fantasyPoints = ledger.filter(e => e.mode === 'FANTASY').reduce((sum, e) => sum + (e.points || 0), 0);
    const totalPoints = prodePoints + fantasyPoints;

    const now = new Date();
    const upcomingMatches = matches.filter(m => new Date(m.kickoff_at) > now).length;

    if (userLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Welcome{currentUser?.full_name ? `, ${currentUser.full_name}` : ''}
                </h1>
                <p className="text-sm text-gray-500 mt-1">Your ScoreKeeper Pro overview</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                    icon={TrendingUp}
                    label="Total Points"
                    value={totalPoints}
                    sublabel="Prode + Fantasy"
                    color="purple"
                />
                <StatCard
                    icon={Trophy}
                    label="Prode Points"
                    value={prodePoints}
                    sublabel={`${predictions.length} predictions`}
                    color="amber"
                />
                <StatCard
                    icon={Users}
                    label="Fantasy Points"
                    value={fantasyPoints}
                    color="blue"
                />
                <StatCard
                    icon={Award}
                    label="Badges"
                    value={badges.length}
                    sublabel={badges.length > 0 ? badges.map(b => b.badge_type).join(', ') : 'None yet'}
                    color="green"
                />
            </div>

            {/* Two-column content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent predictions */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Target className="w-4 h-4 text-amber-500" />
                                Recent Predictions
                            </CardTitle>
                            <Link to={createPageUrl('ProdePredictions')}>
                                <Button size="sm" variant="ghost" className="text-xs gap-1">
                                    All <ChevronRight className="w-3 h-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <RecentPredictions predictions={predictions} matches={matches} teams={teams} />
                    </CardContent>
                </Card>

                {/* Squad summary */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                My Squad
                            </CardTitle>
                            <Link to={createPageUrl('SquadManagement')}>
                                <Button size="sm" variant="ghost" className="text-xs gap-1">
                                    Manage <ChevronRight className="w-3 h-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SquadSummary currentUser={currentUser} teams={teams} />
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming matches info */}
            {upcomingMatches > 0 && (
                <div className="text-center text-sm text-gray-400 pt-2">
                    {upcomingMatches} upcoming match{upcomingMatches !== 1 ? 'es' : ''} to predict
                </div>
            )}
        </div>
    );
}