import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SurveyManager } from "@/components/surveys/SurveyManager";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Quotes from "./pages/Quotes";
import Sales from "./pages/Sales";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import NotFound from "./pages/NotFound";
import ClientDashboard from "./pages/ClientDashboard";
import Finance from "./pages/Finance";
import Users from "./pages/Users";
import Surveys from "./pages/Surveys";
import Settings from "./pages/Settings";
import Clients from "./pages/Clients";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SurveyManager>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor', 'tecnico', 'cliente']}>
                  <Orders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/quotes" 
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor', 'cliente']}>
                  <Quotes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ventas" 
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor']}>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/finanzas" 
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                  <Finance />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/technician" 
              element={
                <ProtectedRoute allowedRoles={['tecnico']}>
                  <TechnicianDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/client" 
              element={
                <ProtectedRoute allowedRoles={['cliente']}>
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/users" 
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route 
            path="/clientes" 
            element={
              <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor']}>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/surveys"
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                  <Surveys />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute allowedRoles={['administrador']}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </SurveyManager>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
