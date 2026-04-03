import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";

import { AuthContext } from "../auth/AuthContext";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Projects from "../pages/Projects";
import ProjectCard from "../pages/ProjectCard";
import ProjectDocuments from "../pages/ProjectDocuments";
import Users from "../pages/Users";
import Suppliers from "../pages/Suppliers";
import Contractors from "../pages/Contractors";

import Tasks from "../pages/Tasks";
import Notifications from "../pages/Notifications";

import MaterialRequests from "../pages/MaterialRequests";
import MaterialRequestsCreate from "../pages/MaterialRequestsCreate";

import Estimates from "../pages/Estimates";
import WorkPerformed from "../pages/WorkPerformed";
import WorkPerformedCreate from "../pages/WorkPerformedCreate";

import Warehouses from "../pages/Warehouses";
import WarehouseStocks from "../pages/WarehouseStocks";
import WarehouseReceive from "../pages/WarehouseReceive";

import PurchaseOrders from "../pages/PurchaseOrders";
import PurchaseOrdersCreate from "../pages/PurchaseOrdersCreate";
import SupplierPurchaseOrders from "../pages/SupplierPurchaseOrders";

import PrivateRoute from "../components/PrivateRoute";
import MainLayout from "../layout/MainLayout";

const ADMIN_ROLE_ID = 1;
const SUPPLIER_MANAGER_ROLE_IDS = [ADMIN_ROLE_ID, 10, 11];

export default function Router() {
  const { user } = useContext(AuthContext);
  const canManageUsers = user?.role_id === ADMIN_ROLE_ID;
  const canManageSuppliers = SUPPLIER_MANAGER_ROLE_IDS.includes(user?.role_id);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectCard />} />
          <Route path="/projects/:projectId/documents" element={<ProjectDocuments />} />
          <Route path="/projects/:projectId/tasks" element={<Tasks />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route
            path="/users"
            element={canManageUsers ? <Users /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/suppliers"
            element={canManageSuppliers ? <Suppliers /> : <Navigate to="/dashboard" replace />}
          />
          <Route path="/contractors" element={<Contractors />} />

          <Route
            path="/projects/:projectId/blocks/:blockId/material-requests"
            element={<MaterialRequests />}
          />

          <Route
            path="/projects/:projectId/blocks/:blockId/material-request-create"
            element={<MaterialRequestsCreate />}
          />

          <Route
            path="/projects/:projectId/blocks/:blockId/purchase-orders"
            element={<PurchaseOrders />}
          />

          <Route
            path="/projects/:projectId/blocks/:blockId/purchase-orders-create"
            element={<PurchaseOrdersCreate />}
          />

          <Route path="/supplier-orders" element={<SupplierPurchaseOrders />} />

          <Route
            path="/projects/:projectId/blocks/:blockId/estimates"
            element={<Estimates />}
          />

          <Route
            path="/projects/:projectId/blocks/:blockId/work-performed"
            element={<WorkPerformed />}
          />
          <Route
            path="/projects/:projectId/blocks/:blockId/work-performed-create"
            element={<WorkPerformedCreate />}
          />

          <Route
            path="/projects/:projectId/warehouses"
            element={<Warehouses />}
          />
          <Route
            path="/projects/:projectId/warehouses/:warehouseId/warehouse-stocks"
            element={<WarehouseStocks />}
          />
          <Route
            path="/projects/:projectId/warehouses/:warehouseId/receive"
            element={<WarehouseReceive />}
          />

          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route
          path="/"
          element={
            user?.role_id === 13 ? <Navigate to="/dashboard" /> : <Navigate to="/projects" />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
