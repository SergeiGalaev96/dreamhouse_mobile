import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useContext, useEffect, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import toast from "react-hot-toast";

import { AuthContext } from "../auth/AuthContext";
import PrivateRoute from "../components/PrivateRoute";
import MainLayout from "../layout/MainLayout";

const Login = lazy(() => import("../pages/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Profile = lazy(() => import("../pages/Profile"));
const Projects = lazy(() => import("../pages/Projects"));
const ProjectCard = lazy(() => import("../pages/ProjectCard"));
const ProjectDocuments = lazy(() => import("../pages/ProjectDocuments"));
const Users = lazy(() => import("../pages/Users"));
const Suppliers = lazy(() => import("../pages/Suppliers"));
const Contractors = lazy(() => import("../pages/Contractors"));
const Tasks = lazy(() => import("../pages/Tasks"));
const Notifications = lazy(() => import("../pages/Notifications"));
const MaterialRequests = lazy(() => import("../pages/MaterialRequests"));
const MaterialRequestsCreate = lazy(() => import("../pages/MaterialRequestsCreate"));
const Estimates = lazy(() => import("../pages/Estimates"));
const WorkPerformed = lazy(() => import("../pages/WorkPerformed"));
const WorkPerformedCreate = lazy(() => import("../pages/WorkPerformedCreate"));
const WarehouseStocks = lazy(() => import("../pages/WarehouseStocks"));
const WarehouseReceive = lazy(() => import("../pages/WarehouseReceive"));
const MaterialWriteOffs = lazy(() => import("../pages/MaterialWriteOffs"));
const PurchaseOrders = lazy(() => import("../pages/PurchaseOrders"));
const PurchaseOrdersCreate = lazy(() => import("../pages/PurchaseOrdersCreate"));
const SupplierPurchaseOrders = lazy(() => import("../pages/SupplierPurchaseOrders"));

const ADMIN_ROLE_ID = 1;
const SUPPLIER_MANAGER_ROLE_IDS = [ADMIN_ROLE_ID, 10, 11];

function RouteLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-400">
      Загрузка...
    </div>
  );
}

function MobileBackHandler({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const historyRef = useRef([]);
  const lastBackPressAtRef = useRef(0);

  const rootPaths = useMemo(() => {
    if (!user) return ["/login"];

    return user.role_id === 13
      ? ["/dashboard", "/supplier-orders", "/profile", "/notifications"]
      : ["/projects", "/dashboard", "/profile", "/notifications"];
  }, [user]);

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const history = historyRef.current;
    const lastPath = history[history.length - 1];

    if (lastPath !== currentPath) {
      history.push(currentPath);
    }
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listener;

    const register = async () => {
      listener = await CapacitorApp.addListener("backButton", () => {
        const isRootPath = rootPaths.includes(location.pathname);
        const history = historyRef.current;

        if (history.length > 1 && !isRootPath) {
          history.pop();
          const previousPath = history[history.length - 1];

          if (previousPath) {
            navigate(previousPath);
            return;
          }
        }

        const now = Date.now();

        if (now - lastBackPressAtRef.current < 2000) {
          CapacitorApp.exitApp();
          return;
        }

        lastBackPressAtRef.current = now;
        toast("Нажмите еще раз для выхода", { icon: "↩" });
      });
    };

    register();

    return () => {
      listener?.remove();
    };
  }, [location.pathname, navigate, rootPaths]);

  return null;
}

export default function Router() {
  const { user } = useContext(AuthContext);
  const canManageUsers = user?.role_id === ADMIN_ROLE_ID;
  const canManageSuppliers = SUPPLIER_MANAGER_ROLE_IDS.includes(user?.role_id);
  const withSuspense = (element) => <Suspense fallback={<RouteLoader />}>{element}</Suspense>;

  return (
    <BrowserRouter>
      <MobileBackHandler user={user} />

      <Routes>
        <Route path="/login" element={withSuspense(<Login />)} />

        <Route
          element={(
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          )}
        >
          <Route path="/dashboard" element={withSuspense(<Dashboard />)} />

          <Route path="/projects" element={withSuspense(<Projects />)} />
          <Route path="/projects/:projectId" element={withSuspense(<ProjectCard />)} />
          <Route path="/projects/:projectId/documents" element={withSuspense(<ProjectDocuments />)} />
          <Route path="/projects/:projectId/tasks" element={withSuspense(<Tasks />)} />
          <Route path="/notifications" element={withSuspense(<Notifications />)} />

          <Route
            path="/users"
            element={canManageUsers ? withSuspense(<Users />) : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/suppliers"
            element={canManageSuppliers ? withSuspense(<Suppliers />) : <Navigate to="/dashboard" replace />}
          />
          <Route path="/contractors" element={withSuspense(<Contractors />)} />

          <Route
            path="/projects/:projectId/blocks/:blockId/material-requests"
            element={withSuspense(<MaterialRequests />)}
          />
          <Route
            path="/projects/:projectId/blocks/:blockId/material-request-create"
            element={withSuspense(<MaterialRequestsCreate />)}
          />
          <Route
            path="/projects/:projectId/blocks/:blockId/purchase-orders"
            element={withSuspense(<PurchaseOrders />)}
          />
          <Route
            path="/projects/:projectId/blocks/:blockId/purchase-orders-create"
            element={withSuspense(<PurchaseOrdersCreate />)}
          />

          <Route path="/supplier-orders" element={withSuspense(<SupplierPurchaseOrders />)} />

          <Route
            path="/projects/:projectId/blocks/:blockId/estimates"
            element={withSuspense(<Estimates />)}
          />
          <Route
            path="/projects/:projectId/blocks/:blockId/work-performed"
            element={withSuspense(<WorkPerformed />)}
          />
          <Route
            path="/projects/:projectId/blocks/:blockId/work-performed-create"
            element={withSuspense(<WorkPerformedCreate />)}
          />

          <Route
            path="/projects/:projectId/warehouses/:warehouseId/warehouse-stocks"
            element={withSuspense(<WarehouseStocks />)}
          />
          <Route
            path="/projects/:projectId/warehouses/:warehouseId/receive"
            element={withSuspense(<WarehouseReceive />)}
          />
          <Route
            path="/projects/:projectId/warehouses/:warehouseId/write-offs"
            element={withSuspense(<MaterialWriteOffs />)}
          />

          <Route path="/profile" element={withSuspense(<Profile />)} />
        </Route>

        <Route
          path="/"
          element={user?.role_id === 13 ? <Navigate to="/dashboard" /> : <Navigate to="/projects" />}
        />
      </Routes>
    </BrowserRouter>
  );
}
