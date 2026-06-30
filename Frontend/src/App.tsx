import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Register from './pages/Register';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAuthStore((state) => state.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const Dashboard = () => <div>Trang Chủ</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Các trang công khai */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Các trang phải đăng nhập mới vào được */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App
