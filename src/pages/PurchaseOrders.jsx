import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { postRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { ClipboardList, Plus, Search } from "lucide-react";


export default function PurchaseOrdersList() {

  const { projectId, blockId } = useParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");

  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [tab, setTab] = useState("new");

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
      setOrders(res.data);
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

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  return (

    <div className="space-y-4 text-white pb-24">

      {/* HEADER */}
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">
          Закуп: {getDictName("projectBlocks", blockId)}
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
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition"
          >

            {/* HEADER */}
            <div
              onClick={() => setExpandedId(expanded ? null : order.id)}
              className="cursor-pointer"
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

              <div className="text-xs text-gray-400">
                Сумма:{" "}
                <span className="text-white font-medium">
                  {totalSum}
                </span>
              </div>

            </div>

            {/* ITEMS */}
            <div
              className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-1000 opacity-100 mt-3" : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-2 border-t border-gray-800 pt-3">

                {order.items?.map(item => (

                  <div
                    key={item.id}
                    className="bg-gray-800 rounded p-3 text-xs relative"
                  >

                    <div className="flex justify-between items-start gap-3">

                      {/* LEFT */}
                      <div className="flex flex-col gap-1 flex-1 min-w-0">

                        <span className="text-sm font-semibold text-gray-100 truncate">
                          {getDictName("materials", item.material_id)}
                        </span>

                        <span className="text-gray-400">
                          Поставщик:{" "}
                          <span className="text-gray-200">
                            {getDictName("suppliers", item.supplier_id)}
                          </span>
                        </span>

                        <span className="text-gray-400">
                          Цена: {item.price}{" "}
                          {getDictName("currencies", item.currency, "code")}

                          {item.currency_rate && (
                            <> | курс: {item.currency_rate}</>
                          )}
                        </span>

                        <div className="flex justify-between items-center mt-1">

                          <span className="text-gray-400">
                            Сумма:{" "}
                            <span className="text-green-400 font-medium">
                              {item.summ}
                            </span>
                          </span>

                          <span className={`absolute bottom-2 right-2 text-[11px] px-2 py-[2px] rounded ${poStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"
                            }`}>
                            {getDictName("purchaseOrderItemStatuses", item.status)}
                          </span>

                        </div>

                      </div>

                      {/* RIGHT */}
                      <div className="flex flex-col items-end shrink-0">

                        <span className="text-sm text-gray-300 whitespace-nowrap">
                          {item.quantity}{" "}
                          <span className="text-gray-500 text-xs">
                            {getDictName("unitsOfMeasure", item.unit_of_measure)}
                          </span>
                        </span>

                      </div>

                    </div>

                  </div>

                ))}

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

      {/* CREATE BUTTON */}
      <button
        onClick={() =>
          navigate(`/projects/${projectId}/blocks/${blockId}/purchase-orders-create`)
        }
        className="fixed bottom-20 right-8 w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center shadow-xl"
      >
        <Plus size={28} className="text-white" />
      </button>

    </div>

  );

}