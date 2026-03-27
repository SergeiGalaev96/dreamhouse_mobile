import { useEffect, useState, useContext } from "react";
import { postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";
import { ClipboardList, Search } from "lucide-react";
import { AuthContext } from "../auth/AuthContext";
import toast from "react-hot-toast";

export default function SupplierPurchaseOrders() {

  const { user } = useContext(AuthContext);

  const [orders, setOrders] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");

  const [tab, setTab] = useState("new");

  useEffect(() => {
    loadOrders();
    console.log("SUPP PURCH ORD")
  }, [page, search, tab]);

  useEffect(() => {
    loadDicts();
  }, []);

  /* ---------------- STATUS FILTER ---------------- */

  const getStatusesByTab = () => {
    if (tab === "new") return [1];
    if (tab === "active") return [2, 5];
    return [4];
  };

  /* ---------------- LOAD ---------------- */

  const loadOrders = async () => {

    const res = await postRequest("/purchaseOrders/search", {
      supplier_id: user?.supplier_id,
      item_statuses: getStatusesByTab(),
      page,
      size: 10,
      search
    });

    if (res.success) {
      // console.log("ORD", res)
      // убираем заявки без items
      const filtered = res.data.filter(o => o.items?.length > 0);

      setOrders(filtered);
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

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  /* ---------------- ACTIONS ---------------- */

  const updateStatus = async (id, status) => {

    try {

      const res = await putRequest(
        `/purchaseOrderItems/update/${id}`,
        { status }
      );

      if (res.success) {
        toast.success(res.message);
        await loadOrders();
      } else {
        toast.error(res.message);
      }

    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Ошибка"
      );
    }

  };

  /* ---------------- SEARCH ---------------- */

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  /* ---------------- UI ---------------- */

  return (

    <div className="space-y-4 text-white pb-24">

      {/* HEADER */}
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-green-400" />
        <h1 className="text-lg font-semibold">
          Мои поставки
        </h1>
      </div>

      {/* TABS */}
      <div className="flex gap-2">

        <button
          onClick={() => { setTab("new"); setPage(1); }}
          className={`flex-1 py-2 rounded ${tab === "new" ? "bg-blue-600" : "bg-gray-800"}`}
        >
          Новые
        </button>

        <button
          onClick={() => { setTab("active"); setPage(1); }}
          className={`flex-1 py-2 rounded ${tab === "active" ? "bg-blue-600" : "bg-gray-800"}`}
        >
          В доставке
        </button>

        <button
          onClick={() => { setTab("done"); setPage(1); }}
          className={`flex-1 py-2 rounded ${tab === "done" ? "bg-blue-600" : "bg-gray-800"}`}
        >
          Завершенные
        </button>

      </div>

      {/* SEARCH */}
      <div className="flex gap-2">

        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm"
          />
        </div>

        <button
          onClick={handleSearch}
          className="px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
        >
          Go
        </button>

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
              className="cursor-pointer"
            >

              {/* строка 1 */}
              <div className="flex justify-between items-center">

                <span className="text-sm font-semibold">
                  Заявка №{order.id}
                </span>

                <span className="text-[11px] text-gray-400">
                  {formatDateTime(order.created_at)}
                </span>

              </div>

              {/* строка 2 */}
              <div className="flex justify-between items-center mt-1">

                {/* объект + блок */}
                <div className="flex items-center gap-2 text-[12px] truncate">

                  <span className="text-gray-200 truncate">
                    {getDictName("projects", order.project_id) || "Без объекта"}
                  </span>

                  <span className="text-gray-600">•</span>

                  <span className="text-gray-500 whitespace-nowrap">
                    {getDictName("projectBlocks", order.block_id) || "—"}
                  </span>

                </div>

                {/* сумма */}
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  Сумма:{" "}
                  <span className="text-green-400 font-medium">
                    {totalSum}
                  </span>
                </span>

              </div>

            </div>

            {/* ITEMS */}
            {expanded && (

              <div className="mt-3 space-y-2 border-t border-gray-800 pt-3">

                {order.items.map(item => (

                  <div
                    key={item.id}
                    className="bg-gray-800 rounded p-3 space-y-2"
                  >

                    <div className="flex justify-between">

                      <span className="font-semibold">
                        {getDictName("materials", item.material_id)}
                      </span>

                      <span>
                        {item.quantity}{" "}
                        {getDictName("unitsOfMeasure", item.unit_of_measure)}
                      </span>

                    </div>

                    <div className="flex justify-between">

                      <span className="text-xs text-gray-400">
                        Цена: {item.price}{" "}
                        {getDictName("currencies", item.currency, "code")}
                      </span>

                      <span className="text-[11px] text-gray-400">
                        {getDictName("purchaseOrderItemStatuses", item.status)}
                      </span>

                    </div>
                    <div className="text-xs text-gray-400">
                      Сумма:{" "}
                      <span className="text-green-400 font-medium">
                        {item.price * item.quantity} {getDictName("currencies", item.currency, "code")}
                      </span>
                    </div>

                    {/* ACTIONS */}
                    {tab === "new" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(item.id, 6)}
                          className="flex-1 bg-red-600 rounded py-1 text-xs"
                        >
                          Отклонить
                        </button>
                        <button
                          onClick={() => updateStatus(item.id, 2)}
                          className="flex-1 bg-green-600 rounded py-1 text-xs"
                        >
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

      {/* PAGINATION */}
      {pagination && (

        <div className="flex justify-center gap-3 mt-6">

          <button
            disabled={!pagination.hasPrev}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm text-gray-400">
            {pagination.page} / {pagination.pages}
          </span>

          <button
            disabled={!pagination.hasNext}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50"
          >
            Next
          </button>

        </div>

      )}

    </div>

  );

}