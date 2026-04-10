import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderKanban } from "lucide-react";
import { postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDate } from "../utils/date";
import PullToRefresh from "../components/PullToRefresh";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeMisc, themeSurface, themeText } from "../utils/themeStyles";

export default function Projects() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState({});
  const [hideTitle, setHideTitle] = useState(false);

  const pages = Math.ceil(total / size);

  const loadProjects = async () => {
    try {
      setLoading(true);

      const res = await postRequest("/projects/search", {
        search,
        page,
        size
      });

      if (res.success) {
        setProjects(res.data || []);
        setTotal(res.pagination?.total || 0);
        setPagination(res.pagination || null);
      }
    } catch (error) {
      console.log("Projects error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [page, search]);

  useEffect(() => {
    const loadDicts = async () => {
      const dicts = await loadDictionaries(["projectStatuses"]);
      setDictionaries(dicts);
    };

    loadDicts();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setHideTitle(scrollTop > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const getStatusStyle = (id) => {
    const status = dictionaries.projectStatuses?.find((item) => item.id === id);

    if (!status) {
      return { label: "", color: "bg-gray-700 text-gray-300" };
    }

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

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  const pageClass = `min-h-full ${themeText.page(isDark)}`;
  const stickyClass = themeSurface.sticky(isDark);
  const inputClass = themeControl.input(isDark);
  const loadingClass = isDark ? "text-sm text-gray-400" : "text-sm text-black";
  const cardClass = `cursor-pointer p-4 ${themeSurface.cardHover(isDark)}`;
  const mutedTextClass = themeText.muted(isDark);
  const codeTextClass = `text-xs ${themeText.secondary(isDark)}`;
  const progressTrackClass = themeMisc.progressTrack(isDark);
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const pagerTextClass = `text-sm ${themeText.secondary(isDark)}`;

  return (
    <div className={pageClass}>
      <div className={`select-none transition-all duration-200 ${hideTitle ? "mb-0 max-h-0 overflow-hidden opacity-0" : "mb-4 max-h-12 opacity-100"}`}>
        <div className="flex items-center gap-2">
          <FolderKanban size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">Объекты</h1>
        </div>
      </div>

      <div
        className={stickyClass}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${isDark ? "text-gray-400" : "text-gray-500"}`} />

            <input
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Поиск объектов..."
              className={inputClass}
            />
          </div>

          <button
            onClick={handleSearch}
            className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
          >
            Найти
          </button>
        </div>
      </div>

      <PullToRefresh
        className="mt-3"
        contentClassName="space-y-1.5"
        onRefresh={loadProjects}
        disabled={loading}
      >
        {loading && (
          <div className={loadingClass}>
            Loading...
          </div>
        )}

        {!loading && projects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className={cardClass}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">
                    {project.name}
                  </p>

                  <span className={`text-xs ${mutedTextClass}`}>
                    {formatDate(project.start_date)} - {formatDate(project.end_date)}
                  </span>
                </div>

                <p className={`text-xs ${mutedTextClass}`}>
                  {project.address}
                </p>
              </div>

              <div className="text-right">
                <p className={codeTextClass}>
                  {project.code}
                </p>

                <span className={`mt-1 rounded-full px-2 py-0.5 text-xs ${getStatusStyle(project.status).color}`}>
                  {getStatusStyle(project.status).label}
                </span>
              </div>
            </div>

            <div>
              <div className={`mb-1 flex justify-between text-xs ${mutedTextClass}`}>
                <span>Прогресс</span>
                <span>{Math.round(project.progress_percent)}%</span>
              </div>

              <div className={progressTrackClass}>
                <div
                  className={`h-full ${getProgressColor(project.progress_percent)}`}
                  style={{ width: `${project.progress_percent}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </PullToRefresh>

      <div className="mt-6 flex justify-center gap-3">
        <button
          disabled={!pagination?.hasPrev}
          onClick={() => setPage(page - 1)}
          className={pagerButtonClass}
        >
          Prev
        </button>

        <span className={pagerTextClass}>
          {pagination?.page || page} / {pagination?.pages || pages || 1}
        </span>

        <button
          disabled={!pagination?.hasNext}
          onClick={() => setPage(page + 1)}
          className={pagerButtonClass}
        >
          Next
        </button>
      </div>
    </div>
  );
}
