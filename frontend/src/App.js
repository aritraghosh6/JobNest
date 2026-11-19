import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppNavbar from './components/AppNavbar';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ThemeProvider } from './context/ThemeContext';
import AppTour from './components/AppTour';
import ChatbotWidget from './components/ChatbotWidget';
import { useAuth } from './context/AuthContext';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLES } from './utils/helpers';

import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import SeekerProfilePage from './pages/seeker/SeekerProfilePage';
import AssessmentPage from './pages/assessment/AssessmentPage';
import AssessmentReportPage from './pages/assessment/AssessmentReportPage';
import JobsPage from './pages/jobs/JobsPage';
import JobDetailsPage from './pages/jobs/JobDetailsPage';
import MyApplicationsPage from './pages/applications/MyApplicationsPage';
import NetworkPage from './pages/network/NetworkPage';
import MessagesPage from './pages/network/MessagesPage';
import AtsCheckerPage from './pages/ats/AtsCheckerPage';
import CompanyProfilePage from './pages/employer/CompanyProfilePage';
import EmployerJobsPage from './pages/employer/EmployerJobsPage';
import JobFormPage from './pages/employer/JobFormPage';
import JobApplicantsPage from './pages/employer/JobApplicantsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProfileSetupPage from './pages/onboarding/ProfileSetupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import SavedPage from './pages/saved/SavedPage';
import CalendarPage from './pages/calendar/CalendarPage';

const { JOB_SEEKER, EMPLOYER, ADMIN } = ROLES;

const guard = (roles, element) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

export default function App() {
  const { user } = useAuth();
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AppNavbar />
        <main id="main-content" tabIndex={-1}>
          <PageTransition>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/notifications" element={guard(null, <NotificationsPage />)} />
              <Route path="/saved" element={guard([JOB_SEEKER], <SavedPage />)} />
              <Route path="/calendar" element={guard([JOB_SEEKER, EMPLOYER], <CalendarPage />)} />
              <Route path="/dashboard" element={guard(null, <Dashboard />)} />

              {/* Profile setup wizard, shown right after sign-up */}
              <Route path="/onboarding" element={guard([JOB_SEEKER, EMPLOYER], <ProfileSetupPage />)} />

              {/* Job seeker */}
              <Route path="/profile" element={guard([JOB_SEEKER], <SeekerProfilePage />)} />
              <Route path="/assessment" element={guard([JOB_SEEKER], <AssessmentPage />)} />
              <Route path="/assessment/report" element={guard([JOB_SEEKER], <AssessmentReportPage />)} />
              <Route path="/assessment/report/:id" element={guard([JOB_SEEKER], <AssessmentReportPage />)} />
              <Route path="/jobs" element={guard([JOB_SEEKER], <JobsPage />)} />
              <Route path="/jobs/:id" element={guard([JOB_SEEKER, EMPLOYER, ADMIN], <JobDetailsPage />)} />
              <Route path="/applications" element={guard([JOB_SEEKER], <MyApplicationsPage />)} />
              <Route path="/ats-checker" element={guard([JOB_SEEKER], <AtsCheckerPage />)} />

              {/* Shared networking */}
              <Route path="/network" element={guard([JOB_SEEKER, EMPLOYER], <NetworkPage />)} />
              <Route path="/messages" element={guard([JOB_SEEKER, EMPLOYER], <MessagesPage />)} />
              <Route path="/messages/:userId" element={guard([JOB_SEEKER, EMPLOYER], <MessagesPage />)} />

              {/* Employer */}
              <Route path="/company" element={guard([EMPLOYER], <CompanyProfilePage />)} />
              <Route path="/employer/jobs" element={guard([EMPLOYER], <EmployerJobsPage />)} />
              <Route path="/employer/jobs/new" element={guard([EMPLOYER], <JobFormPage />)} />
              <Route path="/employer/jobs/:id/edit" element={guard([EMPLOYER], <JobFormPage />)} />
              <Route path="/employer/jobs/:id/applicants" element={guard([EMPLOYER], <JobApplicantsPage />)} />

              {/* Admin */}
              <Route path="/admin" element={guard([ADMIN], <AdminDashboard />)} />

              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </main>
        <Footer />
        {/* Sprint 2: first-login guided tour (all roles) and the job seeker assistant */}
        <AppTour />
        {user?.role === JOB_SEEKER && <ChatbotWidget />}
      </ConfirmProvider>
    </ThemeProvider>
  );
}
