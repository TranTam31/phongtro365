import React from "react";
import axios from "axios";
import { AdminContextProvider } from "./components/AdminContext";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import IndexPage from "./pages/IndexPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";

// axios.defaults.baseURL = "http://localhost:4000";
axios.defaults.baseURL = "http://fall2024c56g11.int3306.freeddns.org/";
axios.defaults.withCredentials = true;

function AdminApp() {
  return (
    <AdminContextProvider>
      <Routes>
        <Route path="/admin" element={<Layout />}>
          <Route index element={
            <ProtectedRoute>
              <RegisterPage />
            </ProtectedRoute>
          } />
          <Route path="login" element={<LoginPage />} />
          <Route path="reports" element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </AdminContextProvider>
  );
}

export default AdminApp;