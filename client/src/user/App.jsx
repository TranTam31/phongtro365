import { Route, Routes } from 'react-router-dom';
import IndexPage from './pages/IndexPage';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import RegisterPage from './pages/RegisterPage';
import axios from 'axios';
import { UserContextProvider } from './components/UserContext';
import ProfilePage from './pages/ProfilePage';
import PlacesPage from './pages/PlacesPage';
import PlacesFormPage from './pages/PlacesFormPage';
import PlacePage from './pages/PlacePage';
import BookingsPage from './pages/BookingsPage';
import ProfileVisitPage from './pages/ProfileVisitPage';
import { RedirectIfAuthenticated } from './components/RedirectIfAuthenticated';
import { RequireAuth } from './components/RequireAuth';
import FavouritePage from './pages/FavouritePage';

// axios.defaults.baseURL = 'http://localhost:4000';
axios.defaults.baseURL = 'http://fall2024c56g11.int3306.freeddns.org';
axios.defaults.withCredentials = true;

function App() {
  return (
    <UserContextProvider>
      <Routes>
        {/* Route công khai không yêu cầu đăng nhập */}
        <Route path="/" element={<Layout />}>
          <Route index element={<IndexPage />} />
          
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <RegisterPage />
              </RedirectIfAuthenticated>
            }
          />
        </Route>

        {/* Route yêu cầu đăng nhập */}
        <Route 
          path="/" 
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/account" element={<ProfilePage />} />
          <Route path="/account/places" element={<PlacesPage />} />
          <Route path="/account/places/new" element={<PlacesFormPage />} />
          <Route path="/account/places/:id" element={<PlacesFormPage />} />
          <Route path="/place/:id" element={<PlacePage />} />
          <Route path="/account/bookings" element={<BookingsPage />} />
          <Route path="/account/favourites" element={<FavouritePage />} />
          <Route path="/profile/:id" element={<ProfileVisitPage />} />
        </Route>
      </Routes>
    </UserContextProvider>
  );
}

export default App;
