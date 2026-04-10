import { useContext, useEffect, useState } from "react";
import {
  User,
  Mail,
  Shield,
  LogOut,
  Phone,
  Building2,
  Calendar,
  Star,
  Moon,
  Sun
} from "lucide-react";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";
import { getRequest } from "../api/request";
import { AuthContext } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Profile() {
  const { user, logout } = useContext(AuthContext);
  const { theme, isDark, setTheme } = useTheme();

  const [dictionaries, setDictionaries] = useState({});
  const [rating, setRating] = useState(null);

  useEffect(() => {
    loadRating();
    loadDicts();
  }, []);

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "userRoles",
      "suppliers",
      "contractors"
    ]);
    setDictionaries(dicts);
  };

  const loadRating = async () => {
    if (user?.role_id === 13 && user?.supplier_id) {
      try {
        const res = await getRequest(`/supplierRating/rating/${user.supplier_id}`);
        if (res?.success) {
          setRating(res.data);
        }
      } catch (e) {
        console.log("RATING ERROR", e);
      }
    }
  };

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";
  };

  const renderStars = (value = 0) => {
    const full = Math.floor(value);

    return (
      <div className="flex gap-[2px]">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < full ? "fill-yellow-400 text-yellow-400" : (isDark ? "text-gray-600" : "text-gray-400")}
          />
        ))}
      </div>
    );
  };

  const cardClass = isDark
    ? "rounded-xl border border-gray-800 bg-gray-900 p-4"
    : "rounded-xl border border-gray-300 bg-white p-4";

  const pageClass = isDark ? "space-y-4 text-white" : "space-y-4 text-black";
  const mutedTextClass = isDark ? "text-gray-400" : "text-black";
  const rowTextClass = isDark ? "text-gray-300" : "text-black";
  const iconClass = isDark ? "text-gray-500" : "text-black";
  const inactiveThemeButtonClass = isDark
    ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
    : "bg-gray-100 text-black hover:bg-gray-200";

  if (!user) {
    return (
      <div className={`text-sm ${mutedTextClass}`}>
        Загрузка профиля...
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <h1 className="text-lg font-semibold">Профиль</h1>

      <div className={cardClass}>
        <h2 className={`mb-3 text-sm ${mutedTextClass}`}>Тема</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setTheme("dark")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              theme === "dark" ? "bg-blue-600 text-white" : inactiveThemeButtonClass
            }`}
          >
            <Moon size={16} />
            Темная
          </button>

          <button
            onClick={() => setTheme("light")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              theme === "light" ? "bg-blue-600 text-white" : inactiveThemeButtonClass
            }`}
          >
            <Sun size={16} />
            Светлая
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
            <User size={22} />
          </div>

          <div>
            <p className="font-semibold">
              {user?.first_name} {user?.last_name}
            </p>
            <p className={`text-xs ${isDark ? mutedTextClass : "text-black"}`}>
              @{user?.username}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className={`flex items-center gap-2 ${rowTextClass}`}>
            <Mail size={16} className={iconClass} />
            {user?.email || "—"}
          </div>

          <div className={`flex items-center gap-2 ${rowTextClass}`}>
            <Phone size={16} className={iconClass} />
            {user?.phone || "—"}
          </div>

          <div className={`flex items-center gap-2 ${rowTextClass}`}>
            <Shield size={16} className={iconClass} />
            Роль: {getDictName("userRoles", user?.role_id)}
          </div>
        </div>
      </div>

      {(user?.supplier_id || user?.contractor_id) && (
        <div className={cardClass}>
          <h2 className={`mb-3 text-sm ${mutedTextClass}`}>Компания</h2>

          <div className="space-y-3 text-sm">
            {user?.supplier_id && (
              <>
                <div className={`flex items-center gap-2 ${rowTextClass}`}>
                  <Building2 size={16} className={iconClass} />
                  {getDictName("suppliers", user.supplier_id)}
                </div>

                {rating && (
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {renderStars(rating.avg_total_rating)}
                      <span className={`text-sm ${rowTextClass}`}>
                        {rating.avg_total_rating?.toFixed(2)}
                      </span>
                    </div>

                    <span className={`text-xs ${isDark ? iconClass : "text-black"}`}>
                      оценок: {rating.ratings_count}
                    </span>
                  </div>
                )}
              </>
            )}

            {user?.contractor_id && (
              <div className={`flex items-center gap-2 ${rowTextClass}`}>
                <Building2 size={16} className={iconClass} />
                {getDictName("contractors", user.contractor_id)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={cardClass}>
        <h2 className={`mb-3 text-sm ${mutedTextClass}`}>Информация</h2>

        <div className={`space-y-3 text-sm ${rowTextClass}`}>
          <div className="flex items-center gap-2">
            <Calendar size={16} className={iconClass} />
            Создан: {formatDateTime(user?.created_at)}
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className={iconClass} />
            Обновлён: {formatDateTime(user?.updated_at)}
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-500"
      >
        <LogOut size={16} />
        Выход
      </button>
    </div>
  );
}
