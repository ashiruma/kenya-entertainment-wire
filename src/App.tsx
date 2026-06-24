import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PublicHome from "./pages/public/Home";
import PublicArticle from "./pages/public/Article";
import LegendPage from "./pages/public/Legend";
import StyleGuide from "./pages/public/StyleGuide";
import AuthPage from "./pages/Auth";
import Discover from "./pages/newsroom/Discover";
import DraftsList from "./pages/newsroom/DraftsList";
import DraftEditor from "./pages/newsroom/DraftEditor";
import Published from "./pages/newsroom/Published";
import Admin from "./pages/newsroom/Admin";
import ScrapeHealth from "./pages/newsroom/ScrapeHealth";
import NewsroomLegends from "./pages/newsroom/Legends";
import DiscoveryAdmin from "./pages/newsroom/DiscoveryAdmin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/category/:category" element={<PublicHome />} />
          <Route path="/article/:id" element={<PublicArticle />} />
          <Route path="/legends/:id" element={<LegendPage />} />
          <Route path="/style-guide" element={<StyleGuide />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/newsroom" element={<Discover />} />
          <Route path="/newsroom/drafts" element={<DraftsList />} />
          <Route path="/newsroom/draft/:id" element={<DraftEditor />} />
          <Route path="/newsroom/published" element={<Published />} />
          <Route path="/newsroom/admin" element={<Admin />} />
          <Route path="/newsroom/health" element={<ScrapeHealth />} />
          <Route path="/newsroom/legends" element={<NewsroomLegends />} />
          <Route path="/newsroom/discovery" element={<DiscoveryAdmin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
