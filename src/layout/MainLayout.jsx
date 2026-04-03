import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  User,
  LogOut,
  ClipboardList,
  Menu,
  X,
  Users,
  Truck,
  Wrench,
  Bell
} from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../auth/AuthContext";
import { SocketContext } from "../context/socket-context";
import { postRequest } from "../api/request";

const ADMIN_ROLE_ID = 1;
const SUPPLIER_MANAGER_ROLE_IDS = [ADMIN_ROLE_ID, 10, 11];

export default function MainLayout() {
  const { socket, connected } = useContext(SocketContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [shake, setShake] = useState(false);
  const shakeTimeoutRef = useRef(null);
  const canVibrateRef = useRef(false);

  const isSupplier = user?.role_id === 13;
  const isAdmin = user?.role_id === ADMIN_ROLE_ID;
  const canManageSuppliers = SUPPLIER_MANAGER_ROLE_IDS.includes(user?.role_id);
  const canOpenProjects = !isSupplier;

  useEffect(() => {
    if (!user) return;

    if (isSupplier && location.pathname.startsWith("/projects")) {
      navigate("/supplier-orders");
    }
  }, [user, isSupplier, location.pathname, navigate]);

  const triggerNotificationFeedback = () => {
    setShake(true);

    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }

    shakeTimeoutRef.current = setTimeout(() => {
      setShake(false);
      shakeTimeoutRef.current = null;
    }, 600);

    if (canVibrateRef.current) {
      navigator.vibrate?.(600);
    }
  };

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const enableVibration = () => {
      canVibrateRef.current = true;
    };

    window.addEventListener("pointerdown", enableVibration, { once: true });
    window.addEventListener("touchstart", enableVibration, { once: true });
    window.addEventListener("keydown", enableVibration, { once: true });

    return () => {
      window.removeEventListener("pointerdown", enableVibration);
      window.removeEventListener("touchstart", enableVibration);
      window.removeEventListener("keydown", enableVibration);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    const loadNotificationsCount = async () => {
      try {
        const res = await postRequest("/notifications/search", {
          page: 1,
          size: 1000,
          is_read: false
        });

        if (ignore || !res?.success) return;

        const nextCount =
          typeof res.count === "number" ? res.count :
            typeof res.total === "number" ? res.total :
              typeof res?.data?.count === "number" ? res.data.count :
                Array.isArray(res?.data) ? res.data.filter(item => !item.is_read).length :
                  0;

        setNotificationsCount(nextCount);

        if (nextCount > 0) {
          triggerNotificationFeedback();
        }
      } catch {
        if (!ignore) {
          setNotificationsCount(0);
        }
      }
    };

    loadNotificationsCount();

    return () => {
      ignore = true;
    };
  }, [user, connected]);

  useEffect(() => {
    if (!socket) return;

    const handleNotifications = (data) => {
      if (typeof data?.count !== "number") return;

      setNotificationsCount(data.count);

      if (data.count > 0) {
        triggerNotificationFeedback();
      }
    };

    socket.on("notifications:count", handleNotifications);

    return () => {
      socket.off("notifications:count", handleNotifications);
    };
  }, [socket]);

  const loadNotifications = () => {
    navigate("/notifications");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white max-w-md mx-auto">
      <header className="flex items-center justify-between border-b border-gray-800 p-4">
        <span className="font-semibold">DreamHouse</span>

        <div className="flex items-center gap-4">
          <button
            onClick={loadNotifications}
            className="relative text-gray-400 transition hover:text-white"
          >
            <Bell
              size={20}
              className={shake ? "animate-bell" : ""}
            />

            {notificationsCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px]">
                {notificationsCount > 99 ? "99+" : notificationsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-md justify-around border-t border-gray-800 bg-gray-900 p-3">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? "text-blue-400" : "text-gray-500"}`
          }
        >
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>

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

        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center text-xs text-gray-500 hover:text-white"
        >
          <Menu size={18} />
          Меню
        </button>
      </nav>

      <div className="pointer-events-none fixed inset-0 z-50 flex">
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${menuOpen ? "pointer-events-auto opacity-100" : "opacity-0"}`}
        />

        <div
          className={`relative ml-auto w-64 space-y-3 border-l border-gray-800 bg-gray-900 p-4 transition-transform duration-300 ease-out pointer-events-auto ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-semibold">Меню</span>
            <button onClick={() => setMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <button
            onClick={() => {
              navigate("/dashboard");
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          {isSupplier ? (
            <button
              onClick={() => {
                navigate("/supplier-orders");
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
            >
              <ClipboardList size={18} />
              Заявки
            </button>
          ) : (
            canOpenProjects && (
              <button
                onClick={() => {
                  navigate("/projects");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
              >
                <FolderKanban size={18} />
                Объекты
              </button>
            )
          )}

          <button
            onClick={() => {
              navigate("/profile");
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
          >
            <User size={18} />
            Профиль
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                navigate("/users");
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
            >
              <Users size={18} />
              Пользователи
            </button>
          )}

          {canManageSuppliers && (
            <button
              onClick={() => {
                navigate("/suppliers");
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
            >
              <Truck size={18} />
              Поставщики
            </button>
          )}

          <button
            onClick={() => {
              navigate("/contractors");
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded bg-gray-800 px-3 py-2 transition hover:bg-gray-700"
          >
            <Wrench size={18} />
            Подрядчики
          </button>

          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded bg-red-600 px-3 py-2 transition hover:bg-red-500"
            >
              <LogOut size={18} />
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
