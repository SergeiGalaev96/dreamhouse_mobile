import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftRight, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { numberHandler } from "../utils/numberInput";
import { formatDateTime } from "../utils/date";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";

const PAGE_SIZE = 10;
const WAREHOUSE_OPERATION_ROLE_IDS = [1, 5, 10, 11, 15];

export default function WarehouseTransfer() {
  const { projectId, warehouseId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);
  const canManageWarehouseOperations = WAREHOUSE_OPERATION_ROLE_IDS.includes(Number(user?.role_id));

  const [transfers, setTransfers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [dictionaries, setDictionaries] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [stocksPagination, setStocksPagination] = useState(null);
  const [stocksPage, setStocksPage] = useState(1);
  const [stocksSearch, setStocksSearch] = useState("");
  const [stocksInputSearch, setStocksInputSearch] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [comment, setComment] = useState("");
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedTransferId, setExpandedTransferId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTransfers();
    loadDicts();
  }, [page, status]);

  useEffect(() => {
    if (createOpen) {
      loadStocks();
    }
  }, [createOpen, stocksPage, stocksSearch]);

  useEffect(() => {
    const parentPath = `/projects/${projectId}/warehouses/${warehouseId}/warehouse-stocks`;
    if (typeof window === "undefined") return undefined;

    window.history.pushState({ warehouseTransferListBackGuard: true }, "", window.location.href);

    const handlePopState = () => {
      navigate(parentPath, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate, projectId, warehouseId]);

  useEffect(() => {
    if (user && !canManageWarehouseOperations) {
      toast.error(
        "Приемка, списания и перемещения доступны только админу, зав. складом, мастеру, ПТО и гл. инженеру"
      );
      navigate(`/projects/${projectId}/warehouses/${warehouseId}/warehouse-stocks`, { replace: true });
    }
  }, [canManageWarehouseOperations, navigate, projectId, user, warehouseId]);

  const loadTransfers = async () => {
    const res = await postRequest("/warehouseTransfers/search", {
      warehouse_id: Number(warehouseId),
      status: status || undefined,
      page,
      size: PAGE_SIZE
    });

    if (res.success) {
      setTransfers(res.data || []);
      setPagination(res.pagination || null);
    }
  };

  const loadStocks = async () => {
    const res = await postRequest("/warehouseStocks/search", {
      warehouse_id: Number(warehouseId),
      search: stocksSearch,
      page: stocksPage,
      size: PAGE_SIZE
    });

    if (res.success) {
      setStocks(res.data || []);
      setStocksPagination(res.pagination || null);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projects",
      "warehouses",
      "users",
      "materials",
      "materialTypes",
      "unitsOfMeasure",
      "warehouseTransferStatuses"
    ]);
    setDictionaries(dicts);
  };

  const getDictItem = (dictName, id) =>
    dictionaries[dictName]?.find((item) => Number(item.id) === Number(id));

  const getDictName = (dictName, id, field = "label") =>
    getDictItem(dictName, id)?.[field] || "";

  const formatQuantity = (value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return value || "0";
    return numberValue.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    });
  };

  const openCreateModal = async () => {
    setCreateOpen(true);
    setTargetWarehouseId("");
    setComment("");
    setSelectedItems({});
    setStocksPage(1);
    setStocksSearch("");
    setStocksInputSearch("");
    await loadStocks();
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    setSelectedItems({});
    setComment("");
    setTargetWarehouseId("");
  };

  const handleRefresh = async () => {
    await Promise.all([loadTransfers(), loadDicts()]);
  };

  const handleStocksSearch = () => {
    setStocksPage(1);
    setStocksSearch(stocksInputSearch);
  };

  const updateQuantity = (id, value) => {
    const stock = stocks.find((item) => Number(item.id) === Number(id));
    const maxQuantity = Number(stock?.quantity || 0);
    const numericValue = Number(value || 0);
    const safeValue = numericValue > maxQuantity ? String(maxQuantity) : value;

    setSelectedItems((prev) => {
      const copy = { ...prev };

      if (!safeValue || Number(safeValue) <= 0) {
        delete copy[id];
        return copy;
      }

      copy[id] = {
        stock_id: stock.id,
        material_id: stock.material_id,
        unit_of_measure: stock.unit_of_measure,
        quantity: safeValue
      };

      return copy;
    });
  };

  const signTransfer = async (transferId, side) => {
    try {
      const res = await postRequest(`/warehouseTransfers/sign/${transferId}`, { side });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось подписать накладную");
        return;
      }

      toast.success(res.message || "Накладная подписана");
      await loadTransfers();
    } catch (error) {
      console.error("Transfer sign error", error);
      toast.error(error?.response?.data?.message || "Ошибка подписи накладной");
    }
  };

  const rejectTransfer = async (transferId) => {
    try {
      const res = await postRequest(`/warehouseTransfers/reject/${transferId}`, {});

      if (!res?.success) {
        toast.error(res?.message || "Не удалось отклонить накладную");
        return;
      }

      toast.success(res.message || "Накладная отклонена");
      await loadTransfers();
    } catch (error) {
      console.error("Transfer reject error", error);
      toast.error(error?.response?.data?.message || "Ошибка отклонения накладной");
    }
  };

  const transferWarehouses = useMemo(
    () => (dictionaries.warehouses || []).filter((item) => Number(item.id) !== Number(warehouseId)),
    [dictionaries.warehouses, warehouseId]
  );

  const getWarehouseOptionLabel = (item) => {
    const projectName = getDictName("projects", item.project_id);
    return projectName ? `${item.label} — ${projectName}` : item.label;
  };

  const handleCreateTransfer = async () => {
    if (!targetWarehouseId) {
      toast.error("Выберите склад назначения");
      return;
    }

    const items = Object.values(selectedItems)
      .filter((item) => Number(item.quantity) > 0)
      .map((item) => ({
        material_id: Number(item.material_id),
        unit_of_measure: Number(item.unit_of_measure),
        quantity: Number(item.quantity)
      }));

    if (!items.length) {
      toast.error("Выберите материалы для перемещения");
      return;
    }

    const overLimitItem = Object.values(selectedItems).find((selected) => {
      const stock = stocks.find((item) => Number(item.id) === Number(selected.stock_id));
      return Number(selected.quantity || 0) > Number(stock?.quantity || 0);
    });

    if (overLimitItem) {
      toast.error("Количество не может быть больше остатка на складе");
      return;
    }

    try {
      setSaving(true);

      const res = await postRequest("/warehouseTransfers/create", {
        from_warehouse_id: Number(warehouseId),
        to_warehouse_id: Number(targetWarehouseId),
        comment: comment || null,
        items
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать накладную");
        return;
      }

      toast.success(res.message || "Накладная создана");
      closeCreateModal();
      await loadTransfers();
    } catch (error) {
      console.error("Warehouse transfer create error", error);
      toast.error(error?.response?.data?.message || "Ошибка создания накладной перемещения");
    } finally {
      setSaving(false);
    }
  };

  const pageClass = `${themeText.page(isDark)} space-y-4 pb-24`;
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const cardClass = `${themeSurface.panel(isDark)} mb-px border px-3 py-2.5 text-xs transition hover:border-blue-500`;
  const selectedItemClass = isDark ? "border-blue-500 bg-gray-800" : "border-blue-500 bg-blue-50";
  const unselectedItemClass = isDark
    ? "border-gray-800 bg-gray-800 hover:border-gray-700"
    : "border-slate-200 bg-slate-50 hover:border-slate-300";
  const qtyInputClass = isDark
    ? "mt-2 w-24 rounded bg-gray-700 px-2 py-1 text-xs text-white"
    : "mt-2 w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-black";
  const canSubmit = Object.values(selectedItems).some((item) => Number(item.quantity) > 0) && Boolean(targetWarehouseId) && !saving;

  const getTransferStatusClass = (statusId) => {
    const id = Number(statusId);
    if (id === 1) return "bg-slate-600 text-white";
    if (id === 2) return "bg-blue-600 text-white";
    if (id === 3) return "bg-cyan-600 text-white";
    if (id === 4) return "bg-emerald-600 text-white";
    if (id === 5) return "bg-red-600 text-white";
    return "bg-slate-600 text-white";
  };

  return (
    <div className={pageClass}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-blue-500" />
            <h1 className={`text-lg font-semibold ${themeText.title(isDark)}`}>
              Накладные: {getDictName("warehouses", warehouseId)}
            </h1>
          </div>
        </div>

        <div className={`${themeSurface.panel(isDark)} p-3`}>
          <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Статус накладной</div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={modalInputClass}
          >
            <option value="">Все статусы</option>
            {(dictionaries.warehouseTransferStatuses || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-0">
          {transfers.map((item) => {
            const canSignSender =
              Number(item.from_warehouse_id) === Number(warehouseId) &&
              !item.sender_signed &&
              Number(item.status) !== 4 &&
              Number(item.status) !== 5;

            const canSignReceiver =
              Number(item.to_warehouse_id) === Number(warehouseId) &&
              !item.receiver_signed &&
              Number(item.status) !== 4 &&
              Number(item.status) !== 5;

            const canReject = canSignSender || canSignReceiver || Number(user?.role_id) === 1;
            const expanded = expandedTransferId === item.id;

            return (
              <div
                key={item.id}
                className={`${cardClass} cursor-pointer`}
                onClick={() => setExpandedTransferId((prev) => (prev === item.id ? null : item.id))}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${themeText.title(isDark)}`}>
                      Накладная №{item.id}
                    </div>
                    <div className={`mt-1 text-[11px] ${themeText.secondary(isDark)}`}>
                      {formatDateTime(item.created_at)}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTransferStatusClass(item.status)}`}>
                      {getDictName("warehouseTransferStatuses", item.status) || "—"}
                    </div>
                    {item.posted_at && (
                      <div className={`text-[10px] leading-none ${themeText.muted(isDark)}`}>
                        {formatDateTime(item.posted_at)}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`mt-2 flex items-center gap-2 ${themeText.secondary(isDark)}`}>
                  <ArrowLeftRight size={14} className="shrink-0 text-blue-400" />
                  <span className="truncate">
                    {getDictName("warehouses", item.from_warehouse_id) || "—"} {"→"}{" "}
                    {getDictName("warehouses", item.to_warehouse_id) || "—"}
                  </span>
                </div>

                <div className={`mt-1 ${themeText.muted(isDark)}`}>
                  Создал: {getDictName("users", item.created_user_id) || "—"}
                </div>

                <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-1 ${themeText.muted(isDark)}`}>
                  <span>Отправитель: {item.sender_signed ? "подписал" : "ожидается"}</span>
                  <span>Получатель: {item.receiver_signed ? "подписал" : "ожидается"}</span>
                </div>

                <div className="mt-2">
                  {!!item.items?.length && (
                    <div
                      className={`space-y-1 overflow-hidden border-t transition-all duration-300 ${expanded ? "max-h-[1000px] pt-2 opacity-100" : "max-h-0 pt-0 opacity-0"
                        } ${isDark ? "border-gray-800" : "border-slate-200"}`}
                    >
                      {item.items.map((transferItem) => (
                        <div
                          key={transferItem.id}
                          className={`flex items-center justify-between gap-3 text-[11px] ${themeText.secondary(isDark)}`}
                        >
                          <span className="truncate">{getDictName("materials", transferItem.material_id)}</span>
                          <span className="whitespace-nowrap">
                            {formatQuantity(transferItem.quantity)} {getDictName("unitsOfMeasure", transferItem.unit_of_measure)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(canSignSender || canSignReceiver || canReject) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canSignSender && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            signTransfer(item.id, "sender");
                          }}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
                        >
                          Подписать отправку
                        </button>
                      )}

                      {canSignReceiver && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            signTransfer(item.id, "receiver");
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-500"
                        >
                          Подписать получение
                        </button>
                      )}

                      {canReject && Number(item.status) !== 5 && Number(item.status) !== 4 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectTransfer(item.id);
                          }}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500"
                        >
                          Отклонить
                        </button>
                      )}
                    </div>
                  )}

                  {item.comment && <div className={`mt-2 ${themeText.muted(isDark)}`}>{item.comment}</div>}
                </div>
              </div>
            );
          })}

          {!transfers.length && (
            <div className={`py-6 text-center text-sm ${themeText.secondary(isDark)}`}>
              Накладных на перемещение пока нет
            </div>
          )}
        </div>

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
      </PullToRefresh>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden`}>
            <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
              <div>
                <div className={`text-lg font-semibold ${themeText.title(isDark)}`}>Новая накладная</div>
                <div className={`text-xs ${themeText.secondary(isDark)}`}>Перемещение между складами</div>
              </div>

              <button
                onClick={closeCreateModal}
                className={`${themeText.secondary(isDark)} ${isDark ? "hover:text-white" : "hover:text-black"}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Склад назначения</div>
                  <select
                    value={targetWarehouseId}
                    onChange={(e) => setTargetWarehouseId(e.target.value)}
                    className={modalInputClass}
                  >
                    <option value="">Выберите склад</option>
                    {transferWarehouses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getWarehouseOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className={`mb-1 text-xs ${themeText.secondary(isDark)}`}>Комментарий</div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className={`${modalInputClass} resize-none`}
                    placeholder="Комментарий к накладной..."
                  />
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
                    <input
                      value={stocksInputSearch}
                      onChange={(e) => setStocksInputSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleStocksSearch()}
                      placeholder="Поиск материалов..."
                      className={inputClass}
                    />
                  </div>

                  <button
                    onClick={handleStocksSearch}
                    className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
                  >
                    Go
                  </button>
                </div>

                <div className="space-y-2">
                  {stocks.map((item) => {
                    const selected = selectedItems[item.id];
                    const hasQuantity = Number(selected?.quantity || 0) > 0;

                    return (
                      <div
                        key={item.id}
                        className={`${themeSurface.panel(isDark)} border p-3 text-xs transition ${hasQuantity ? selectedItemClass : unselectedItemClass
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-semibold ${themeText.title(isDark)}`}>
                              {getDictName("materials", item.material_id)}
                            </div>

                            <div className={`mt-1 ${themeText.secondary(isDark)}`}>
                              {getDictName("materialTypes", item.material_type)}
                            </div>

                            <div className="mt-1 text-[11px] text-green-500">
                              Остаток: {item.quantity} {getDictName("unitsOfMeasure", item.unit_of_measure)}
                            </div>

                          </div>

                          <input
                            type="text"
                            inputMode="decimal"
                            value={selected?.quantity ?? ""}
                            onChange={numberHandler((val) => updateQuantity(item.id, val))}
                            className={qtyInputClass}
                            max={item.quantity}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    );
                  })}

                  {!stocks.length && (
                    <div className={`py-4 text-center text-sm ${themeText.secondary(isDark)}`}>
                      Материалов не найдено
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    disabled={!stocksPagination?.hasPrev}
                    onClick={() => setStocksPage(stocksPage - 1)}
                    className={pagerButtonClass}
                  >
                    Назад
                  </button>

                  <span className={`text-sm ${themeText.secondary(isDark)}`}>
                    {stocksPagination?.page || stocksPage} / {stocksPagination?.pages || 1}
                  </span>

                  <button
                    disabled={!stocksPagination?.hasNext}
                    onClick={() => setStocksPage(stocksPage + 1)}
                    className={pagerButtonClass}
                  >
                    Далее
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <button type="button" onClick={closeCreateModal} className={subtleButtonClass}>
                  Отмена
                </button>
                <button
                  onClick={handleCreateTransfer}
                  disabled={!canSubmit}
                  className={`flex-1 rounded-lg py-3 text-sm font-medium text-white ${!canSubmit
                      ? isDark
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-300 text-slate-600"
                      : "bg-blue-600 hover:bg-blue-500"
                    }`}
                >
                  {saving ? "Создание..." : "Создать накладную"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManageWarehouseOperations && (
        <button
          onClick={openCreateModal}
          className="fixed bottom-20 right-8 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-xl transition hover:scale-105 hover:bg-green-500"
        >
          <Plus size={30} className="text-white" />
        </button>
      )}
    </div>
  );
}
