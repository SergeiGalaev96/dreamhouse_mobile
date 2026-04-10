import { useEffect, useState, useContext } from "react";
import { postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";
import { ClipboardList, Search } from "lucide-react";
import { AuthContext } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";

export default function SupplierPurchaseOrders() {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [orders, setOrders] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [tab, setTab] = useState("new");

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const cardClass = `${themeSurface.panel(isDark)} p-4`;
  const itemCardClass = `${themeSurface.panelMuted(isDark)} rounded p-3 space-y-2`;
  const inactiveTabClass = isDark ? "bg-gray-800 text-white" : "border border-slate-300 bg-white text-black";
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const pagerTextClass = `text-sm ${themeText.secondary(isDark)}`;

  useEffect(() => {
    loadOrders();
  }, [page, search, tab]);

  useEffect(() => {
    loadDicts();
  }, []);

  const getStatusesByTab = () => {
    if (tab === "new") return [1];
    if (tab === "active") return [2, 5];
    return [4];
  };

  const loadOrders = async () => {
    const res = await postRequest("/purchaseOrders/search", {
      supplier_id: user?.supplier_id,
      item_statuses: getStatusesByTab(),
      page,
      size: 10,
      search
    });

    if (res.success) {
      setOrders((res.data || []).filter((item) => item.items?.length > 0));
      setPagination(res.pagination);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "materials",
      "unitsOfMeasure",
      "currencies",
      "purchaseOrderItemStatuses",
      "projects",
      "projectBlocks",
      "purchaseOrderStatuses"
    ]);
    setDictionaries(dicts);
  };

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const updateStatus = async (id, status) => {
    try {
      const res = await putRequest(`/purchaseOrderItems/update/${id}`, { status });
      if (res.success) {
        toast.success(res.message);
        await loadOrders();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  return (
    <div className={pageClass}>
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-green-400" />
        <h1 className="text-lg font-semibold">Мои поставки</h1>
      </div>

      <div className="flex gap-2">
        <button onClick={() => { setTab("new"); setPage(1); }} className={`flex-1 rounded py-2 ${tab === "new" ? "bg-blue-600 text-white" : inactiveTabClass}`}>Новые</button>
        <button onClick={() => { setTab("active"); setPage(1); }} className={`flex-1 rounded py-2 ${tab === "active" ? "bg-blue-600 text-white" : inactiveTabClass}`}>В доставке</button>
        <button onClick={() => { setTab("done"); setPage(1); }} className={`flex-1 rounded py-2 ${tab === "done" ? "bg-blue-600 text-white" : inactiveTabClass}`}>Завершенные</button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
          <input value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Поиск..." className={inputClass} />
        </div>
        <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500">Go</button>
      </div>

      <PullToRefresh onRefresh={loadOrders}>
        {orders.map((order) => {
          const expanded = expandedId === order.id;
          const totalSum = order.items?.reduce((acc, item) => acc + (item.summ || 0), 0);

          return (
            <div key={order.id} className={cardClass}>
              <div onClick={() => setExpandedId(expanded ? null : order.id)} className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Заявка №{order.id}</span>
                  <span className={`text-[11px] ${themeText.secondary(isDark)}`}>{formatDateTime(order.created_at)}</span>
                </div>

                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate text-[12px]">
                    <span className={isDark ? "truncate text-gray-200" : "truncate text-gray-800"}>
                      {getDictName("projects", order.project_id) || "Без объекта"}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className={themeText.muted(isDark)}>
                      {getDictName("projectBlocks", order.block_id) || "—"}
                    </span>
                  </div>

                  <span className={`whitespace-nowrap text-[11px] ${themeText.secondary(isDark)}`}>
                    Сумма: <span className="font-medium text-green-500">{totalSum}</span>
                  </span>
                </div>
              </div>

              {expanded && (
                <div className={`mt-3 space-y-2 border-t pt-3 ${isDark ? "border-gray-800" : "border-slate-200"}`}>
                  {order.items.map((item) => (
                    <div key={item.id} className={itemCardClass}>
                      <div className="flex justify-between">
                        <span className="font-semibold">{getDictName("materials", item.material_id)}</span>
                        <span>
                          {item.quantity} {getDictName("unitsOfMeasure", item.unit_of_measure)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className={`text-xs ${themeText.secondary(isDark)}`}>
                          Цена: {item.price} {getDictName("currencies", item.currency, "code")}
                        </span>

                        <span className={`text-[11px] ${themeText.secondary(isDark)}`}>
                          {getDictName("purchaseOrderItemStatuses", item.status)}
                        </span>
                      </div>

                      <div className={`text-xs ${themeText.secondary(isDark)}`}>
                        Сумма: <span className="font-medium text-green-500">{item.price * item.quantity} {getDictName("currencies", item.currency, "code")}</span>
                      </div>

                      {tab === "new" && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(item.id, 6)} className="flex-1 rounded py-1 text-xs text-white bg-red-600">
                            Отклонить
                          </button>
                          <button onClick={() => updateStatus(item.id, 2)} className="flex-1 rounded py-1 text-xs text-white bg-green-600">
                            На доставку
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </PullToRefresh>

      {pagination && (
        <div className="mt-6 flex justify-center gap-3">
          <button disabled={!pagination.hasPrev} onClick={() => setPage(page - 1)} className={pagerButtonClass}>Назад</button>
          <span className={pagerTextClass}>{pagination.page} / {pagination.pages}</span>
          <button disabled={!pagination.hasNext} onClick={() => setPage(page + 1)} className={pagerButtonClass}>Далее</button>
        </div>
      )}
    </div>
  );
}
