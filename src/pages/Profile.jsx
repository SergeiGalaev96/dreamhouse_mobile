import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Shield,
  LogOut,
  Phone,
  Building2,
  Calendar,
  Star
} from "lucide-react";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";
import { getRequest } from "../api/request";
import { useNavigate } from "react-router-dom";

export default function Profile() {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [rating, setRating] = useState(null);

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    loadProfile();
    loadDicts();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await getRequest("/auth/profile");
      console.log("USER", res)
      if (res?.success) {
        setUser(res.data);
        // 🔥 грузим рейтинг только если supplier
        if (res.data?.supplier_id) {
          loadRating(res.data.supplier_id);
        }
      }
    } catch (e) {
      console.log("PROFILE ERROR", e);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "userRoles",
      "suppliers",
      "contractors"
    ]);
    setDictionaries(dicts);
  };

  const loadRating = async (supplierId) => {
    try {
      const res = await getRequest(
        `/supplierRating/rating/${supplierId}`
      );
      if (res?.success) {
        setRating(res.data);
      }
    } catch (e) {
      console.log("RATING ERROR", e);
    }
  };

  /* ---------------- UTILS ---------------- */
  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  const renderStars = (value = 0) => {

    const full = Math.floor(value);

    return (
      <div className="flex gap-[2px]">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={14}
            className={
              i < full
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-600"
            }
          />
        ))}
      </div>
    );

  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  /* ---------------- LOADING ---------------- */
  if (!user) {
    return (
      <div className="text-gray-400 text-sm">
        Загрузка профиля...
      </div>
    );
  }

  /* ---------------- UI ---------------- */

  return (

    <div className="space-y-4 text-white">

      <h1 className="text-lg font-semibold">
        Профиль
      </h1>

      {/* USER CARD */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">

        <div className="flex items-center gap-3 mb-4">

          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
            <User size={22} />
          </div>

          <div>
            <p className="font-semibold">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-gray-400">
              @{user?.username}
            </p>
          </div>

        </div>

        <div className="space-y-3 text-sm">

          <div className="flex items-center gap-2 text-gray-300">
            <Mail size={16} className="text-gray-500" />
            {user?.email || "—"}
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <Phone size={16} className="text-gray-500" />
            {user?.phone || "—"}
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <Shield size={16} className="text-gray-500" />
            Роль: {getDictName("userRoles", user?.role_id)}
          </div>

        </div>

      </div>

      {/* COMPANY */}
      {(user?.supplier_id || user?.contractor_id) && (

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">

          <h2 className="text-sm text-gray-400 mb-3">
            Компания
          </h2>

          <div className="space-y-3 text-sm">

            {user?.supplier_id && (
              <>
                <div className="flex items-center gap-2 text-gray-300">
                  <Building2 size={16} className="text-gray-500" />
                  {getDictName("suppliers", user.supplier_id)}
                </div>

                {rating && (
                  <div className="flex items-center justify-between mt-2">

                    <div className="flex items-center gap-2">
                      {renderStars(rating.avg_total_rating)}
                      <span className="text-sm text-gray-300">
                        {rating.avg_total_rating?.toFixed(2)}
                      </span>
                    </div>

                    <span className="text-xs text-gray-500">
                      оценок: {rating.ratings_count}
                    </span>

                  </div>
                )}
              </>
            )}

            {user?.contractor_id && (
              <div className="flex items-center gap-2 text-gray-300">
                <Building2 size={16} className="text-gray-500" />
                {getDictName("contractors", user.contractor_id)}
              </div>
            )}

          </div>

        </div>

      )}

      {/* META */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">

        <h2 className="text-sm text-gray-400 mb-3">
          Информация
        </h2>

        <div className="space-y-3 text-sm text-gray-300">

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-500" />
            Создан: {formatDateTime(user?.created_at)}
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-500" />
            Обновлён: {formatDateTime(user?.updated_at)}
          </div>

        </div>

      </div>

      {/* LOGOUT */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 rounded-lg py-2 text-sm"
      >
        <LogOut size={16} />
        Выход
      </button>

    </div>

  );

}