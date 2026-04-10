import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Warehouse } from "lucide-react";
import toast from "react-hot-toast";
import { postRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { numberHandler } from "../utils/numberInput";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

export default function WarehouseReceive() {
  const { projectId, warehouseId } = useParams();
  const { isDark } = useTheme();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [selectedItems, setSelectedItems] = useState({});

  useEffect(() => {
    loadOrders();
    loadDicts();
  }, [page]);

  const loadOrders = async () => {
    const res = await postRequest("/purchaseOrders/search", {
      project_id: Number(projectId),
      item_statuses: [1, 2, 5],
      statuses: [1, 2, 3, 4],
      page,
      size
    });

    if (res.success) {
      setOrders(res.data);
      setPagination(res.pagination);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "materials",
      "unitsOfMeasure",
      "currencies",
      "suppliers",
      "purchaseOrderStatuses",
      "purchaseOrderItemStatuses",
      "warehouses"
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

  const toggleItem = (item) => {
    setSelectedItems((prev) => {
      const exists = prev[item.id];

      if (exists) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      const availableQty = Math.max(0, item.quantity - (item.delivered_quantity || 0));

      return {
        ...prev,
        [item.id]: {
          purchase_order_item_id: item.id,
          received_quantity: availableQty,
          comment: ""
        }
      };
    });
  };

  const toggleAllInOrder = (order) => {
    const allSelected = order.items.every((item) => selectedItems[item.id]);

    setSelectedItems((prev) => {
      const copy = { ...prev };

      order.items.forEach((item) => {
        if (allSelected) {
          delete copy[item.id];
        } else {
          copy[item.id] = {
            purchase_order_item_id: item.id,
            received_quantity: Math.max(0, item.quantity - (item.delivered_quantity || 0)),
            comment: ""
          };
        }
      });

      return copy;
    });
  };

  const updateQuantity = (id, value) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        received_quantity: value
      }
    }));
  };

  const handleReceive = async () => {
    try {
      const items = Object.values(selectedItems);
      if (!items.length) return;

      const res = await postRequest("/purchaseOrderItems/receive", {
        warehouse_id: Number(warehouseId),
        items
      });

      if (res?.success) {
        toast.success(res.message || "Успешно");
        setSelectedItems({});
        loadOrders();
      } else {
        toast.error(res?.message || "Ошибка");
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Ошибка сервера"
      );
    }
  };

  const pageClass = `${themeText.page(isDark)} pb-28`;
  const cardClass = themeSurface.card(isDark);
  const subTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const selectedItemClass = isDark
    ? "border-green-500 bg-gray-800"
    : "border-green-500 bg-green-50";
  const unselectedItemClass = isDark
    ? "border-transparent bg-gray-800 hover:border-gray-700"
    : "border-slate-200 bg-slate-50 hover:border-slate-300";
  const textInputClass = isDark
    ? "mt-2 w-full rounded bg-gray-700 px-2 py-1 text-xs text-white"
    : "mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-black";
  const qtyInputClass = isDark
    ? "mt-2 w-24 rounded bg-gray-700 px-2 py-1 text-xs text-white"
    : "mt-2 w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-black";

  return (
    <div className={`space-y-4 ${pageClass}`}>
      <div className="flex items-center gap-2">
        <Warehouse size={20} className="text-blue-500" />
        <h1 className={`text-lg font-semibold ${themeText.title(isDark)}`}>
          Приемка: {getDictName("warehouses", warehouseId)}
        </h1>
      </div>

      {orders.map((order) => {
        const expanded = expandedId === order.id;
        const totalSum = order.items?.reduce((acc, item) => acc + (item.summ || 0), 0);
        const allSelected = order.items?.length ? order.items.every((item) => selectedItems[item.id]) : false;

        return (
          <div key={order.id} className={`${cardClass} p-4`}>
            <div
              onClick={() => setExpandedId(expanded ? null : order.id)}
              className="cursor-pointer"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className={`text-sm ${themeText.primary(isDark)}`}>
                  Заявка №<span className="font-semibold">{order.id}</span>
                </div>
                <div className={`text-xs ${subTextClass}`}>
                  {formatDateTime(order.created_at)}
                </div>
              </div>

              <div className={`mb-2 flex justify-between text-xs ${subTextClass}`}>
                <span className="font-medium text-yellow-500">
                  {getDictName("purchaseOrderStatuses", order.status)}
                </span>
                <span>Позиций: {order.items?.length || 0}</span>
              </div>

              <div className={`flex items-center justify-between text-xs ${subTextClass}`}>
                <span>
                  Сумма: <span className={themeText.title(isDark)}>{totalSum}</span>
                </span>

                <input
                  type="checkbox"
                  checked={allSelected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleAllInOrder(order);
                  }}
                  className="h-5 w-5 cursor-pointer accent-green-500"
                />
              </div>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-3 max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
              <div className={`space-y-2 border-t pt-3 ${isDark ? "border-gray-800" : "border-slate-200"}`}>
                {order.items?.map((item) => {
                  const selected = selectedItems[item.id];
                  const availableQty = Math.max(0, item.quantity - (item.delivered_quantity || 0));

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      className={`cursor-pointer rounded border p-3 text-xs transition ${selected ? selectedItemClass : unselectedItemClass}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm font-semibold ${themeText.title(isDark)}`}>
                            {getDictName("materials", item.material_id)}
                          </div>

                          <div className={subTextClass}>
                            Поставщик:{" "}
                            <span className={themeText.primary(isDark)}>
                              {getDictName("suppliers", item.supplier_id)}
                            </span>
                          </div>

                          <div className="mt-1">
                            <span className={`inline-block rounded px-2 py-[2px] text-[11px] ${poStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"}`}>
                              {getDictName("purchaseOrderItemStatuses", item.status)}
                            </span>
                          </div>

                          <div className="mt-1 text-[11px] text-green-500">
                            Осталось: {availableQty}
                          </div>

                          {selected && (
                            <>
                              <input
                                type="text"
                                inputMode="decimal"
                                onClick={(e) => e.stopPropagation()}
                                value={selectedItems[item.id]?.received_quantity ?? ""}
                                onChange={numberHandler((val) => updateQuantity(item.id, val))}
                                className={qtyInputClass}
                              />

                              <textarea
                                value={selected.comment || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      comment: e.target.value
                                    }
                                  }))
                                }
                                placeholder="Комментарий..."
                                className={`${textInputClass} resize-none`}
                                rows={2}
                              />
                            </>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className={`whitespace-nowrap text-sm ${themeText.primary(isDark)}`}>
                            {item.quantity}{" "}
                            <span className={`text-xs ${mutedTextClass}`}>
                              {getDictName("unitsOfMeasure", item.unit_of_measure)}
                            </span>
                          </div>

                          <input
                            type="checkbox"
                            checked={!!selected}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItem(item);
                            }}
                            readOnly
                            className="h-5 w-5 cursor-pointer accent-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-6 flex justify-center gap-3">
        <button
          disabled={!pagination?.hasPrev}
          onClick={() => setPage(page - 1)}
          className={pagerButtonClass}
        >
          Назад
        </button>

        <span className={`text-sm ${subTextClass}`}>
          {pagination?.page || page} / {pagination?.pages || 1}
        </span>

        <button
          disabled={!pagination?.hasNext}
          onClick={() => setPage(page + 1)}
          className={pagerButtonClass}
        >
          Далее
        </button>
      </div>

      <button
        onClick={handleReceive}
        disabled={!Object.keys(selectedItems).length}
        className="fixed bottom-16 left-6 right-6 rounded-lg bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
      >
        Принять
      </button>
    </div>
  );
}
