import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SurveyManager } from "@/components/surveys/SurveyManager";
import { ClientAwareClientsPage } from "@/components/ClientAwareClientsPage";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Quotes from "./pages/Quotes";
import Sales from "./pages/Sales";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import TechnicianViewer from "./pages/TechnicianViewer";
import NotFound from "./pages/NotFound";
import ClientDashboard from "./pages/ClientDashboard";
import Finance from "./pages/Finance";
import Users from "./pages/Users";
import Surveys from "./pages/Surveys";
import Clients from "./pages/Clients";
import ServiceContracts from "./pages/ServiceContracts";

import Warranties from "./pages/Warranties";
import Fleets from "./pages/Fleets";
import FollowUpPage from "./pages/FollowUp";
import AccessDevelopments from "./pages/AccessDevelopments";
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
                <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor', 'tecnico', 'cliente']}>
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
              path="/technician-viewer" 
              element={
                <ProtectedRoute allowedRoles={['visor_tecnico', 'administrador', 'supervisor']}>
                  <TechnicianViewer />
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
              <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor', 'cliente']}>
                <ClientAwareClientsPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/polizas" 
            element={
              <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor']}>
                <ServiceContracts />
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
               path="/garantias"
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor']}>
                  <Warranties />
                </ProtectedRoute>
              }
            />
             <Route 
               path="/flotillas" 
               element={
                 <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                   <Fleets />
                 </ProtectedRoute>
               }
             />
             <Route 
               path="/seguimiento"
               element={
                 <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                   <FollowUpPage />
                 </ProtectedRoute>
               }
             />
             <Route 
               path="/acceso"
               element={
                 <ProtectedRoute allowedRoles={['administrador', 'supervisor', 'vendedor']}>
                   <AccessDevelopments />
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
