import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { postRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { numberHandler } from "../utils/numberInput";
import { ClipboardList, Warehouse } from "lucide-react";
import toast from "react-hot-toast";

export default function PurchaseOrdersReceive() {

  const { projectId, warehouseId } = useParams();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);

  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [selectedItems, setSelectedItems] = useState({});

  useEffect(() => {
    // console.log("W", warehouseId)
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

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  const poStatusStyles = {
    1: "bg-blue-500/10 text-blue-400",
    2: "bg-yellow-500/10 text-yellow-400",
    3: "bg-red-500/10 text-red-400",
    4: "bg-green-500/10 text-green-400",
    5: "bg-orange-500/10 text-orange-400",
    6: "bg-gray-500/10 text-gray-400"
  };

  /* ---------------- SELECT ---------------- */

  const toggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev[item.id];

      if (exists) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      const availableQty = Math.max(
        0,
        item.quantity - (item.delivered_quantity || 0)
      );

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
    const allSelected = order.items.every(i => selectedItems[i.id]);

    setSelectedItems(prev => {
      const copy = { ...prev };

      order.items.forEach(item => {
        if (allSelected) {
          delete copy[item.id];
        } else {
          copy[item.id] = {
            purchase_order_item_id: item.id,
            received_quantity: item.quantity,
            comment: ""
          };
        }
      });

      return copy;
    });
  };

  const updateQuantity = (id, value) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        received_quantity: value // 🔥 строка
      }
    }));
  };

  /* ---------------- RECEIVE ---------------- */

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

      console.log("RECEIVE ERROR:", err);

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Ошибка сервера"
      );

    }

  };

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-4 text-white pb-28">

      {/* HEADER */}
      <div className="flex justify-between items-center">

        <div className="flex items-center gap-2">
          <Warehouse size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            Приемка: {getDictName("warehouses", warehouseId)}
          </h1>
        </div>

      </div>

      {/* LIST */}
      {orders.map(order => {

        const expanded = expandedId === order.id;
        const totalSum = order.items?.reduce((acc, i) => acc + (i.summ || 0), 0);

        return (

          <div
            key={order.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4"
          >

            {/* HEADER */}
            <div
              onClick={() => setExpandedId(expanded ? null : order.id)}
              className="cursor-pointer relative"
            >

              <div className="flex justify-between items-center mb-2">

                <div className="text-sm">
                  Заявка №<span className="font-semibold">{order.id}</span>
                </div>

                <div className="text-xs text-gray-400">
                  {formatDateTime(order.created_at)}
                </div>

              </div>

              <div className="flex justify-between text-xs text-gray-400 mb-2">

                <span className="text-yellow-400 font-medium">
                  {getDictName("purchaseOrderStatuses", order.status)}
                </span>

                <span>
                  Позиций: {order.items?.length || 0}
                </span>

              </div>

              <div className="flex justify-between items-center text-xs text-gray-400">

                <span>
                  Сумма: <span className="text-white">{totalSum}</span>
                </span>

                <input
                  type="checkbox"
                  checked={order.items?.every(i => selectedItems[i.id])}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleAllInOrder(order);
                  }}
                  className="w-5 h-5 accent-green-500 cursor-pointer"
                />

              </div>



            </div>

            {/* ITEMS */}
            <div
              className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[1000px] opacity-100 mt-3" : "max-h-0 opacity-0"}`}
            >
              <div className="space-y-2 border-t border-gray-800 pt-3">

                {order.items?.map(item => {

                  const selected = selectedItems[item.id];

                  return (

                    <div
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      className={`bg-gray-800 rounded p-3 text-xs cursor-pointer transition border ${selected ? "border-green-500 bg-gray-750" : "border-transparent hover:border-gray-700"}`}
                    >

                      <div className="flex justify-between items-start gap-3">

                        {/* LEFT */}
                        <div className="flex-1 min-w-0">

                          {/* название */}
                          <div className="text-sm font-semibold text-gray-100 truncate">
                            {getDictName("materials", item.material_id)}
                          </div>

                          {/* поставщик */}
                          <div className="text-gray-400">
                            Поставщик:{" "}
                            <span className="text-gray-200">
                              {getDictName("suppliers", item.supplier_id)}
                            </span>
                          </div>

                          {/* статус */}
                          <div className="mt-1">
                            <span className={`inline-block text-[11px] px-2 py-[2px] rounded ${poStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"
                              }`}>
                              {getDictName("purchaseOrderItemStatuses", item.status)}
                            </span>
                          </div>

                          {/* остаток */}
                          <div className="text-[11px] text-green-500 mt-1">
                            Осталось: {Math.max(0, item.quantity - (item.delivered_quantity || 0))}
                          </div>

                          {/* input + комментарий */}
                          {selected && (() => {
                            const availableQty = Math.max(
                              0,
                              item.quantity - (item.delivered_quantity || 0)
                            );

                            return (
                              <>

                                <input
                                  type="text"
                                  inputMode="decimal"
                                  onClick={(e) => e.stopPropagation()}
                                  value={selectedItems[item.id]?.received_quantity ?? ""}
                                  onChange={numberHandler((val) =>
                                    updateQuantity(item.id, val)
                                  )}
                                  className="mt-2 w-24 bg-gray-700 rounded px-2 py-1"
                                />

                                <textarea
                                  value={selected.comment || ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    setSelectedItems(prev => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        comment: e.target.value
                                      }
                                    }))
                                  }
                                  placeholder="Комментарий..."
                                  className="mt-2 w-full bg-gray-700 rounded px-2 py-1 text-xs resize-none"
                                  rows={2}
                                />
                              </>
                            );
                          })()}

                        </div>

                        {/* RIGHT */}
                        <div className="flex flex-col items-end gap-2">

                          {/* количество */}
                          <div className="text-sm text-gray-300 whitespace-nowrap">
                            {item.quantity}{" "}
                            <span className="text-gray-500 text-xs">
                              {getDictName("unitsOfMeasure", item.unit_of_measure)}
                            </span>
                          </div>

                          {/* чекбокс */}
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItem(item);
                            }}
                            readOnly
                            className="w-5 h-5 accent-green-500 cursor-pointer"
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

      {/* PAGINATION */}
      <div className="flex justify-center gap-3 mt-6">

        <button
          disabled={!pagination?.hasPrev}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50"
        >
          Prev
        </button>

        <span className="text-sm text-gray-400">
          {pagination?.page || page} / {pagination?.pages || 1}
        </span>

        <button
          disabled={!pagination?.hasNext}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50"
        >
          Next
        </button>

      </div>

      {/* RECEIVE BUTTON */}
      <button
        onClick={handleReceive}
        disabled={!Object.keys(selectedItems).length}
        className="fixed bottom-16 left-6 right-6 bg-green-600 hover:bg-green-500 py-3 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Принять
      </button>

    </div>

  );

}