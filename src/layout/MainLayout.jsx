import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, User, LogOut, ClipboardList } from "lucide-react";
import { useContext, useEffect } from "react";
import { AuthContext } from "../auth/AuthContext";

export default function MainLayout() {

  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const isSupplier = user?.role_id === 13;

  useEffect(() => {
    if (!user) return;

    // 🔥 если поставщик и зашел не туда
    if (isSupplier && location.pathname.startsWith("/projects")) {
      navigate("/supplier-orders");
    }

  }, [user, location.pathname]);

  return (

    <div className="min-h-screen bg-gray-950 text-white max-w-md mx-auto">

      {/* HEADER */}
      <header className="p-4 border-b border-gray-800 flex justify-between items-center">
        <span className="font-semibold">DreamHouse</span>

        <button
          onClick={logout}
          className="text-gray-400 hover:text-red-400 transition"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* CONTENT */}
      <main className="p-4 pb-24">
        <Outlet />
      </main>

      {/* TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 max-w-md mx-auto flex justify-around p-3">

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? "text-blue-400" : "text-gray-500"}`
          }
        >
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>

        {/* 🔥 УСЛОВИЕ */}
        {isSupplier ? (
          <NavLink
            to="/supplier-orders"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? "text-blue-400" : "text-gray-500"}`
            }
          >
            <ClipboardList size={18} />
            Заявки
          </NavLink>
        ) : (
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? "text-blue-400" : "text-gray-500"}`
            }
          >
            <FolderKanban size={18} />
            Объекты
          </NavLink>
        )}

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? "text-blue-400" : "text-gray-500"}`
          }
        >
          <User size={18} />
          Профиль
        </NavLink>

      </nav>

    </div>

  );
}