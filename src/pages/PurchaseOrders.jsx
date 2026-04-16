import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ClipboardList, Plus, Search } from "lucide-react";
import { postRequest, putRequest } from "../api/request";
import { AuthContext } from "../auth/AuthContext";
import PullToRefresh from "../components/PullToRefresh";
import { useTheme } from "../context/ThemeContext";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const PURCHASE_STATUS_EDITOR_ROLE_IDS = [1, 7, 10, 11];

export default function PurchaseOrdersList() {
  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [tab, setTab] = useState("new");

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const cardClass = `${themeSurface.panel(isDark)} p-4 transition hover:border-blue-500`;
  const itemCardClass = `${themeSurface.panelMuted(isDark)} rounded p-3 text-xs`;
  const inactiveTabClass = isDark ? "bg-gray-800 text-white" : "border border-slate-300 bg-white text-black";
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const pagerTextClass = `text-sm ${themeText.secondary(isDark)}`;
  const canManagePurchaseStatuses = PURCHASE_STATUS_EDITOR_ROLE_IDS.includes(Number(user?.role_id));

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
      project_id: Number(projectId),
      block_id: blockId ? Number(blockId) : null,
      item_statuses: getStatusesByTab(),
      search,
      page,
      size: 10
    });

    if (res.success) {
      setOrders(res.data || []);
      setPagination(res.pagination);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projectBlocks",
      "materials",
      "unitsOfMeasure",
      "currencies",
      "suppliers",
      "purchaseOrderStatuses",
      "purchaseOrderItemStatuses"
    ]);
    setDictionaries(dicts);
  };

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const poStatusStyles = {
    1: "bg-blue-500/10 text-blue-400",
    2: "bg-yellow-500/10 text-yellow-400",
    3: "bg-red-500/10 text-red-400",
    4: "bg-green-500/10 text-green-400",
    5: "bg-orange-500/10 text-orange-400",
    6: "bg-gray-500/10 text-gray-400"
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

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

  return (
    <div className={pageClass}>
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">Закуп: {getDictName("projectBlocks", blockId)}</h1>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setTab("new");
            setPage(1);
          }}
          className={`flex-1 rounded py-2 ${tab === "new" ? "bg-blue-600 text-white" : inactiveTabClass}`}
        >
          Новые
        </button>
        <button
          onClick={() => {
            setTab("active");
            setPage(1);
          }}
          className={`flex-1 rounded py-2 ${tab === "active" ? "bg-blue-600 text-white" : inactiveTabClass}`}
        >
          В доставке
        </button>
        <button
          onClick={() => {
            setTab("done");
            setPage(1);
          }}
          className={`flex-1 rounded py-2 ${tab === "done" ? "bg-blue-600 text-white" : inactiveTabClass}`}
        >
          Завершенные
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Поиск..."
            className={inputClass}
          />
        </div>
        <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500">
          Go
        </button>
      </div>

      <PullToRefresh className="space-y-2.5" onRefresh={loadOrders}>
        {orders.map((order) => {
          const expanded = expandedId === order.id;
          const totalSum = order.items?.reduce((acc, item) => acc + (item.summ || 0), 0);

          return (
            <div key={order.id} className={cardClass}>
              <div onClick={() => setExpandedId(expanded ? null : order.id)} className="cursor-pointer">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm">
                    Заявка №<span className="font-semibold">{order.id}</span>
                  </div>
                  <div className={`text-xs ${themeText.secondary(isDark)}`}>{formatDateTime(order.created_at)}</div>
                </div>

                <div className={`mb-2 flex justify-between text-xs ${themeText.secondary(isDark)}`}>
                  <span className="font-medium text-yellow-400">{getDictName("purchaseOrderStatuses", order.status)}</span>
                  <span>Позиций: {order.items?.length || 0}</span>
                </div>

                <div className={`text-xs ${themeText.secondary(isDark)}`}>
                  Сумма: <span className={isDark ? "font-medium text-white" : "font-medium text-black"}>{totalSum}</span>
                </div>
              </div>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  expanded ? "mt-3 max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className={`space-y-2 border-t pt-3 ${isDark ? "border-gray-800" : "border-slate-200"}`}>
                  {order.items?.map((item) => (
                    <div key={item.id} className={`${itemCardClass} relative`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className={`truncate text-sm font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                            {getDictName("materials", item.material_id)}
                          </span>

                          <span className={themeText.secondary(isDark)}>
                            Поставщик:{" "}
                            <span className={isDark ? "text-gray-200" : "text-gray-800"}>
                              {getDictName("suppliers", item.supplier_id)}
                            </span>
                          </span>

                          <span className={themeText.secondary(isDark)}>
                            Цена: {item.price} {getDictName("currencies", item.currency, "code")}
                            {item.currency_rate && <> | курс: {item.currency_rate}</>}
                          </span>

                          <div className="mt-1 flex items-center justify-between">
                            <span className={themeText.secondary(isDark)}>
                              Сумма: <span className="font-medium text-green-500">{item.summ}</span>
                            </span>

                            <span
                              className={`absolute bottom-2 right-2 rounded px-2 py-[2px] text-[11px] ${
                                poStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"
                              }`}
                            >
                              {getDictName("purchaseOrderItemStatuses", item.status)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end">
                          <span className={isDark ? "whitespace-nowrap text-sm text-gray-300" : "whitespace-nowrap text-sm text-gray-700"}>
                            {item.quantity}{" "}
                            <span className={`text-xs ${themeText.muted(isDark)}`}>
                              {getDictName("unitsOfMeasure", item.unit_of_measure)}
                            </span>
                          </span>
                        </div>
                      </div>

                      {tab === "new" && canManagePurchaseStatuses && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => updateStatus(item.id, 6)}
                            className="flex-1 rounded bg-red-600 py-1 text-xs text-white"
                          >
                            Отменить
                          </button>
                          <button
                            onClick={() => updateStatus(item.id, 2)}
                            className="flex-1 rounded bg-green-600 py-1 text-xs text-white"
                          >
                            На доставку
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </PullToRefresh>

      <div className="mt-6 flex justify-center gap-3">
        <button disabled={!pagination?.hasPrev} onClick={() => setPage(page - 1)} className={pagerButtonClass}>
          Назад
        </button>
        <span className={pagerTextClass}>
          {pagination?.page || page} / {pagination?.pages || 1}
        </span>
        <button disabled={!pagination?.hasNext} onClick={() => setPage(page + 1)} className={pagerButtonClass}>
          Далее
        </button>
      </div>

      <button
        onClick={() => navigate(`/projects/${projectId}/blocks/${blockId}/purchase-orders-create`)}
        className="fixed bottom-20 right-8 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-xl hover:bg-green-500"
      >
        <Plus size={28} className="text-white" />
      </button>
    </div>
  );
}
