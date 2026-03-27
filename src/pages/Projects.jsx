import { useEffect, useState } from "react";
import { postRequest } from "../api/request";
import { Search, FolderKanban } from "lucide-react";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDate } from "../utils/date";
import { useNavigate } from "react-router-dom";

export default function Projects() {

  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);

  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");

  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState({});

  const pages = Math.ceil(total / size);

  /* ---------------- LOAD ---------------- */

  const loadProjects = async () => {
    try {
      setLoading(true);

      const res = await postRequest("/projects/search", {
        search,
        page,
        size
      });

      if (res.success) {
        setProjects(res.data);
        setTotal(res.pagination.total || 0);
        setPagination(res.pagination);
      }
    } catch (e) {
      console.log("Projects error", e);
    }
    setLoading(false);
  };

  const loadDicts = async () => {

    const dicts = await loadDictionaries(["projectStatuses"]);
    setDictionaries(dicts);

  };

  useEffect(() => {
    loadProjects();
  }, [page, search]);

  useEffect(() => {
    loadDicts();
  }, []);

  /* ---------------- STATUS ---------------- */

  const getStatusStyle = (id) => {

    const status = dictionaries.projectStatuses?.find(
      s => s.id === id
    );

    if (!status)
      return { label: "", color: "bg-gray-700 text-gray-300" };

    switch (status.label) {

      case "Планирование":
        return { label: status.label, color: "bg-gray-700 text-gray-300" };

      case "В работе":
        return { label: status.label, color: "bg-blue-600 text-white" };

      case "Завершен":
        return { label: status.label, color: "bg-green-600 text-white" };

      case "Приостановлен":
        return { label: status.label, color: "bg-red-600 text-white" };

      default:
        return { label: status.label, color: "bg-gray-700 text-gray-300" };

    }

  };

  const getProgressColor = (percent) => {

    if (percent < 30) return "bg-red-500";
    if (percent < 70) return "bg-yellow-500";

    return "bg-green-500";

  };

  /* ---------------- SEARCH ACTION ---------------- */
  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  /* ---------------- UI ---------------- */

  return (

    <div className="min-h-full text-white">

      {/* HEADER */}
      <div className="flex items-center gap-2 mb-4">
        <FolderKanban size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">
          Объекты
        </h1>
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
            placeholder="Поиск объектов..."
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
      <div className="space-y-3">

        {loading && (
          <div className="text-gray-400 text-sm">
            Loading...
          </div>
        )}

        {!loading && projects?.map(p => (

          <div
            key={p.id}
            onClick={() => navigate(`/projects/${p.id}`)}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500 cursor-pointer transition"
          >

            <div className="flex justify-between items-start mb-3">

              <div>

                <div className="flex items-center gap-2">

                  <p className="font-semibold">
                    {p.name}
                  </p>

                  <span className="text-xs text-gray-500">
                    {formatDate(p.start_date)} - {formatDate(p.end_date)}
                  </span>

                </div>

                <p className="text-xs text-gray-500">
                  {p.address}
                </p>

              </div>

              <div className="text-right">

                <p className="text-xs text-gray-400">
                  {p.code}
                </p>

                <span className={`mt-1 px-2 py-0.5 text-xs rounded-full ${getStatusStyle(p.status).color}`}>
                  {getStatusStyle(p.status).label}
                </span>

              </div>

            </div>

            {/* PROGRESS */}
            <div>

              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Прогресс</span>
                <span>{Math.round(p.progress_percent)}%</span>
              </div>

              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(p.progress_percent)}`}
                  style={{ width: `${p.progress_percent}%` }}
                />
              </div>

            </div>

          </div>

        ))}

      </div>

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