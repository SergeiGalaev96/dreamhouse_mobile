import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { Search, Warehouse, Plus } from "lucide-react";


export default function WarehouseStocksList() {
  const navigate = useNavigate();

  const { projectId, warehouseId } = useParams();

  const [stocks, setStocks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);

  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");

  const [dictionaries, setDictionaries] = useState({});

  useEffect(() => {
    loadStocks();
    loadDicts();
  }, [page, search]);


  const loadStocks = async () => {
    try {
      const res = await postRequest("/warehouseStocks/search", {
        warehouse_id: Number(warehouseId),
        search,
        page,
        size
      });
      if (res.success) {
        setStocks(res.data);
        setPagination(res.pagination);
      }
    } catch (e) {
      console.log("Stocks error", e);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projects",
      "materials",
      "unitsOfMeasure",
      "materialTypes",
      "warehouses"
    ]);
    setDictionaries(dicts);
  };

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  /* ---------------- SEARCH ACTION ---------------- */
  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  return (

    <div className="space-y-4 text-white pb-24">

      {/* HEADER */}
      <div className="flex justify-between items-center">

        <div className="flex items-center gap-2">
          <Warehouse size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            {getDictName("warehouses", warehouseId)}: {getDictName("projects", projectId)}
          </h1>
        </div>

      </div>

      {/* SEARCH */}
      <div className="flex gap-2 mb-4">

        <div className="relative flex-1">

          <Search
            size={16}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Поиск материалов..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm focus:outline-none focus:border-blue-500"
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
      {stocks.map(s => (
        <div
          key={s.id}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs hover:border-blue-500 transition"
        >

          {/* Верхняя строка */}
          <div className="flex justify-between items-start">

            {/* Название */}
            <div className="text-sm font-semibold text-gray-100 truncate">
              {getDictName("materials", s.material_id)}
            </div>

            {/* Количество справа сверху */}
            <div className="text-sm text-green-400 whitespace-nowrap">
              {s.quantity}{" "}
              <span className="text-gray-500 text-xs">
                {getDictName("unitsOfMeasure", s.unit_of_measure)}
              </span>
            </div>

          </div>

          {/* Нижняя строка */}
          <div className="flex justify-between items-center text-gray-400 mt-1">

            <div className="flex gap-3 flex-wrap">

              <span>
                {getDictName("materialTypes", s.material_type)}
              </span>

            </div>

            <span className="whitespace-nowrap">
              {s.min} / {s.max}
            </span>

          </div>

        </div>

      ))}

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
          navigate(`/projects/${projectId}/warehouses/${warehouseId}/receive`)
        }
        className="fixed bottom-20 right-8 w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center shadow-xl transition hover:scale-105"
      >
        <Plus size={28} className="text-white" />
      </button>
    </div>
  );
}