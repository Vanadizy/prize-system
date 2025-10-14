// App.jsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/login";
import ReceptionDashboard from "./pages/Receiption";
import DrinksDashboard from "./pages/DrinksPanel";
import Profile from "./pages/profile";

// Component to encapsulate the Navbar logic and conditional rendering
function NavigationBar() {
  const location = useLocation();

  // Condition: Don't show the Navbar on the login page ("/")
  // if (location.pathname === "/") {
  //   return null;
  // }

  // Tailwind classes for fixed, navy blue, blur, and styling
  // bg-indigo-900 is used for the navbar to match the navy theme
  const navbarClasses = "fixed top-0 left-0 w-full z-50 p-4 shadow-xl text-white " +
                        "bg-indigo-900 bg-opacity-90 backdrop-blur-sm h-16"; 
  
  const linkClasses = "flex items-center gap-2 font-medium hover:text-indigo-200 transition duration-150 p-2 rounded-md";

  return (
    <nav className={navbarClasses}>
      <div className="flex justify-between items-center w-full">
        {/* Left Side: Profile Link */}
        <div className="flex gap-4 items-center">
            {/* You might want a logo/home link here too, e.g., to /admin */}
            <Link to="/profile" className={linkClasses}>
                <span role="img" aria-label="profile">👤</span> Profile
            </Link>
        </div>
        
        {/* Right Side: Logout Link */}
        <div className="flex gap-4">
          <Link 
            to="/login" 
            className={`${linkClasses} bg-indigo-700 hover:bg-red-600`}
            // In a real app, you would add an onClick handler here to clear the session/token
          >
            <span role="img" aria-label="logout">🚪</span> Logout
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  // Using Tailwind to approximate the linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)
  // by using gradient-to-br (bottom-right) with deep blue shades (indigo-900 to blue-900).
  const backgroundClasses = "pt-16 min-h-screen " +
                            "bg-gradient-to-br from-indigo-900 to-blue-900";

  return (
    <Router>
      {/* 1. The conditional Navbar is rendered first */}
      <NavigationBar />

      {/* 2. Content wrapper with pt-16 (padding-top: 4rem) and the new gradient background */}
      <div className={backgroundClasses}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ReceptionDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reception" element={<ReceptionDashboard />} />
          <Route path="/drinks" element={<DrinksDashboard />} />
          {/* Added the route for the /profile link in the navbar */}
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  );
}