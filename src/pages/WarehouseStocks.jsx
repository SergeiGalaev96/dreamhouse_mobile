import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftRight,
  Minus,
  Pencil,
  Plus,
  Search,
  Warehouse,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import { getRequest, postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";

const PAGE_SIZE = 10;
const WAREHOUSE_EDITOR_ROLE_IDS = [1, 10];
const EMPTY_WAREHOUSE_FORM = {
  name: "",
  address: "",
  manager_id: "",
  phone: ""
};

export default function WarehouseStocksList() {
  const navigate = useNavigate();
  const { projectId, warehouseId } = useParams();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState("stocks");
  const [stocks, setStocks] = useState([]);
  const [stocksPagination, setStocksPagination] = useState(null);
  const [stocksPage, setStocksPage] = useState(1);
  const [movements, setMovements] = useState([]);
  const [movementsPagination, setMovementsPagination] = useState(null);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementStatus, setMovementStatus] = useState("");
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [dictionaries, setDictionaries] = useState({});
  const [warehouse, setWarehouse] = useState(null);
  const [showWarehouseData, setShowWarehouseData] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE_FORM);
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const cardClass = `${themeSurface.panel(isDark)} mb-px border px-3 py-2.5 text-xs transition hover:border-blue-500`;
  const inactiveTabClass = isDark
    ? "bg-gray-800 text-white"
    : "border border-slate-300 bg-white text-black";
  const canManageWarehouse = WAREHOUSE_EDITOR_ROLE_IDS.includes(Number(user?.role_id));

  useEffect(() => {
    loadDicts();
    loadWarehouse();
  }, []);

  useEffect(() => {
    if (activeTab === "stocks") loadStocks();
    else loadMovements();
  }, [activeTab, stocksPage, movementsPage, search, movementStatus]);

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projects",
      "materials",
      "unitsOfMeasure",
      "materialTypes",
      "materialMovementStatuses",
      "warehouses",
      "users"
    ]);

    setDictionaries(dicts);
  };

  const loadWarehouse = async () => {
    try {
      const res = await getRequest(`/warehouses/getById/${warehouseId}`);
      if (res?.success) setWarehouse(res.data);
    } catch (error) {
      console.error("Warehouse load error", error);
    }
  };

  const loadStocks = async () => {
    try {
      const res = await postRequest("/warehouseStocks/search", {
        warehouse_id: Number(warehouseId),
        search,
        page: stocksPage,
        size: PAGE_SIZE
      });

      if (res?.success) {
        setStocks(res.data || []);
        setStocksPagination(res.pagination || null);
      }
    } catch (error) {
      console.error("Stocks search error", error);
    }
  };

  const loadMovements = async () => {
    try {
      const res = await postRequest("/materialMovements/search", {
        warehouse_id: Number(warehouseId),
        status: movementStatus || undefined,
        page: movementsPage,
        size: PAGE_SIZE
      });

      if (res?.success) {
        setMovements(res.data || []);
        setMovementsPagination(res.pagination || null);
      }
    } catch (error) {
      console.error("Movements search error", error);
    }
  };

  const handleRefresh = async () => {
    await loadWarehouse();
    await loadDicts();
    if (activeTab === "stocks") await loadStocks();
    else await loadTransfers();
  };

  const getDictItem = (dictName, id) =>
    dictionaries[dictName]?.find((item) => Number(item.id) === Number(id));

  const getDictName = (dictName, id, field = "label") =>
    getDictItem(dictName, id)?.[field] || "";

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

  const openWarehouseModal = () => {
    setWarehouseForm({
      name: warehouse?.name || "",
      address: warehouse?.address || "",
      manager_id: warehouse?.manager_id ?? "",
      phone: warehouse?.phone || ""
    });
    setWarehouseModalOpen(true);
  };

  const closeWarehouseModal = () => {
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setWarehouseModalOpen(false);
  };

  const saveWarehouse = async (e) => {
    e.preventDefault();

    if (!warehouse?.id) return;
    if (!warehouseForm.name.trim()) {
      toast.error("Введите название склада");
      return;
    }

    try {
      setSavingWarehouse(true);
      const res = await putRequest(`/warehouses/update/${warehouse.id}`, {
        name: warehouseForm.name.trim(),
        address: warehouseForm.address.trim() || null,
        manager_id: warehouseForm.manager_id === "" ? null : Number(warehouseForm.manager_id),
        phone: warehouseForm.phone.trim() || null
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить склад");
        return;
      }

      toast.success("Данные склада обновлены");
      closeWarehouseModal();
      await loadWarehouse();
      await loadDicts();
    } catch (error) {
      console.error("Warehouse save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения склада");
    } finally {
      setSavingWarehouse(false);
    }
  };

  const pagination = activeTab === "stocks" ? stocksPagination : movementsPagination;
  const page = activeTab === "stocks" ? stocksPage : movementsPage;
  const setPage = activeTab === "stocks" ? setStocksPage : setMovementsPage;

  const statusOptions = useMemo(
    () => dictionaries.materialMovementStatuses || [],
    [dictionaries.materialMovementStatuses]
  );

  const getMovementOperationLabel = (item) => {
    if (item?.operation === "+") return "Приход";
    if (item?.operation === "-") return "Расход";
    if (item?.operation === "=") return "Перемещение";
    return "Перемещение";
  };

  const getMovementSourceLabel = (item) => {
    if (item?.entity_type === "material_write_off") return "Ф-29";
    if (item?.entity_type === "mbp_write_off") return "Акт списания МБП";
    if (item?.entity_type === "warehouse_transfer") return "Накладная перемещения";
    return "";
  };

  const getMovementRouteLabel = (item) => {
    const fromName = getDictName("warehouses", item.from_warehouse_id) || "—";
    const toName = getDictName("warehouses", item.to_warehouse_id) || "—";

    return `${fromName} → ${toName}`;
  };

  const getMovementDetailLabel = (item) => {
    if (item?.operation === "=") {
      return getMovementRouteLabel(item);
    }

    if (item?.operation === "+" || item?.operation === "-") {
      return "";
    }

    return getMovementRouteLabel(item);
  };

  const getMovementOperationClass = (item) => {
    const label = getMovementOperationLabel(item);
    if (label === "Приход") return "text-emerald-400";
    if (label === "Расход") return "text-red-400";
    return "text-blue-400";
  };

  const getMovementQuantityClass = (item) => {
    if (item?.operation === "+") return "text-emerald-400";
    if (item?.operation === "-") return "text-red-400";
    if (item?.operation === "=") {
      if (Number(item.to_warehouse_id) === Number(warehouseId)) return "text-emerald-400";
      if (Number(item.from_warehouse_id) === Number(warehouseId)) return "text-red-400";
    }
    return "text-blue-400";
  };

  const getMovementQuantityPrefix = (item) => {
    if (item?.operation === "+") return "+";
    if (item?.operation === "-") return "-";
    if (item?.operation === "=") {
      if (Number(item.to_warehouse_id) === Number(warehouseId)) return "+";
      if (Number(item.from_warehouse_id) === Number(warehouseId)) return "-";
    }
    return "↔";
  };

  return (
    <div className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Warehouse size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            {getDictName("warehouses", warehouseId)}: {getDictName("projects", projectId)}
          </h1>
        </div>

        <button
          onClick={() => setShowWarehouseData((prev) => !prev)}
          className="text-xs text-blue-500"
        >
          {showWarehouseData ? "Данные ▲" : "Данные ▼"}
        </button>
      </div>

      {showWarehouseData && (
        <div className={`${themeSurface.panel(isDark)} space-y-3 p-3 text-sm`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${themeText.title(isDark)}`}>{warehouse?.name || "-"}</div>
              <div className={`mt-1 text-xs ${themeText.secondary(isDark)}`}>Информация о складе</div>
            </div>

            {canManageWarehouse && (
              <button onClick={openWarehouseModal} className={themeControl.actionTilePadded(isDark)}>
                <Pencil size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="min-w-0">
              <div className={themeText.muted(isDark)}>Адрес</div>
              <div className={`mt-1 break-words ${themeText.primary(isDark)}`}>{warehouse?.address || "-"}</div>
            </div>

            <div className="min-w-0">
              <div className={themeText.muted(isDark)}>Кладовщик</div>
              <div className={`mt-1 break-words ${themeText.primary(isDark)}`}>
                {getDictName("users", warehouse?.manager_id) || "-"}
              </div>
            </div>

            <div className="min-w-0">
              <div className={themeText.muted(isDark)}>Телефон</div>
              <div className={`mt-1 break-words ${themeText.primary(isDark)}`}>{warehouse?.phone || "-"}</div>
            </div>

            <div className="min-w-0">
              <div className={themeText.muted(isDark)}>Проект</div>
              <div className={`mt-1 break-words ${themeText.primary(isDark)}`}>
                {getDictName("projects", projectId) || "-"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => switchTab("stocks")}
          className={`rounded-lg py-2 text-sm ${
            activeTab === "stocks" ? "bg-blue-600 text-white" : inactiveTabClass
          }`}
        >
          Материалы
        </button>

        <button
          onClick={() => switchTab("movements")}
          className={`rounded-lg py-2 text-sm ${
            activeTab === "movements" ? "bg-blue-600 text-white" : inactiveTabClass
          }`}
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

      {activeTab === "movements" && (
        <div className={`${themeSurface.panel(isDark)} mb-4 p-3`}>
          <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Статус движения</div>

          <select
            value={movementStatus}
            onChange={(e) => {
              setMovementStatus(e.target.value);
              setMovementsPage(1);
            }}
            className={modalInputClass}
          >
            <option value="">Все статусы</option>
            {statusOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <PullToRefresh className="space-y-0" onRefresh={handleRefresh}>
        {activeTab === "stocks" &&
          stocks.map((item) => (
            <div key={item.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className={`min-w-0 flex-1 text-sm font-semibold ${themeText.title(isDark)}`}>
                  {getDictName("materials", item.material_id)}
                </div>

                <div className="whitespace-nowrap text-sm text-green-500">
                  {item.quantity}{" "}
                  <span className={`text-xs ${themeText.muted(isDark)}`}>
                    {getDictName("unitsOfMeasure", item.unit_of_measure)}
                  </span>
                </div>
              </div>

              <div className={`mt-1 flex items-center justify-between gap-3 ${themeText.secondary(isDark)}`}>
                <span className="truncate">{getDictName("materialTypes", item.material_type)}</span>
                <span className="whitespace-nowrap">
                  {item.min} / {item.max}
                </span>
              </div>
            </div>
          ))}

        {activeTab === "movements" &&
          <>
            {movements.map((item) => (
              <div key={`movement-${item.id}`} className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${themeText.title(isDark)}`}>
                      {getDictName("materials", item.material_id)}
                    </div>
                    <div className={`mt-1 text-[11px] ${themeText.secondary(isDark)}`}>
                      {formatDateTime(item.created_at || item.date)}
                    </div>
                  </div>

                  <div className={`whitespace-nowrap text-sm ${getMovementQuantityClass(item)}`}>
                    {getMovementQuantityPrefix(item)} {item.quantity}{" "}
                    {getDictName("unitsOfMeasure", getDictItem("materials", item.material_id)?.unit_of_measure)}
                  </div>
                </div>

                <div className={`mt-2 flex items-center gap-2 ${themeText.secondary(isDark)}`}>
                  <ArrowLeftRight size={14} className={`shrink-0 ${getMovementOperationClass(item)}`} />
                  <span className={getMovementOperationClass(item)}>{getMovementOperationLabel(item)}</span>
                  {!!getMovementSourceLabel(item) && (
                    <>
                      <span className={themeText.muted(isDark)}>•</span>
                      <span className="truncate">{getMovementSourceLabel(item)}</span>
                    </>
                  )}
                </div>

                {!!getMovementDetailLabel(item) && (
                  <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-1 ${themeText.muted(isDark)}`}>
                    <span>{getMovementDetailLabel(item)}</span>
                  </div>
                )}

                {item.note && <div className={`mt-2 ${themeText.muted(isDark)}`}>{item.note}</div>}
              </div>
            ))}

            {!movements.length && (
              <div className={`py-6 text-center text-sm ${themeText.secondary(isDark)}`}>
                Перемещений пока нет
              </div>
            )}
          </>}
      </PullToRefresh>

      <div className="mt-6 flex justify-center gap-3">
        <button disabled={!pagination?.hasPrev} onClick={() => setPage(page - 1)} className={pagerButtonClass}>
          Назад
        </button>

        <span className={`text-sm ${themeText.secondary(isDark)}`}>
          {pagination?.page || page} / {pagination?.pages || 1}
        </span>

        <button disabled={!pagination?.hasNext} onClick={() => setPage(page + 1)} className={pagerButtonClass}>
          Далее
        </button>
      </div>

      <div className="fixed bottom-20 right-8 flex flex-col gap-3">
        <button
          onClick={() => navigate(`/projects/${projectId}/warehouses/${warehouseId}/transfer`)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 shadow-xl transition hover:scale-105 hover:bg-blue-500"
        >
          <ArrowLeftRight size={28} className="text-white" />
        </button>

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

      {warehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} w-full max-w-md p-4`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className={`text-lg font-semibold ${themeText.title(isDark)}`}>Данные склада</div>
                <div className={`text-xs ${themeText.secondary(isDark)}`}>Редактирование информации</div>
              </div>

              <button
                onClick={closeWarehouseModal}
                className={`${themeText.secondary(isDark)} ${isDark ? "hover:text-white" : "hover:text-black"}`}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveWarehouse} className="space-y-3">
              <div>
                <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Название</div>
                <input
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={modalInputClass}
                  placeholder="Название склада"
                />
              </div>

              <div>
                <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Адрес</div>
                <input
                  value={warehouseForm.address}
                  onChange={(e) => setWarehouseForm((prev) => ({ ...prev, address: e.target.value }))}
                  className={modalInputClass}
                  placeholder="Адрес"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Кладовщик</div>
                  <select
                    value={warehouseForm.manager_id}
                    onChange={(e) => setWarehouseForm((prev) => ({ ...prev, manager_id: e.target.value }))}
                    className={modalInputClass}
                  >
                    <option value="">Не выбран</option>
                    {(dictionaries.users || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Телефон</div>
                  <input
                    value={warehouseForm.phone}
                    onChange={(e) => setWarehouseForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className={modalInputClass}
                    placeholder="Телефон"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeWarehouseModal} className={subtleButtonClass}>
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingWarehouse ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
