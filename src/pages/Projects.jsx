import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";
import { postRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDate } from "../utils/date";
import { themeBorder, themeControl, themeMisc, themeSurface, themeText } from "../utils/themeStyles";

const PROJECT_MANAGER_ROLE_IDS = [1, 10];

const EMPTY_PROJECT_FORM = {
  id: null,
  name: "",
  address: "",
  customer_name: "",
  start_date: "",
  end_date: "",
  planned_budget: "",
  manager_id: "",
  foreman_id: "",
  master_id: "",
  warehouse_manager_id: "",
  description: ""
};

export default function Projects() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);

  const [projects, setProjects] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    hasNext: false,
    hasPrev: false
  });
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);

  const canManageProjects = PROJECT_MANAGER_ROLE_IDS.includes(Number(user?.role_id));

  const pageClass = `space-y-4 ${themeText.page(isDark)}`;
  const cardClass = themeSurface.card(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const dividerClass = themeBorder.divider(isDark);
  const titleClass = themeText.title(isDark);
  const textClass = themeText.primary(isDark);
  const subTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const searchInputClass = themeControl.input(isDark);
  const trackClass = themeMisc.progressTrack(isDark).replace("h-2 w-full overflow-hidden rounded-full ", "");

  const users = dictionaries.users || [];

  const loadProjects = async (nextPage = page, nextSearch = appliedSearch) => {
    try {
      setLoading(true);

      const res = await postRequest("/projects/search", {
        search: nextSearch,
        page: nextPage,
        size: 10
      });

      if (!res?.success) {
        toast.error(res?.message || "Ошибка загрузки объектов");
        return;
      }

      setProjects(res.data || []);
      setPagination(
        res.pagination || {
          total: 0,
          pages: 1,
          hasNext: false,
          hasPrev: false
        }
      );
    } catch (error) {
      console.error("Projects load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки объектов");
    } finally {
      setLoading(false);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries(["projectStatuses", "users"]);
    setDictionaries(dicts);
  };

  useEffect(() => {
    loadDicts();
  }, []);

  useEffect(() => {
    loadProjects(page, appliedSearch);
  }, [page, appliedSearch]);

  const handleSearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleRefresh = async () => {
    await Promise.all([loadDicts(), loadProjects(page, appliedSearch)]);
  };

  const getStatusMeta = (statusId) => {
    const status = (dictionaries.projectStatuses || []).find((item) => Number(item.id) === Number(statusId));
    const label = status?.label || "-";

    switch (label) {
      case "Планирование":
        return { label, className: isDark ? "bg-gray-700 text-gray-200" : "bg-slate-200 text-slate-800" };
      case "В работе":
        return { label, className: "bg-blue-600 text-white" };
      case "Завершен":
        return { label, className: "bg-green-600 text-white" };
      case "Приостановлен":
        return { label, className: "bg-red-600 text-white" };
      default:
        return { label, className: isDark ? "bg-gray-700 text-gray-200" : "bg-slate-200 text-slate-800" };
    }
  };

  const getUserLabel = (id) => users.find((item) => Number(item.id) === Number(id))?.label || "-";

  const formatMoney = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0";
    return num.toLocaleString("ru-RU");
  };

  const formatPercent = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0";
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, "");
  };

  const getBudgetPercentRaw = (project) => {
    const planned = Number(project?.planned_budget || 0);
    const actual = Number(project?.actual_budget || 0);
    if (!planned) return 0;
    return (actual / planned) * 100;
  };

  const getBudgetPercentUI = (project) => Math.min(getBudgetPercentRaw(project), 100);

  const getBudgetColor = (project) => {
    const planned = Number(project?.planned_budget || 0);
    const actual = Number(project?.actual_budget || 0);

    if (!planned) return "bg-gray-500";
    if (actual > planned) return "bg-red-500";
    if (actual > planned * 0.7) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getProgressColor = (percent) => {
    const value = Number(percent || 0);
    if (value < 30) return "bg-red-500";
    if (value < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const openCreateProject = () => {
    setProjectForm(EMPTY_PROJECT_FORM);
    setProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setProjectForm(EMPTY_PROJECT_FORM);
    setProjectModalOpen(false);
  };

  const handleProjectFormChange = (field, value) => {
    setProjectForm((prev) => ({ ...prev, [field]: value }));
  };

  const normalizeNullableNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const saveProject = async (e) => {
    e.preventDefault();

    if (!projectForm.name.trim()) {
      toast.error("Введите название объекта");
      return;
    }

    try {
      setSavingProject(true);

      const payload = {
        name: projectForm.name.trim(),
        address: projectForm.address.trim() || null,
        customer_name: projectForm.customer_name.trim() || null,
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
        planned_budget: normalizeNullableNumber(projectForm.planned_budget) || 0,
        manager_id: normalizeNullableNumber(projectForm.manager_id),
        foreman_id: normalizeNullableNumber(projectForm.foreman_id),
        master_id: normalizeNullableNumber(projectForm.master_id),
        warehouse_manager_id: normalizeNullableNumber(projectForm.warehouse_manager_id),
        description: projectForm.description.trim() || null
      };

      const res = await postRequest("/projects/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить объект");
        return;
      }

      toast.success("Объект создан");
      closeProjectModal();
      await loadProjects(page, appliedSearch);
    } catch (error) {
      console.error("Project save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения объекта");
    } finally {
      setSavingProject(false);
    }
  };

  const modalTitle = "Новый объект";

  return (
    <div className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban size={18} className="text-blue-500" />
          <h1 className={`text-lg font-semibold ${titleClass}`}>Объекты</h1>
        </div>

        {canManageProjects && (
          <button
            onClick={openCreateProject}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
          >
            <Plus size={16} />
            Объект
          </button>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${subTextClass}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Поиск объектов..."
            className={searchInputClass}
          />
        </div>

        <button
          onClick={handleSearch}
          className="h-[42px] shrink-0 rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
        >
          Go
        </button>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-3">
          {loading && projects.length === 0 && (
            <div className={`${cardClass} p-4 text-sm ${subTextClass}`}>Загрузка объектов...</div>
          )}

          {!loading && projects.length === 0 && (
            <div className={`${cardClass} p-4 text-sm ${subTextClass}`}>Объекты не найдены.</div>
          )}

          {projects.map((project) => {
            const statusMeta = getStatusMeta(project.status);

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className={`${themeSurface.cardHover(isDark)} cursor-pointer p-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`truncate text-base font-semibold ${titleClass}`}>{project.name}</div>

                    </div>

                    <div className={`mt-1 flex items-center justify-between gap-2 text-sm ${subTextClass}`}>
                      <span className="truncate">
                        {formatDate(project.start_date)} - {formatDate(project.end_date)}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className={`rounded px-2 py-1 text-xs ${statusMeta.className}`}>{statusMeta.label}</div>
                      </div>
                    </div>
                    <div className={`mt-2 truncate text-sm ${textClass}`}>{project.address || "-"}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className={`mb-1 flex justify-between text-xs ${subTextClass}`}>
                      <span>Бюджет</span>
                      <span className={titleClass}>{Math.round(getBudgetPercentRaw(project))}%</span>
                    </div>
                    <div className={`h-2 w-full rounded ${trackClass}`}>
                      <div className={`${getBudgetColor(project)} h-full`} style={{ width: `${getBudgetPercentUI(project)}%` }} />
                    </div>
                    <div className={`mt-1 flex justify-between text-xs ${mutedTextClass}`}>
                      <span>{formatMoney(project.planned_budget)}</span>
                      <span>{formatMoney(project.actual_budget)}</span>
                    </div>
                  </div>

                  <div>
                    <div className={`mb-1 flex justify-between text-xs ${subTextClass}`}>
                      <span>Прогресс</span>
                      <span className={titleClass}>{formatPercent(project.progress_percent)}%</span>
                    </div>
                    <div className={`h-2 w-full rounded ${trackClass}`}>
                      <div
                        className={`${getProgressColor(project.progress_percent)} h-full`}
                        style={{ width: `${Math.min(Number(project.progress_percent || 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {false && <div className={`mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-sm ${dividerClass}`}>
                  <div className="min-w-0">
                    <div className={mutedTextClass}>Заказчик</div>
                    <div className={`truncate ${textClass}`}>{project.customer_name || "-"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className={mutedTextClass}>Менеджер</div>
                    <div className={`truncate ${textClass}`}>{getUserLabel(project.manager_id)}</div>
                  </div>
                </div>}
              </div>
            );
          })}
        </div>
      </PullToRefresh>

      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={!pagination.hasPrev}
          className={subtleButtonClass}
        >
          Назад
        </button>

        <div className={`text-sm ${textClass}`}>
          {page} / {pagination.pages || 1}
        </div>

        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={!pagination.hasNext}
          className={subtleButtonClass}
        >
          Далее
        </button>
      </div>

      {projectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} flex max-h-[88vh] w-full max-w-xl flex-col p-3`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>{modalTitle}</div>
                <div className={`text-xs ${subTextClass}`}>Управление объектом</div>
              </div>

              <button
                onClick={closeProjectModal}
                className={`${subTextClass} ${isDark ? "hover:text-white" : "hover:text-black"}`}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveProject} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Название</div>
                    <input
                      value={projectForm.name}
                      onChange={(e) => handleProjectFormChange("name", e.target.value)}
                      className={modalInputClass}
                      placeholder="Название объекта"
                    />
                  </div>

                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Заказчик</div>
                    <input
                      value={projectForm.customer_name}
                      onChange={(e) => handleProjectFormChange("customer_name", e.target.value)}
                      className={modalInputClass}
                      placeholder="Заказчик"
                    />
                  </div>

                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Бюджет</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={projectForm.planned_budget}
                      onChange={(e) => handleProjectFormChange("planned_budget", e.target.value)}
                      className={modalInputClass}
                      placeholder="Плановый бюджет"
                    />
                  </div>
                </div>

                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Адрес</div>
                  <input
                    value={projectForm.address}
                    onChange={(e) => handleProjectFormChange("address", e.target.value)}
                    className={modalInputClass}
                    placeholder="Адрес"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Дата начала</div>
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={(e) => handleProjectFormChange("start_date", e.target.value)}
                      className={modalInputClass}
                    />
                  </div>

                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Дата окончания</div>
                    <input
                      type="date"
                      value={projectForm.end_date}
                      onChange={(e) => handleProjectFormChange("end_date", e.target.value)}
                      className={modalInputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Менеджер</div>
                    <select
                      value={projectForm.manager_id}
                      onChange={(e) => handleProjectFormChange("manager_id", e.target.value)}
                      className={modalInputClass}
                    >
                      <option value="">Не выбран</option>
                      {users.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Прораб</div>
                    <select
                      value={projectForm.foreman_id}
                      onChange={(e) => handleProjectFormChange("foreman_id", e.target.value)}
                      className={modalInputClass}
                    >
                      <option value="">Не выбран</option>
                      {users.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Мастер</div>
                    <select
                      value={projectForm.master_id}
                      onChange={(e) => handleProjectFormChange("master_id", e.target.value)}
                      className={modalInputClass}
                    >
                      <option value="">Не выбран</option>
                      {users.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Кладовщик</div>
                    <select
                      value={projectForm.warehouse_manager_id}
                      onChange={(e) => handleProjectFormChange("warehouse_manager_id", e.target.value)}
                      className={modalInputClass}
                    >
                      <option value="">Не выбран</option>
                      {users.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Комментарий</div>
                  <textarea
                    value={projectForm.description}
                    onChange={(e) => handleProjectFormChange("description", e.target.value)}
                    className={`${modalInputClass} min-h-[72px] resize-none`}
                    placeholder="Комментарий"
                  />
                </div>
              </div>

              <div className="flex gap-2 border-t pt-2">
                <button type="button" onClick={closeProjectModal} className={subtleButtonClass}>
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingProject ? "Сохранение..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
