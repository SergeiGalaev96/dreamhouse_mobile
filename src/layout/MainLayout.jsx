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
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../auth/AuthContext";
import { SocketContext } from "../context/socket-context";
import { postRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { themeMisc, themeSurface } from "../utils/themeStyles";

const ADMIN_ROLE_ID = 1;
const SUPPLIER_MANAGER_ROLE_IDS = [ADMIN_ROLE_ID, 10, 11];

export default function MainLayout() {
  const { socket, connected } = useContext(SocketContext);
  const { user, logout } = useContext(AuthContext);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [shake, setShake] = useState(false);
  const shakeTimeoutRef = useRef(null);
  const canVibrateRef = useRef(false);
  const notificationsCountRef = useRef(0);

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

  const triggerNotificationFeedback = useCallback(() => {
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
  }, []);

  const loadNotificationsCount = useCallback(async ({ withFeedback = false } = {}) => {
    if (!user) return;

    try {
      const res = await postRequest("/notifications/search", {
        page: 1,
        size: 1000,
        is_read: false
      });

      if (!res?.success) return;

      const nextCount =
        typeof res.count === "number" ? res.count :
          typeof res.total === "number" ? res.total :
            typeof res?.data?.count === "number" ? res.data.count :
              Array.isArray(res?.data) ? res.data.filter(item => !item.is_read).length :
                0;

      const previousCount = notificationsCountRef.current;
      notificationsCountRef.current = nextCount;
      setNotificationsCount(nextCount);

      if (withFeedback && nextCount > previousCount) {
        triggerNotificationFeedback();
      }
    } catch {
      notificationsCountRef.current = 0;
      setNotificationsCount(0);
    }
  }, [triggerNotificationFeedback, user]);

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

    loadNotificationsCount({ withFeedback: false });
  }, [user, connected, loadNotificationsCount]);

  useEffect(() => {
    if (!user) return;

    const loadOnVisible = () => {
      if (document.visibilityState === "visible") {
        loadNotificationsCount({ withFeedback: true });
      }
    };

    window.addEventListener("focus", loadOnVisible);
    document.addEventListener("visibilitychange", loadOnVisible);

    return () => {
      window.removeEventListener("focus", loadOnVisible);
      document.removeEventListener("visibilitychange", loadOnVisible);
    };
  }, [loadNotificationsCount, user]);

  useEffect(() => {
    const handleNotificationsCountChanged = (event) => {
      const nextCount = event.detail?.count;

      if (typeof nextCount !== "number") {
        loadNotificationsCount({ withFeedback: false });
        return;
      }

      notificationsCountRef.current = nextCount;
      setNotificationsCount(nextCount);
    };

    window.addEventListener("notifications:countChanged", handleNotificationsCountChanged);

    return () => {
      window.removeEventListener("notifications:countChanged", handleNotificationsCountChanged);
    };
  }, [loadNotificationsCount]);

  useEffect(() => {
    if (!socket) return;

    const handleNotifications = (data) => {
      console.log("Notification", data)
      if (typeof data?.count !== "number") return;

      window.dispatchEvent(new CustomEvent("notifications:serverCountChanged", {
        detail: data
      }));

      notificationsCountRef.current = data.count;
      setNotificationsCount(data.count);

      if (data.count > 0) {
        triggerNotificationFeedback();
      }
    };

    const handleNewNotification = (data) => {
      window.dispatchEvent(new CustomEvent("notifications:new", {
        detail: data
      }));

      if (typeof data?.count === "number") {
        notificationsCountRef.current = data.count;
        setNotificationsCount(data.count);
      } else {
        setNotificationsCount(prev => {
          const nextCount = prev + 1;
          notificationsCountRef.current = nextCount;
          return nextCount;
        });
      }

      triggerNotificationFeedback();
    };

    socket.on("notifications:count", handleNotifications);
    socket.on("notifications:new", handleNewNotification);

    return () => {
      socket.off("notifications:count", handleNotifications);
      socket.off("notifications:new", handleNewNotification);
    };
  }, [socket]);

  const loadNotifications = () => {
    navigate("/notifications");
  };

  const shellClass = themeSurface.page(isDark);
  const headerClass = themeSurface.header(isDark);
  const navClass = themeSurface.nav(isDark);
  const menuPanelClass = themeSurface.menu(isDark);
  const menuButtonClass = themeMisc.menuButton(isDark);
  const inactiveNavTextClass = themeMisc.navInactive(isDark);
  const bellButtonClass = themeMisc.bellButton(isDark);
  const menuTriggerClass = themeMisc.menuTrigger(isDark);

  if (!user) return null;

  return (
    <div className={`mx-auto min-h-screen max-w-md ${shellClass}`}>
      <header
        className={`fixed left-0 right-0 top-0 z-40 mx-auto flex max-w-md items-center justify-between px-4 pb-4 ${headerClass}`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <span className="font-semibold">DreamHouse</span>

        <div className="flex items-center gap-4">
          <button
            onClick={loadNotifications}
            className={bellButtonClass}
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

      <main
        className="p-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 72px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)"
        }}
      >
        <Outlet />
      </main>

      <nav
        className={`fixed bottom-0 left-0 right-0 mx-auto flex max-w-md justify-around px-3 pt-3 ${navClass}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? "text-blue-500" : inactiveNavTextClass}`
          }
        >
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>

        {isSupplier ? (
          <NavLink
            to="/supplier-orders"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? "text-blue-500" : inactiveNavTextClass}`
            }
          >
            <ClipboardList size={18} />
            Заявки
          </NavLink>
        ) : (
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? "text-blue-500" : inactiveNavTextClass}`
            }
          >
            <FolderKanban size={18} />
            Объекты
          </NavLink>
        )}

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? "text-blue-500" : inactiveNavTextClass}`
          }
        >
          <User size={18} />
          Профиль
        </NavLink>

        <button
          onClick={() => setMenuOpen(true)}
          className={menuTriggerClass}
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
          className={`relative ml-auto w-64 space-y-3 border-l p-4 transition-transform duration-300 ease-out pointer-events-auto ${menuPanelClass} ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
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
            className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
              className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
                className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
            className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
              className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
              className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
            className={`flex w-full items-center gap-2 rounded px-3 py-2 transition ${menuButtonClass}`}
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
