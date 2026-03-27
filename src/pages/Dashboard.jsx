import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../auth/AuthContext";
import { getRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { RefreshCw } from "lucide-react";
import dayjs from "dayjs";

export default function Dashboard() {

  const { user } = useContext(AuthContext);

  const [rates, setRates] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const dictionariesToLoad = ["currencies"];

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
    }

    setLoading(false);

  };

  const loadDicts = async () => {

    const dicts = await loadDictionaries(dictionariesToLoad);
    setDictionaries(dicts);

  };

  useEffect(() => {

    loadRates();
    loadDicts();

  }, []);

  /* -------------------- PULL REFRESH -------------------- */

  useEffect(() => {

    let startY = 0;

    const touchStart = (e) => {
      startY = e.touches[0].clientY;
    };

    const touchEnd = (e) => {

      const endY = e.changedTouches[0].clientY;

      if (window.scrollY === 0 && endY - startY > 120) {
        loadRates();
      }

    };

    window.addEventListener("touchstart", touchStart);
    window.addEventListener("touchend", touchEnd);

    return () => {

      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchend", touchEnd);

    };

  }, []);

  const getCurrency = (id) => {

    const list = dictionaries.currencies || [];
    return list.find(c => c.id === id) || null;

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
        return "text-gray-300";

    }

  };

  return (

    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex justify-between">

        <h1 className="text-lg font-semibold">
          Dashboard
        </h1>

        <div className="text-right text-xs text-gray-400">

          <div>{user?.first_name} {user?.last_name}</div>
          <div>{user?.email}</div>

        </div>

      </div>

      {/* EXCHANGE BOARD */}

      <div
        className="
          bg-gray-900
          border border-gray-800
          rounded-xl
          p-4
        "
      >

        <div className="flex justify-between items-center mb-3">

          <div className="text-sm text-gray-400">
            Курсы валют на сегодня
          </div>

          <button
            onClick={loadRates}
            className="text-gray-400 hover:text-white transition"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </button>

        </div>

        {updatedAt && (

          <div className="text-[10px] text-gray-500 mb-2">
            обновлено {dayjs(updatedAt).format("HH:mm")}
          </div>

        )}

        <div className="space-y-2">

          {rates.map(rate => {

            const currency = getCurrency(rate.currency_id);

            if (!currency) return null;

            return (

              <div
                key={rate.id}
                className="
                  flex
                  justify-between
                  items-center
                  py-2
                  border-b
                  border-gray-800
                  last:border-none
                "
              >

                <div className="flex items-center gap-2">

                  <span className={`font-semibold ${getCurrencyStyle(currency.code)}`}>
                    {currency.code}
                  </span>

                  <span className="text-xs text-gray-500">
                    {currency.label}
                  </span>

                </div>

                <div className="text-lg font-bold">
                  {rate.rate}
                </div>

              </div>

            );

          })}

        </div>

      </div>

    </div>

  );

}