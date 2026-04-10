import { useCallback, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Select from "react-select";
import { Search, CheckCircle, Play, Eye, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { postRequest, putRequest } from "../api/request";
import { selectStyles } from "../utils/selectStyles";
import { formatDate, formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { AuthContext } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import dayjs from "dayjs";
import PullToRefresh from "../components/PullToRefresh";

export default function Tasks() {
  const { user } = useContext(AuthContext);
  const { projectId } = useParams();
  const { isDark } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState({});
  const [hideTitle, setHideTitle] = useState(false);
  const [tab, setTab] = useState("new");
  const [statuses, setStatuses] = useState([1]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    responsible_user_id: null,
    deadline: "",
    priority: 2
  });

  const pageClass = themeText.page(isDark);
  const stickyClass = `${themeSurface.sticky(isDark)} space-y-3`;
  const searchInputClass = themeControl.input(isDark);
  const inactiveTabClass = isDark ? "bg-gray-800 text-white" : "border border-slate-300 bg-white text-black";
  const cardClass = themeSurface.card(isDark);
  const descriptionClass = themeText.muted(isDark);
  const metaClass = themeText.secondary(isDark);
  const modalClass = `${themeSurface.panel(isDark)} w-[400px] space-y-3 p-5 ${themeText.page(isDark)}`;
  const modalInputClass = themeControl.modalInput(isDark);
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const pagerTextClass = `text-sm ${themeText.secondary(isDark)}`;

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postRequest("/tasks/search", {
        user_id: user?.role_id === 1 ? selectedUserId : user?.id,
        project_id: projectId,
        search,
        statuses,
        page,
        size
      });

      if (res.success) {
        setTasks(res.data || []);
        setPagination(res.pagination || null);
      }
    } finally {
      setLoading(false);
    }
  }, [page, projectId, search, selectedUserId, size, statuses, user?.id, user?.role_id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const loadDicts = async () => {
      setDictionaries(await loadDictionaries(["projects", "taskStatuses", "taskPriorities", "users"]));
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
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const getStatusStyle = (id) => {
    switch (id) {
      case 1:
        return "bg-gray-600";
      case 2:
        return "bg-yellow-500";
      case 3:
        return "bg-blue-600";
      case 4:
        return "bg-green-600";
      case 5:
        return "bg-red-600";
      default:
        return "bg-gray-700";
    }
  };

  const getPriorityBorder = (priority) => {
    switch (priority) {
      case 1:
        return "border-gray-700";
      case 2:
        return "border-yellow-500";
      case 3:
        return "border-orange-500";
      case 4:
        return "border-red-500";
      default:
        return "border-gray-700";
    }
  };

  const getDeadlineColor = (deadline) => {
    if (!deadline) return "text-cyan-500";

    const today = dayjs().startOf("day");
    const target = dayjs(deadline).startOf("day");

    if (target.isBefore(today)) return "text-red-500";
    if (target.isSame(today)) return "text-yellow-500";
    return "text-cyan-500";
  };

  const getOptions = (dictName, fields = []) => {
    const items = dictionaries[dictName];
    if (!items) return [];

    return items.map((item) => {
      const extra = {};
      fields.forEach((field) => {
        extra[field] = item[field];
      });
      return { value: item.id, label: item.label, ...extra };
    });
  };

  const updateStatus = async (task, status) => {
    if (status === 5 && !window.confirm("Отменить задачу?")) return;

    const res = await putRequest(`/tasks/update/${task.id}`, { status });
    if (res.success) {
      toast.success("Статус обновлен");
      loadTasks();
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  const createTask = async () => {
    if (isCreating) return;

    const title = newTask.title.trim();
    const description = newTask.description.trim();

    if (!title) return toast.error("Введите название задачи");
    if (!description) return toast.error("Введите описание задачи");
    if (!newTask.responsible_user_id) return toast.error("Выберите ответственного");
    if (!newTask.deadline) return toast.error("Укажите дедлайн");

    try {
      setIsCreating(true);
      const res = await postRequest("/tasks/create", {
        ...newTask,
        title,
        description,
        project_id: projectId
      });

      if (!res.success) {
        toast.error(res.message || "Ошибка создания");
        return;
      }

      setShowCreateModal(false);
      setNewTask({
        title: "",
        description: "",
        responsible_user_id: null,
        deadline: "",
        priority: 2
      });
      loadTasks();
      toast.success("Задача создана");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Серверная ошибка");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={pageClass}>
      <h1 className={`select-none text-lg font-semibold transition-all duration-200 ${hideTitle ? "mb-0 max-h-0 overflow-hidden opacity-0" : "mb-4 max-h-12 opacity-100"}`}>
        Задачи: {getDictName("projects", projectId)}
      </h1>

      <div>
        {loading && <div className={`mb-3 ${metaClass}`}>Loading...</div>}

        <div className={stickyClass} style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
          <div className="flex gap-2">
            <button onClick={() => { setTab("new"); setPage(1); setStatuses([1]); }} className={`flex-1 rounded py-1.5 text-sm ${tab === "new" ? "bg-blue-600 text-white" : inactiveTabClass}`}>Новые</button>
            <button onClick={() => { setTab("active"); setPage(1); setStatuses([2, 3]); }} className={`flex-1 rounded py-1.5 text-sm ${tab === "active" ? "bg-blue-600 text-white" : inactiveTabClass}`}>В работе</button>
            <button onClick={() => { setTab("done"); setPage(1); setStatuses([4, 5]); }} className={`flex-1 rounded py-1.5 text-sm ${tab === "done" ? "bg-blue-600 text-white" : inactiveTabClass}`}>Завершенные</button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className={`absolute left-3 top-3 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
              <input
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Поиск задач..."
                className={searchInputClass}
              />
            </div>
            <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500">Go</button>
          </div>

          {user?.role_id === 1 && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  isClearable
                  styles={selectStyles}
                  options={getOptions("users")}
                  value={getOptions("users").find((item) => item.value === selectedUserId) || null}
                  onChange={(option) => {
                    setPage(1);
                    setSelectedUserId(option?.value || null);
                  }}
                  placeholder="Фильтр по пользователю..."
                />
              </div>
              <button
                onClick={() => {
                  setPage(1);
                  setSelectedUserId(null);
                }}
                className={themeControl.chipButton(isDark)}
              >
                Все
              </button>
            </div>
          )}
        </div>

        <PullToRefresh className="mt-3" contentClassName="space-y-3" onRefresh={loadTasks} disabled={loading || showCreateModal}>
          {!loading && tasks.map((task) => (
            <div key={task.id} className={`${cardClass} border-l-4 p-3 ${getPriorityBorder(task.priority)}`}>
              <div className="mb-1.5 flex justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-5">{task.title}</p>
                  <p className={`mt-0.5 text-xs ${descriptionClass}`}>{task.description}</p>
                  <div className={`mt-1 space-y-0.5 text-[10px] ${metaClass}`}>
                    <div>Автор: {getDictName("users", task.created_user_id)}</div>
                    <div>Ответственный: {getDictName("users", task.responsible_user_id)}</div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className={`rounded px-2 py-0.5 text-[11px] text-white ${getStatusStyle(task.status)}`}>{getDictName("taskStatuses", task.status)}</span>
                  <p className={`mt-1 text-[10px] ${metaClass}`}>{formatDateTime(task.created_at)}</p>
                  <p className={`mt-1 text-[10px] ${getDeadlineColor(task.deadline)}`}>до {formatDate(task.deadline)}</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {task.status === 1 && user.id === task.responsible_user_id && (
                  <button onClick={() => updateStatus(task, 2)} className="flex items-center gap-1 rounded bg-yellow-600 px-2.5 py-1 text-[11px] text-white"><Eye size={14} />Ознакомлен</button>
                )}
                {task.status === 2 && user.id === task.responsible_user_id && (
                  <button onClick={() => updateStatus(task, 3)} className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] text-white"><Play size={14} />В работу</button>
                )}
                {task.status === 3 && user.id === task.responsible_user_id && (
                  <button onClick={() => updateStatus(task, 4)} className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-[11px] text-white"><CheckCircle size={14} />Выполнено</button>
                )}
                {(task.status === 1 || task.status === 2) && user.id === task.created_user_id && (
                  <button onClick={() => updateStatus(task, 5)} className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[11px] text-white"><CheckCircle size={14} />Отменить</button>
                )}
              </div>
            </div>
          ))}
        </PullToRefresh>

        <div className="mt-6 flex justify-center gap-3">
          <button disabled={!pagination?.hasPrev} onClick={() => setPage(page - 1)} className={pagerButtonClass}>Назад</button>
          <span className={pagerTextClass}>{pagination?.page || page} / {pagination?.pages || 1}</span>
          <button disabled={!pagination?.hasNext} onClick={() => setPage(page + 1)} className={pagerButtonClass}>Далее</button>
        </div>
      </div>

      <button onClick={() => setShowCreateModal(true)} className="fixed bottom-20 right-8 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-xl transition hover:scale-105 hover:bg-green-500">
        <Plus size={28} className="text-white" />
      </button>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => !isCreating && setShowCreateModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className={modalClass}>
            <div className="text-sm font-semibold">Новая задача</div>

            <input
              placeholder="Название"
              value={newTask.title}
              onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
              className={modalInputClass}
            />

            <input
              placeholder="Описание"
              value={newTask.description}
              onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
              className={modalInputClass}
            />

            <Select
              styles={selectStyles}
              options={getOptions("users")}
              value={getOptions("users").find((item) => item.value === newTask.responsible_user_id) || null}
              onChange={(value) => setNewTask((prev) => ({ ...prev, responsible_user_id: value?.value || null }))}
              placeholder="Ответственный"
              isSearchable={false}
            />

            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask((prev) => ({ ...prev, deadline: e.target.value }))}
              className={modalInputClass}
            />

            <Select
              styles={selectStyles}
              options={getOptions("taskPriorities")}
              value={getOptions("taskPriorities").find((item) => item.value === newTask.priority) || null}
              onChange={(value) => setNewTask((prev) => ({ ...prev, priority: value?.value || 2 }))}
              placeholder="Приоритет"
              isSearchable={false}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreateModal(false)} disabled={isCreating} className={isDark ? "rounded bg-gray-700 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" : "rounded border border-slate-300 bg-white px-3 py-1 text-sm text-black disabled:cursor-not-allowed disabled:opacity-50"}>
                Отмена
              </button>
              <button onClick={createTask} disabled={isCreating} className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50">
                {isCreating ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
