import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import ProductsList from './pages/ProductsList.jsx';
import ProductForm from './pages/ProductForm.jsx';
import { isTokenValid } from './lib/api.js';

// Пускає лише з чинним (наявним і не простроченим) токеном, інакше — на /login.
// Це захист інтерфейсу; доступ до даних усе одно перевіряє сервер (requireAdmin).
function RequireAuth({ children }) {
  return isTokenValid() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/products"
        element={
          <RequireAuth>
            <ProductsList />
          </RequireAuth>
        }
      />
      <Route
        path="/products/new"
        element={
          <RequireAuth>
            <ProductForm />
          </RequireAuth>
        }
      />
      <Route
        path="/products/:id/edit"
        element={
          <RequireAuth>
            <ProductForm />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}
