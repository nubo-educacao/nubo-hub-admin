import { Toaster } from "@/components/ui/toaster";
import { Toaster as ToasterSonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AdminLayout from "./components/layout/AdminLayout";
import Login from "./pages/Login";
import Users from "./pages/Users";
import Index from "./pages/Index";
import ErrorDetails from "./pages/ErrorDetails";
import AIInsights from "./pages/AIInsights";
import Conversas from "./pages/Conversas";
import Influencers from "./pages/Influencers";
import Partners from "./pages/Partners";
import NotFound from "./pages/NotFound";

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

            <Route element={<AdminLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/errors" element={<ErrorDetails />} />
              <Route path="/ai-insights" element={<AIInsights />} />
              <Route path="/conversas" element={<Conversas />} />
              <Route path="/users" element={<Users />} />
              <Route path="/influencers" element={<Influencers />} />
              <Route path="/partners" element={<Partners />} />
            </Route>


            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
