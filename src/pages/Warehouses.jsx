import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { postRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { Warehouse, Search } from "lucide-react";

export default function Warehouses() {
  const navigate = useNavigate();

  const { projectId } = useParams();

  const [warehouses, setWarehouses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);

  const [search, setSearch] = useState("");
  const [dictionaries, setDictionaries] = useState({});

  useEffect(() => {
    loadWarehouses();
    loadDicts();
  }, [page]);

  const loadWarehouses = async () => {

    const res = await postRequest("/warehouses/search", {
      project_id: Number(projectId),
      name: search || null,
      page,
      size
    });

    if (res.success) {
      setWarehouses(res.data);
      setPagination(res.pagination);
    }

  };

  const loadDicts = async () => {

    const dicts = await loadDictionaries([
      "projects",
      // "projectBlocks",
      "materials",
      "unitsOfMeasure",
      "currencies",
      "suppliers"
    ]);

    setDictionaries(dicts);

  };

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  return (

    <div className="space-y-4 text-white pb-24">

      {/* HEADER */}
      <div className="flex justify-between items-center">

        <div className="flex items-center gap-2">
          <Warehouse size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            Склады: {getDictName("projects", projectId)}
          </h1>
        </div>

      </div>

      {/* SEARCH */}
      <div className="flex gap-2">

        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-3 py-2 w-full">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>

        <button
          onClick={() => {
            setPage(1);
            loadWarehouses();
          }}
          className="px-4 bg-blue-600 rounded text-sm"
        >
          Go
        </button>

      </div>

      {/* LIST */}
      {warehouses.map(w => {

        const totalSum = w.items?.reduce((acc, i) => acc + (i.summ || 0), 0);
        const totalQty = w.items?.reduce((acc, i) => acc + (i.quantity || 0), 0);

        return (

          <div
            key={w.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition"
            onClick={() => navigate(`/projects/${projectId}/warehouses/${w.id}/warehouse-stocks`)}
          >

            <div className="flex justify-between items-center mb-2">

              <div className="text-sm">
                <span className="font-semibold">{w.name}</span>
              </div>

              <div className="text-xs text-gray-400">
                {formatDateTime(w.created_at)}
              </div>

            </div>

            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>
                Позиций: {w.items?.length || 0}
              </span>
              <span>
                Кол-во: {totalQty}
              </span>
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

    </div>

  );

}