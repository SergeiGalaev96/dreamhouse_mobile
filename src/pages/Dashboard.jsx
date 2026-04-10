import { useContext, useEffect, useState } from "react";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import { AuthContext } from "../auth/AuthContext";
import { getRequest } from "../api/request";
import PullToRefresh from "../components/PullToRefresh";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { themeSurface, themeText } from "../utils/themeStyles";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [rates, setRates] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const pageClass = `space-y-6 ${themeText.page(isDark)}`;
  const cardClass = `${themeSurface.panel(isDark)} rounded-xl p-4`;

  useEffect(() => {
    loadRates();
    loadDicts();
  }, []);

  const loadRates = async () => {
    try {
      setLoading(true);

      const today = new Date().toISOString().slice(0, 10);
      const res = await getRequest(`/currencyRates/getByDate/${today}`);

      if (res.success) {
        setRates(res.data);
        setUpdatedAt(new Date());
      }
    } catch (e) {
      console.log("Rates error", e);
    } finally {
      setLoading(false);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries(["currencies"]);
    setDictionaries(dicts);
  };

  const getCurrency = (id) => {
    const list = dictionaries.currencies || [];
    return list.find((currency) => currency.id === id) || null;
  };

  const getCurrencyStyle = (code) => {
    switch (code) {
      case "USD":
        return "text-green-400";
      case "EUR":
        return "text-blue-400";
      case "RUB":
        return "text-red-400";
      case "KGS":
        return "text-yellow-400";
      default:
        return isDark ? "text-gray-300" : "text-slate-600";
    }
  };

  return (
    <div className={pageClass}>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>

        <div className={`text-right text-xs ${themeText.secondary(isDark)}`}>
          <div>
            {user?.first_name} {user?.last_name}
          </div>
          <div>{user?.email}</div>
        </div>
      </div>

      <PullToRefresh onRefresh={loadRates}>
        <div className={cardClass}>
          <div className="mb-3 flex items-center justify-between">
            <div className={`text-sm ${themeText.secondary(isDark)}`}>
              Курсы валют на сегодня
            </div>

            <button
              onClick={loadRates}
              className={`transition ${themeText.secondary(isDark)} ${isDark ? "hover:text-white" : "hover:text-black"}`}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {updatedAt && (
            <div className={`mb-2 text-[10px] ${themeText.muted(isDark)}`}>
              обновлено {dayjs(updatedAt).format("HH:mm")}
            </div>
          )}

          <div className="space-y-2">
            {rates.map((rate) => {
              const currency = getCurrency(rate.currency_id);

              if (!currency) return null;

              return (
                <div
                  key={rate.id}
                  className={`flex items-center justify-between border-b py-2 last:border-none ${
                    isDark ? "border-gray-800" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${getCurrencyStyle(currency.code)}`}>
                      {currency.code}
                    </span>

                    <span className={`text-xs ${themeText.muted(isDark)}`}>
                      {currency.label}
                    </span>
                  </div>

                  <div className={`text-lg font-bold ${themeText.primary(isDark)}`}>
                    {rate.rate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
}
