import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { Search, Warehouse, Plus, ArrowLeftRight, Minus } from "lucide-react";
import { formatDateTime } from "../utils/date";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeMisc, themeSurface, themeText } from "../utils/themeStyles";
import PullToRefresh from "../components/PullToRefresh";

const PAGE_SIZE = 10;

export default function WarehouseStocksList() {
  const navigate = useNavigate();
  const { projectId, warehouseId } = useParams();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("stocks");
  const [stocks, setStocks] = useState([]);
  const [stocksPagination, setStocksPagination] = useState(null);
  const [stocksPage, setStocksPage] = useState(1);
  const [movements, setMovements] = useState([]);
  const [movementsPagination, setMovementsPagination] = useState(null);
  const [movementsPage, setMovementsPage] = useState(1);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [dictionaries, setDictionaries] = useState({});

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const cardClass = `${themeSurface.panel(isDark)} px-3 py-2 text-xs transition hover:border-blue-500`;
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const pagerTextClass = `text-sm ${themeText.secondary(isDark)}`;
  const inactiveTabClass = isDark ? "bg-gray-800 text-white" : "border border-slate-300 bg-white text-black";

  useEffect(() => {
    loadDicts();
  }, []);

  useEffect(() => {
    if (activeTab === "stocks") loadStocks();
    else loadMovements();
  }, [activeTab, stocksPage, movementsPage, search]);

  const loadStocks = async () => {
    try {
      const res = await postRequest("/warehouseStocks/search", {
        warehouse_id: Number(warehouseId),
        search,
        page: stocksPage,
        size: PAGE_SIZE
      });

      if (res.success) {
        setStocks(res.data);
        setStocksPagination(res.pagination);
      }
    } catch (e) {
      console.log("Stocks error", e);
    }
  };

  const loadMovements = async () => {
    try {
      const res = await postRequest("/materialMovements/search", {
        project_id: Number(projectId),
        warehouse_id: Number(warehouseId),
        page: movementsPage,
        size: PAGE_SIZE
      });

      if (res.success) {
        setMovements(res.data);
        setMovementsPagination(res.pagination);
      }
    } catch (e) {
      console.log("Movements error", e);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projects",
      "materials",
      "unitsOfMeasure",
      "materialTypes",
      "warehouses",
      "users"
    ]);
    setDictionaries(dicts);
  };

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const handleSearch = () => {
    setStocksPage(1);
    setMovementsPage(1);
    setSearch(inputSearch);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setStocksPage(1);
    setMovementsPage(1);
  };

  const getMovementOperationLabel = (operation) => {
    if (operation === "+") return "Приход";
    if (operation === "-") return "Расход";
    return "Перемещение";
  };

  const getMovementOperationClass = (operation) => {
    if (operation === "+") return "text-green-400";
    if (operation === "-") return "text-red-400";
    return "text-blue-400";
  };

  const pagination = activeTab === "stocks" ? stocksPagination : movementsPagination;
  const page = activeTab === "stocks" ? stocksPage : movementsPage;
  const setPage = activeTab === "stocks" ? setStocksPage : setMovementsPage;

  const handleRefresh = async () => {
    if (activeTab === "stocks") await loadStocks();
    else await loadMovements();
  };

  return (
    <div className={pageClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            {getDictName("warehouses", warehouseId)}: {getDictName("projects", projectId)}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => switchTab("stocks")}
          className={`rounded-lg py-2 text-sm ${activeTab === "stocks" ? "bg-blue-600 text-white" : inactiveTabClass}`}
        >
          Материалы
        </button>

        <button
          onClick={() => switchTab("movements")}
          className={`rounded-lg py-2 text-sm ${activeTab === "movements" ? "bg-blue-600 text-white" : inactiveTabClass}`}
        >
          Перемещения
        </button>
      </div>

      {activeTab === "stocks" && (
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
            <input
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Поиск материалов..."
              className={inputClass}
            />
          </div>

          <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500">
            Go
          </button>
        </div>
      )}

      <PullToRefresh className="space-y-2.5" onRefresh={handleRefresh}>
        {activeTab === "stocks" && stocks.map((item) => (
          <div key={item.id} className={cardClass}>
            <div className="flex items-start justify-between">
              <div className={`truncate text-sm font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                {getDictName("materials", item.material_id)}
              </div>

              <div className="whitespace-nowrap text-sm text-green-500">
                {item.quantity}{" "}
                <span className={`text-xs ${themeText.muted(isDark)}`}>
                  {getDictName("unitsOfMeasure", item.unit_of_measure)}
                </span>
              </div>
            </div>

            <div className={`mt-1 flex items-center justify-between ${themeText.secondary(isDark)}`}>
              <div className="flex flex-wrap gap-3">
                <span>{getDictName("materialTypes", item.material_type)}</span>
              </div>
              <span className="whitespace-nowrap">
                {item.min} / {item.max}
              </span>
            </div>
          </div>
        ))}

        {activeTab === "movements" && movements.map((item) => (
          <div key={item.id} className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`truncate text-sm font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {getDictName("materials", item.material_id)}
                </div>

                <div className={`mt-1 text-[11px] ${themeText.secondary(isDark)}`}>
                  {formatDateTime(item.created_at || item.date)}
                </div>
              </div>

              <div className={`whitespace-nowrap text-sm ${getMovementOperationClass(item.operation)}`}>
                {item.operation} {item.quantity}
              </div>
            </div>

            <div className={`mt-2 flex items-center gap-2 ${themeText.secondary(isDark)}`}>
              <ArrowLeftRight size={14} className="text-blue-400" />
              <span className="truncate">
                {getDictName("warehouses", item.from_warehouse_id) || "Внешний приход"}
                {" -> "}
                {getDictName("warehouses", item.to_warehouse_id) || "Списание"}
              </span>
            </div>

            <div className={`mt-1 flex justify-between gap-3 ${themeText.muted(isDark)}`}>
              <span className={getMovementOperationClass(item.operation)}>
                {getMovementOperationLabel(item.operation)}
              </span>
              <span className="truncate">{getDictName("users", item.user_id)}</span>
            </div>

            {item.note && <div className={`mt-1 ${themeText.muted(isDark)}`}>{item.note}</div>}
          </div>
        ))}
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

      {activeTab === "stocks" && (
        <div className="fixed bottom-20 right-8 flex flex-col gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}/warehouses/${warehouseId}/write-offs`)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-xl transition hover:scale-105 hover:bg-red-500"
          >
            <Minus size={28} className="text-white" />
          </button>

          <button
            onClick={() => navigate(`/projects/${projectId}/warehouses/${warehouseId}/receive`)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-xl transition hover:scale-105 hover:bg-green-500"
          >
            <Plus size={28} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
