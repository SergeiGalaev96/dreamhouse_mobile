import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";

import { AuthContext } from "../auth/AuthContext";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Projects from "../pages/Projects";
import ProjectCard from "../pages/ProjectCard";
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



export default function Router() {

  const { user } = useContext(AuthContext);

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

          {/* DASHBOARD */}

          <Route path="/dashboard" element={<Dashboard />} />


          {/* PROJECTS */}

          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectCard />} />


          {/* PROJECT REQUESTS */}

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

          {/* BLOCK ESTIMATES */}

          <Route
            path="/projects/:projectId/blocks/:blockId/estimates"
            element={<Estimates />}
          />


          {/* BLOCK REQUESTS */}



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




          {/* PROFILE */}

          <Route path="/profile" element={<Profile />} />

        </Route>

        <Route
          path="/"
          element={
            user?.role_id === 13
              ? <Navigate to="/dashboard" />
              : <Navigate to="/projects" />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}