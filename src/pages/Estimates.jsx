import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { postRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { Search, ClipboardList } from "lucide-react";

export default function Estimates() {

  const { blockId } = useParams();

  const [estimates, setEstimates] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});

  /* ---------------- LOAD ---------------- */
  useEffect(() => {
    loadEstimates();
    loadDicts();
  }, [page]);

  const loadEstimates = async () => {

    const res = await postRequest("/materialEstimates/search", {
      block_id: Number(blockId),
      status: 1,
      page,
      size: 10,
      search
    });

    if (res.success) {
      setEstimates(res.data);
      setPagination(res.pagination);
    }

  };

  const loadDicts = async () => {

    const dicts = await loadDictionaries([
      "materials",
      "unitsOfMeasure",
      "currencies",
      "blockStages",
      "stageSubsections",
      "services"
    ]);

    setDictionaries(dicts);

  };

  const getDictName = (dict, id, field = "label") =>
    dictionaries[dict]?.find(x => x.id === id)?.[field] || "";

  /* ---------------- HELPERS ---------------- */

  const getItemName = (item) => {
    if (item.item_type === 1) {
      return getDictName("materials", item.material_id);
    }
    return getDictName("services", item.service_id);
  };

  const calcItemSum = (item) => {
    return (item.quantity_planned || 0)
      * (item.price || 0)
      * (item.coefficient || 1);
  };

  const calcTotal = (items) => {
    return items.reduce((acc, i) => acc + calcItemSum(i), 0);
  };

  /* ---------------- UI ---------------- */

  return (

    <div className="space-y-4 text-white pb-20">

      {/* HEADER */}
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-green-400" />
        <h1 className="text-lg font-semibold">
          Сметы
        </h1>
      </div>

      {/* SEARCH */}
      <div className="flex gap-2">

        <div className="relative flex-1">

          <Search size={16} className="absolute left-3 top-3 text-gray-400" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm"
          />

        </div>

        <button
          onClick={() => {
            setPage(1);
            loadEstimates();
          }}
          className="px-4 bg-blue-600 rounded-lg text-sm"
        >
          Go
        </button>

      </div>

      {/* LIST */}
      {estimates.map(e => {

        const expanded = expandedId === e.id;
        const total = calcTotal(e.items || []);

        return (

          <div
            key={e.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3"
          >

            <div
              onClick={() => setExpandedId(expanded ? null : e.id)}
              className="cursor-pointer space-y-1"
            >

              {/* TOP */}
              <div className="flex justify-between text-sm">

                <span className="font-semibold">
                  Смета № {e.id}
                </span>

                <span className="text-[11px] text-gray-400">
                  {formatDateTime(e.created_at)}
                </span>

              </div>

              {/* TOTAL */}
              <div className="flex justify-between text-[12px]">

                <span className="text-gray-400">
                  Позиций: {e.items?.length || 0}
                </span>

                <span className="text-green-400 font-medium">
                  {total.toLocaleString()}
                </span>

              </div>

            </div>

            {/* ITEMS */}
            <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-1000 opacity-100 mt-3" : "max-h-0 opacity-0"}`}>

              <div className="mt-2 space-y-2 border-t border-gray-800 pt-2">

                {e.items?.map(item => {

                  const sum = calcItemSum(item);

                  return (

                    <div
                      key={item.id}
                      className="bg-gray-800 rounded p-2 text-xs"
                    >

                      {/* NAME + QTY */}
                      <div className="flex justify-between">

                        <span className="text-sm font-semibold truncate">
                          {getItemName(item)}
                        </span>

                        <span className="text-gray-200 font-medium whitespace-nowrap">
                          {item.quantity_planned}{" "}
                          {getDictName("unitsOfMeasure", item.unit_of_measure)}
                        </span>

                      </div>

                      {/* STAGE */}
                      <div className="text-[10px] text-gray-400 truncate mt-[2px]">

                        {getDictName("blockStages", item.stage_id)}

                        {item.subsection_id && (
                          <>
                            {" "}→ {getDictName("stageSubsections", item.subsection_id)}
                          </>
                        )}

                      </div>

                      {/* 🔥 PRICE + SUM В ОДНОЙ СТРОКЕ */}
                      <div className="flex justify-between items-center mt-[2px]">

                        <span className="text-[10px] text-gray-400">

                          {item.price}{" "}
                          {getDictName("currencies", item.currency, "code")}

                          {item.coefficient > 1 && (
                            <> × {item.coefficient}</>
                          )}

                          {item.currency_rate > 0 && item.currency !== 1 && (
                            <> | курс: {item.currency_rate}</>
                          )}

                        </span>

                        <span className="text-green-300 text-[12px] font-semibold whitespace-nowrap">
                          {sum.toLocaleString()}{" "}
                          {getDictName("currencies", item.currency, "code")}
                        </span>

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
      {pagination && (

        <div className="flex justify-center gap-3 mt-6">

          <button
            disabled={!pagination.hasPrev}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-gray-800 rounded"
          >
            Prev
          </button>

          <span className="text-sm text-gray-400">
            {pagination.page} / {pagination.pages}
          </span>

          <button
            disabled={!pagination.hasNext}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-gray-800 rounded"
          >
            Next
          </button>

        </div>

      )}
    </div>
  );

}