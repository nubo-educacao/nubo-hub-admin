import { Toaster } from "@/components/ui/toaster";
import { Toaster as ToasterSonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AdminLayout from "./components/layout/AdminLayout";
import PartnerLayout from "./components/layout/PartnerLayout";
import Login from "./pages/Login";
import Users from "./pages/Users";
import Index from "./pages/Index";
import ErrorDetails from "./pages/ErrorDetails";
import AIInsights from "./pages/AIInsights";
import Conversas from "./pages/Conversas";
import Influencers from "./pages/Influencers";
import Partners from "./pages/Partners";
import PartnerSolicitations from "./pages/PartnerSolicitations";
import PartnerForms from "./pages/PartnerForms";
import PartnerUsers from "./pages/PartnerUsers";
import PartnerApplications from "./pages/PartnerApplications";
import Students from "./pages/Students";
import SeanEllis from "./pages/SeanEllis";
import Calendar from "./pages/Calendar";
import KnowledgeBase from "./pages/KnowledgeBase";
import PartnerDashboard from "./pages/PartnerDashboard";
import PartnerPortalForms from "./pages/PartnerPortalForms";
import PassportDashboard from "./pages/PassportDashboard";
import FunnelUsers from "./pages/FunnelUsers";
import NotFound from "./pages/NotFound";
import Institutions from "./pages/educational-data/Institutions";
import Campus from "./pages/educational-data/Campus";
import Courses from "./pages/educational-data/Courses";
import Opportunities from "./pages/educational-data/Opportunities";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <ToasterSonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route element={<AdminLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/errors" element={<ErrorDetails />} />
              <Route path="/ai-insights" element={<AIInsights />} />
              <Route path="/conversas" element={<Conversas />} />
              <Route path="/users" element={<Users />} />
              <Route path="/influencers" element={<Influencers />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/solicitations" element={<PartnerSolicitations />} />
              <Route path="/forms" element={<PartnerForms />} />
              <Route path="/partners-users" element={<PartnerUsers />} />
              <Route path="/applications" element={<PartnerApplications />} />
              <Route path="/passport-dashboard" element={<PassportDashboard />} />
              <Route path="/funnel-users" element={<FunnelUsers />} />
              <Route path="/students" element={<Students />} />
              <Route path="/sean-ellis" element={<SeanEllis />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/educational/institutions" element={<Institutions />} />
              <Route path="/educational/campus" element={<Campus />} />
              <Route path="/educational/courses" element={<Courses />} />
              <Route path="/educational/opportunities" element={<Opportunities />} />
            </Route>

            {/* Partner Portal Routes */}
            <Route element={<PartnerLayout />}>
              <Route path="/partner" element={<PartnerDashboard />} />
              <Route path="/partner/forms" element={<PartnerPortalForms />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
