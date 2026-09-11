import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import EloquentBlogsPage from "./adminPages/EloquentBlogsPage";
import EloquentBlogEditPage from "./adminPages/EloquentBlogEditPage";
import EloquentBlogCreatePage from "./adminPages/EloquentBlogCreatePage";
import EloquentCategoryCreatePage from "./adminPages/EloquentCategoryCreatePage";
import EloquentCategoriesPage from "./adminPages/EloquentCategoriesPage";
import EloquentContactFormPage from "./adminPages/EloquentContactFormPage";
import EloquentUsersPage from "./adminPages/EloquentUsersPage";
import EloquentPrintfulOrdersPage from "./adminPages/EloquentPrintfulOrdersPage";
import EloquentGalleryCreatePage from "./adminPages/EloquentGalleryCreatePage";
import EloquentGalleryPage from "./adminPages/EloquentGalleryPage";
import EloquentHomeCategoriesPage from "./adminPages/EloquentHomeCategoriesPage";
import EloquentWhatsNewPage from "./adminPages/EloquentWhatsNewPage";
import SignInPage from "./adminPages/SignInPage";
import ErrorPage from "./adminPages/ErrorPage";
import RouteScrollToTop from "./helper/RouteScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <RouteScrollToTop />
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route path="/dashboard" element={<Navigate replace to="/gallery" />} />
        <Route
          path="/blogs"
          element={<ProtectedRoute element={EloquentBlogsPage} />}
        />
        <Route
          path="/blogs/create"
          element={<ProtectedRoute element={EloquentBlogCreatePage} />}
        />
        <Route
          path="/blogs/edit/:id"
          element={<ProtectedRoute element={EloquentBlogEditPage} />}
        />
        <Route
          path="/categories"
          element={<ProtectedRoute element={EloquentCategoriesPage} />}
        />
        <Route
          path="/categories/create"
          element={<ProtectedRoute element={EloquentCategoryCreatePage} />}
        />
        <Route
          path="/whats-new"
          element={<ProtectedRoute element={EloquentWhatsNewPage} />}
        />
        <Route
          path="/home-categories"
          element={<ProtectedRoute element={EloquentHomeCategoriesPage} />}
        />
        <Route
          path="/home-categories/:categoryId"
          element={<ProtectedRoute element={EloquentHomeCategoriesPage} />}
        />
        <Route
          path="/gallery"
          element={<ProtectedRoute element={EloquentGalleryPage} />}
        />
        <Route
          path="/gallery/create"
          element={<ProtectedRoute element={EloquentGalleryCreatePage} />}
        />
        <Route
          path="/all-users"
          element={<ProtectedRoute element={EloquentUsersPage} />}
        />
        <Route
          path="/printful-orders"
          element={<ProtectedRoute element={EloquentPrintfulOrdersPage} />}
        />
        <Route
          path="/contact-form"
          element={<ProtectedRoute element={EloquentContactFormPage} />}
        />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
