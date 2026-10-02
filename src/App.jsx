import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import ProductsList from './pages/ProductsList.jsx';
import ProductForm from './pages/ProductForm.jsx';

// Маршрутизація — каркас, без реальної перевірки залогіненості
// (буде додано на Етапі 1 разом з реальним /auth/login на бекенді).
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/products" element={<ProductsList />} />
      <Route path="/products/new" element={<ProductForm />} />
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}
