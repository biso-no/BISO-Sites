import { createBrowserRouter } from "react-router";
import { AdminLayout } from "./components/AdminLayout";
import { ActivityLog } from "./pages/ActivityLog";
import { BenefitEditor } from "./pages/BenefitEditor";
import { BenefitManagement } from "./pages/BenefitManagement";
import { Dashboard } from "./pages/Dashboard";
import { DepartmentManagement } from "./pages/DepartmentManagement";
import { EventEditor } from "./pages/EventEditor";
import { EventManagement } from "./pages/EventManagement";
import { JobEditor } from "./pages/JobEditor";
import { JobManagement } from "./pages/JobManagement";
import { NewsEditor } from "./pages/NewsEditor";
import { NewsManagement } from "./pages/NewsManagement";
import { PageEditor } from "./pages/PageEditor";
import { PageManagement } from "./pages/PageManagement";
import { PartnerManagement } from "./pages/PartnerManagement";
import { ProductEditor } from "./pages/ProductEditor";
import { ProductManagement } from "./pages/ProductManagement";
import { ReviewDrafts } from "./pages/ReviewDrafts";
import { SettingsPage } from "./pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AdminLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "pages", Component: PageManagement },
      { path: "departments", Component: DepartmentManagement },
      { path: "jobs", Component: JobManagement },
      { path: "jobs/:id", Component: JobEditor },
      { path: "events", Component: EventManagement },
      { path: "events/:id", Component: EventEditor },
      { path: "shop", Component: ProductManagement },
      { path: "shop/:id", Component: ProductEditor },
      { path: "benefits", Component: BenefitManagement },
      { path: "benefits/partners", Component: PartnerManagement },
      { path: "benefits/:id", Component: BenefitEditor },
      { path: "news", Component: NewsManagement },
      { path: "news/:id", Component: NewsEditor },
      { path: "settings", Component: SettingsPage },
      { path: "activity", Component: ActivityLog },
      { path: "drafts", Component: ReviewDrafts },
    ],
  },
  {
    path: "/editor/:id",
    Component: PageEditor, // Editor gets full screen, no standard sidebar
  },
]);
