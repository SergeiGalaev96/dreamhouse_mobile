import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest, postRequest } from "../api/request";
import { formatDate } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";

export default function ProjectCard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [showTeam, setShowTeam] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState(null);

  const loadProject = async () => {
    const res = await getRequest(`/projects/getById/${projectId}`);

    if (res.success) {
      setProject(res.data);
    }
  };

  const loadBlocks = async () => {
    const res = await postRequest("/projectBlocks/search", {
      project_id: Number(projectId)
    });

    if (res.success) {
      setBlocks(res.data);
    }
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projectStatuses",
      "users"
    ]);

    setDictionaries(dicts);
  };

  useEffect(() => {
    loadProject();
    loadBlocks();
    loadDicts();
  }, [projectId]);

  if (!project) return null;

  const getUserName = (id) => {
    if (!id) return "-";

    const user = dictionaries.users?.find((u) => u.id === id);

    if (!user) return id;

    return `${user.first_name} ${user.last_name}`;
  };

  const getStatusStyle = (id) => {
    const status = dictionaries.projectStatuses?.find(
      (s) => s.id === id
    );

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

  const projectStatus = getStatusStyle(project.status);

  const formatMoney = (value) => {
    if (!value) return "0";
    return Number(value).toLocaleString("ru-RU");
  };

  const getBudgetPercent = (item) => {
    if (!item.planned_budget || !item.actual_budget) return 0;

    return Math.round((item.actual_budget / item.planned_budget) * 100);
  };

  const getBudgetPercentRaw = (item) => {
    if (!item.planned_budget || !item.actual_budget) return 0;
    return (item.actual_budget / item.planned_budget) * 100;
  };

  const getBudgetPercentUI = (item) => {
    return Math.min(getBudgetPercentRaw(item), 100);
  };

  const getBudgetColor = (item) => {
    const planned = Number(item.planned_budget);
    const actual = Number(item.actual_budget);

    if (!planned) return "bg-gray-500";
    if (actual > planned) return "bg-red-500";
    if (actual > planned * 0.7) return "bg-yellow-500";

    return "bg-green-500";
  };

  return (
    <div className="space-y-4 text-white">
      <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <h1 className="select-none truncate text-base font-semibold">
            {project.name}
          </h1>

          <div className={`select-none rounded px-2 py-[3px] text-xs ${projectStatus.color}`}>
            {projectStatus.label}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-x-2 text-sm text-gray-400 select-none">
          <span>
            {formatDate(project.start_date)} - {formatDate(project.end_date)}
          </span>

          <span className="max-w-[60%] truncate text-gray-300">
            {project.address || "-"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-400 select-none">
              <span>Бюджет</span>
              <span className="text-white">
                {Math.round(getBudgetPercentRaw(project))}%
              </span>

            </div>

            <div className="h-2 w-full rounded bg-gray-800 select-none">
              <div
                className={`${getBudgetColor(project)} h-full`}
                style={{ width: `${getBudgetPercentUI(project)}%` }}
              />
            </div>

            <div className="mt-1 flex justify-between text-xs text-gray-500 select-none">
              <span>{formatMoney(project.planned_budget)}</span>
              <span>{formatMoney(project.actual_budget)}</span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-400 select-none">
              <span>Прогресс</span>
              <span className="text-white">
                {project.progress_percent || 0}%
              </span>
            </div>

            <div className="h-2 w-full rounded bg-gray-800 select-none">
              <div
                className={`${getProgressColor(project.progress_percent)} h-full`}
                style={{ width: `${project.progress_percent || 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-2">
          <div className="flex justify-end">
            <div
              onClick={() => setShowTeam(!showTeam)}
              className="flex cursor-pointer items-center gap-1 text-xs text-blue-400 select-none"
            >
              Команда
              <span
                className={`transition-transform duration-300 ${showTeam ? "rotate-180" : ""}`}
              >
                ▼
              </span>
            </div>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${showTeam ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="space-y-1 text-sm text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-500">Менеджер</span>
                <span>{getUserName(project.manager_id)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Прораб</span>
                <span>{getUserName(project.foreman_id)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Мастер</span>
                <span>{getUserName(project.master_id)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Склад</span>
                <span>{getUserName(project.warehouse_manager_id)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 pt-1 text-xs select-none">
          <div
            onClick={() => navigate(`/projects/${projectId}/documents`)}
            className="cursor-pointer rounded bg-gray-800 px-2 py-2 text-center hover:bg-gray-700 select-none"
          >
            Юр отдел
          </div>
          <div
            className="cursor-pointer rounded bg-gray-800 px-2 py-2 text-center hover:bg-gray-700 select-none"
          >
            Отчёты
          </div>

          <div
            onClick={() => navigate(`/projects/${projectId}/tasks`)}
            className="cursor-pointer rounded bg-gray-800 px-2 py-2 text-center hover:bg-gray-700 select-none"
          >
            Задачи
          </div>

          <div
            onClick={() => navigate(`/projects/${projectId}/warehouses`)}
            className="cursor-pointer rounded bg-gray-800 px-2 py-2 text-center hover:bg-gray-700 select-none"
          >
            Склад
          </div>


        </div>
      </div>

      <div className="space-y-3">
        {blocks.map((block) => {
          const expanded = expandedBlockId === block.id;

          return (
            <div
              key={block.id}
              className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-4"
            >
              <div
                onClick={() =>
                  setExpandedBlockId(expanded ? null : block.id)
                }
                className="flex cursor-pointer items-center justify-between"
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">
                    {block.name}
                  </span>
                </div>
                <span className="text-xs text-blue-400">
                  Данные {expanded ? "▲" : "▼"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-gray-400">
                    <span>Бюджет</span>
                    <span className="text-white">
                      {Math.round(getBudgetPercentRaw(block))}%
                    </span>
                  </div>

                  <div className="h-2 w-full rounded bg-gray-800">
                    <div
                      className={`${getBudgetColor(block)} h-full`}
                      style={{ width: `${getBudgetPercentUI(block)}%` }}
                    />
                  </div>

                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>{formatMoney(block.planned_budget)}</span>
                    <span>{formatMoney(block.actual_budget)}</span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs text-gray-400">
                    <span>Прогресс</span>
                    <span className="text-white">
                      {block.progress_percent || 0}%
                    </span>
                  </div>

                  <div className="h-2 w-full rounded bg-gray-800">
                    <div
                      className={`${getProgressColor(block.progress_percent)} h-full`}
                      style={{ width: `${block.progress_percent || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="space-y-3 border-t border-gray-800 pt-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Общая площадь</div>
                      <div>{block.total_area}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Площадь продажи</div>
                      <div>{block.sale_area}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Объём работ</div>
                      <div>{block.planned_volume}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Сделано</div>
                      <div className="text-green-400">{block.done_volume}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Остаток</div>
                      <div className="text-yellow-400">{block.remaining_volume}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/estimates`)
                  }
                  className="cursor-pointer rounded bg-gray-800 p-2 text-center hover:bg-gray-700 select-none"
                >
                  Сметы
                </div>

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/material-requests`)
                  }
                  className="cursor-pointer rounded bg-gray-800 p-2 text-center hover:bg-gray-700 select-none"
                >
                  Заявки
                </div>

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/purchase-orders`)
                  }
                  className="cursor-pointer rounded bg-gray-800 p-2 text-center hover:bg-gray-700 select-none"
                >
                  Закуп
                </div>

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/work-performed`)
                  }
                  className="cursor-pointer rounded bg-gray-800 p-2 text-center hover:bg-gray-700 select-none"
                >
                  АВР
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
