import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Onboarding from './pages/Onboarding';
import PublicProfile from './pages/PublicProfile';
import AlbaChat from './pages/AlbaChat';
import FAFOChat from './pages/FAFOChat';
import Feed from './pages/Feed';
import Leaderboard from './pages/Leaderboard';
import ProdePredictions from './pages/ProdePredictions';
import Profile from './pages/Profile';
import Standings from './pages/Standings';
import Trivia from './pages/Trivia';
import TriviaAdmin from './pages/TriviaAdmin';
import WorldCup from './pages/WorldCup';
import AdminWCDataSync from './pages/AdminWCDataSync';
import AdminBadgesViewer from './pages/AdminBadgesViewer';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useEffect } from 'react';
import { toast } from 'sonner';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Show onboarding if user hasn't completed it
  if (user && !user.onboarding_completed) {
    return <Onboarding />;
  }

  // Render the main app
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/AlbaChat" element={<LayoutWrapper currentPageName="AlbaChat"><AlbaChat /></LayoutWrapper>} />
      <Route path="/FAFOChat" element={<LayoutWrapper currentPageName="FAFOChat"><FAFOChat /></LayoutWrapper>} />
      <Route path="/Feed" element={<LayoutWrapper currentPageName="Feed"><Feed /></LayoutWrapper>} />
      <Route path="/Leaderboard" element={<LayoutWrapper currentPageName="Leaderboard"><Leaderboard /></LayoutWrapper>} />
      <Route path="/ProdePredictions" element={<LayoutWrapper currentPageName="ProdePredictions"><ProdePredictions /></LayoutWrapper>} />
      <Route path="/Profile" element={<LayoutWrapper currentPageName="Profile"><Profile /></LayoutWrapper>} />
      <Route path="/Standings" element={<LayoutWrapper currentPageName="Standings"><Standings /></LayoutWrapper>} />
      <Route path="/Trivia" element={<LayoutWrapper currentPageName="Trivia"><Trivia /></LayoutWrapper>} />
      <Route path="/TriviaAdmin" element={<LayoutWrapper currentPageName="TriviaAdmin"><TriviaAdmin /></LayoutWrapper>} />
      <Route path="/WorldCup" element={<LayoutWrapper currentPageName="WorldCup"><WorldCup /></LayoutWrapper>} />
      <Route path="/AdminWCDataSync" element={<LayoutWrapper currentPageName="AdminWCDataSync"><AdminWCDataSync /></LayoutWrapper>} />
      <Route path="/AdminBadgesViewer" element={<LayoutWrapper currentPageName="AdminBadgesViewer"><AdminBadgesViewer /></LayoutWrapper>} />
      <Route path="/Profile/:userId" element={<LayoutWrapper currentPageName="PublicProfile"><PublicProfile /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </ErrorBoundary>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App