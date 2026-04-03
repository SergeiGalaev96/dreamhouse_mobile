import { useEffect, useState } from "react";
import { postRequest, putRequest } from "../api/request";
import { useParams } from "react-router-dom";
import Select from "react-select";
import { selectStyles } from "../utils/selectStyles";
import { Search, CheckCircle, Play, Eye, Plus } from "lucide-react";
import { formatDate } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import toast from "react-hot-toast";

import { useContext } from "react";
import { AuthContext } from "../auth/AuthContext";

export default function Tasks() {
  const { user } = useContext(AuthContext);

  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);

  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState({});

  const [tab, setTab] = useState("new");
  const [statuses, setStatuses] = useState([1]);


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

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    loadTasks();
    console.log("USER", user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statuses]);
  useEffect(() => {
    loadDicts();
  }, []);

  const loadTasks = async () => {
    setLoading(true);

    const res = await postRequest("/tasks/search", {
      project_id: projectId,
      statuses: statuses,
      page,
      size
    });

    if (res.success) {
      setTasks(res.data);
      setPagination(res.pagination);
    }

    setLoading(false);
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projects",
      "taskStatuses",
      "taskPriorities",
      "users"
    ]);
    setDictionaries(dicts);
  };

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };


  /* ---------------- STATUS ---------------- */

  const getStatusStyle = (id) => {
    switch (id) {
      case 1: return "bg-gray-600";
      case 2: return "bg-yellow-500";
      case 3: return "bg-blue-600";
      case 4: return "bg-green-600";
      case 5: return "bg-red-600";
      default: return "bg-gray-700";
    }
  };

  /* ---------------- ACTIONS ---------------- */
  const updateStatus = async (task, status) => {
    const res = await putRequest(`/tasks/update/${task.id}`, { status });
    if (res.success) {
      toast.success("Статус обновлен!")
      loadTasks();
    }
  };


  const getOptions = (dictName, fields = []) => {
    const items = dictionaries[dictName];
    if (!items) return [];

    return items.map(item => {
      const extra = {};

      fields.forEach(f => {
        extra[f] = item[f];
      });

      return {
        value: item.id,
        label: item.label,
        ...extra
      };
    });
  };

  /* ---------------- SEARCH ACTION ---------------- */
  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  const getPriorityBorder = (priority) => {
    switch (priority) {
      case 1: return "border-gray-700";     // низкий
      case 2: return "border-yellow-500";   // средний
      case 3: return "border-orange-500";      // высокий
      case 4: return "border-red-500";      // 🔥 критический
      default: return "border-gray-700";
    }
  };

  const createTask = async () => {
    if (isCreating) return;

    const title = newTask.title.trim();
    const description = newTask.description.trim();

    if (!title) {
      toast.error("Введите название задачи");
      return;
    }

    if (!description) {
      toast.error("Введите описание задачи");
      return;
    }

    if (!newTask.responsible_user_id) {
      toast.error("Выберите ответственного");
      return;
    }

    if (!newTask.deadline) {
      toast.error("Укажите дедлайн");
      return;
    }

    try {
      setIsCreating(true);

      const payload = {
        ...newTask,
        title,
        description,
        project_id: projectId
      };

      const res = await postRequest("/tasks/create", payload);

      if (res.success) {
        setShowCreateModal(false);
        setNewTask({
          title: "",
          description: "",
          responsible_user_id: null,
          deadline: "",
          priority: 2
        });
        loadTasks();
        toast.success("Задача создана!");
      } else {
        toast.error(res.message || "Ошибка создания");
      }

    } catch (e) {
      console.log("CREATE TASK ERROR", e);

      // 🔥 ВАЖНО
      toast.error(
        e.response?.data?.message ||
        e.message ||
        "Серверная ошибка"
      );
    } finally {
      setIsCreating(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="text-white">

      <h1 className="text-lg font-semibold mb-4 select-none">
        Задачи: {getDictName("projects", projectId)}
      </h1>

      <div className="space-y-3">

        {loading && <div>Loading...</div>}

        {/* TABS */}
        <div className="flex gap-2">

          <button
            onClick={() => { setTab("new"); setPage(1); setStatuses([1]); }}
            className={`flex-1 py-2 rounded ${tab === "new" ? "bg-blue-600" : "bg-gray-800"}`}
          >
            Новые
          </button>

          <button
            onClick={() => { setTab("active"); setPage(1); setStatuses([2, 3]); }}
            className={`flex-1 py-2 rounded ${tab === "active" ? "bg-blue-600" : "bg-gray-800"}`}
          >
            В работе
          </button>

          <button
            onClick={() => { setTab("done"); setPage(1); setStatuses([4, 5]) }}
            className={`flex-1 py-2 rounded ${tab === "done" ? "bg-blue-600" : "bg-gray-800"}`}
          >
            Завершенные
          </button>

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

        {!loading && tasks.map(task => (

          <div
            key={task.id}
            className={`bg-gray-900 border border-gray-800 border-l-4 ${getPriorityBorder(task.priority)} rounded-xl p-4`}
          >

            {/* HEADER */}
            <div className="flex justify-between mb-2">

              {/* LEFT */}
              <div>

                <p className="font-semibold">
                  {task.title}
                </p>

                <p className="text-xs text-gray-500">
                  {task.description}
                </p>

                {/* 🔥 ДОП ИНФА */}
                <div className="mt-1 text-[11px] text-gray-400 space-y-0.5">

                  <div>
                    👤 Автор: {getDictName("users", task.created_user_id)}
                  </div>

                  <div>
                    🧑‍🔧 Ответственный: {getDictName("users", task.responsible_user_id)}
                  </div>

                </div>

              </div>

              {/* RIGHT */}
              <div className="text-right">

                {/* статус */}
                <span className={`px-2 py-0.5 text-xs rounded ${getStatusStyle(task.status)}`}>
                  {getDictName("taskStatuses", task.status)}
                </span>

                {/* дедлайн */}
                <p className="text-xs text-gray-400 mt-1">
                  до {formatDate(task.deadline)}
                </p>

              </div>

            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 mt-3">

              {task.status === 1 && user.id === task.responsible_user_id && (
                <button
                  onClick={() => updateStatus(task, 2)}
                  className="flex items-center gap-1 px-3 py-1 bg-yellow-600 rounded text-xs"
                >
                  <Eye size={14} />
                  Ознакомлен
                </button>
              )}

              {task.status === 2 && user.id === task.responsible_user_id && (
                <button
                  onClick={() => updateStatus(task, 3)}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 rounded text-xs"
                >
                  <Play size={14} />
                  В работу
                </button>
              )}

              {task.status === 3 && user.id === task.responsible_user_id && (
                <button
                  onClick={() => updateStatus(task, 4)}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 rounded text-xs"
                >
                  <CheckCircle size={14} />
                  Выполнено
                </button>
              )}
              {(task.status === 1 || task.status === 2) && user.id === task.created_user_id && (
                <button
                  onClick={() => updateStatus(task, 5)}
                  className="flex items-center gap-1 px-3 py-1 bg-red-600 rounded text-xs"
                >
                  <CheckCircle size={14} />
                  Отменить
                </button>
              )}

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

      {/* CREATE BUTTON */}

      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-20 right-8 w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center shadow-xl transition hover:scale-105"
      >
        <Plus size={28} className="text-white" />
      </button>

      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => {
            if (!isCreating) {
              setShowCreateModal(false);
            }
          }}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-[400px] space-y-3"
          >

            <div className="text-sm font-semibold">
              Новая задача
            </div>

            {/* TITLE */}
            <input
              placeholder="Название"
              value={newTask.title}
              onChange={(e) =>
                setNewTask(prev => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            />

            {/* DESCRIPTION */}
            <input
              placeholder="Описание"
              value={newTask.description}
              onChange={(e) =>
                setNewTask(prev => ({ ...prev, description: e.target.value }))
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            />

            {/* RESPONSIBLE */}
            <Select
              styles={selectStyles}
              options={getOptions("users")}
              value={getOptions("users").find(u => u.value === newTask.responsible_user_id)}
              onChange={(v) =>
                setNewTask(prev => ({ ...prev, responsible_user_id: v.value }))
              }
              placeholder="Ответственный"
              isSearchable={false}
            />

            {/* DEADLINE */}
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) =>
                setNewTask(prev => ({ ...prev, deadline: e.target.value }))
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            />

            {/* PRIORITY */}
            <Select
              styles={selectStyles}
              options={getOptions("taskPriorities")}
              value={getOptions("taskPriorities").find(p => p.value === newTask.priority)}
              onChange={(v) =>
                setNewTask(prev => ({ ...prev, priority: v.value }))
              }
              placeholder="Приоритет"
              isSearchable={false}
            />

            {/* BUTTONS */}
            <div className="flex justify-end gap-2 pt-2">

              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="px-3 py-1 bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>

              <button
                onClick={createTask}
                disabled={isCreating}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Создание..." : "Создать"}
              </button>

            </div>

          </div>

        </div>
      )}


    </div>
  );
}
