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



  /* ---------------- LOAD PROJECT ---------------- */

  const loadProject = async () => {

    const res = await getRequest(`/projects/getById/${projectId}`);

    if (res.success) {
      setProject(res.data);
    }

  };



  /* ---------------- LOAD BLOCKS ---------------- */

  const loadBlocks = async () => {

    const res = await postRequest("/projectBlocks/search", {
      project_id: Number(projectId)
    });

    if (res.success) {
      setBlocks(res.data);
    }

  };



  /* ---------------- LOAD DICTIONARIES ---------------- */

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



  /* ---------------- HELPERS ---------------- */

  const getUserName = (id) => {

    if (!id) return "-";

    const user = dictionaries.users?.find(u => u.id === id);

    if (!user) return id;

    return `${user.first_name} ${user.last_name}`;

  };



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



  const projectStatus = getStatusStyle(project.status);

  const formatMoney = (value) => {

    if (!value) return "0";

    return Number(value).toLocaleString("ru-RU");

  };



  const getBudgetPercent = (item) => {

    // console.log("IT", item)

    if (item.planned_budget == null || item.actual_budget == null) return 0;

    return Math.min(
      Math.round((item.actual_budget / item.planned_budget) * 100),
      100
    );

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


      {/* ================= PROJECT CARD ================= */}

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">

        {/* HEADER */}
        <div className="flex justify-between items-center">

          <h1 className="text-base font-semibold truncate">
            {project.name}
          </h1>

          <div className={`px-2 py-[3px] text-xs rounded ${projectStatus.color}`}>
            {projectStatus.label}
          </div>

        </div>

        {/* META */}
        <div className="text-sm text-gray-400 flex justify-between flex-wrap gap-x-2">

          <span>
            {formatDate(project.start_date)} — {formatDate(project.end_date)}
          </span>

          <span className="truncate max-w-[60%] text-gray-300">
            {project.address || "-"}
          </span>

        </div>

        {/* BUDGET + PROGRESS */}
        <div className="grid grid-cols-2 gap-4">

          {/* БЮДЖЕТ */}
          <div>

            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Бюджет</span>
              <span className="text-white">{getBudgetPercent(project)}%</span>
            </div>

            <div className="w-full bg-gray-800 rounded h-2">
              <div
                className={`${getBudgetColor(project)} h-full`}
                style={{ width: `${getBudgetPercent(project)}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatMoney(project.planned_budget)}</span>
              <span>{formatMoney(project.actual_budget)}</span>
            </div>

          </div>

          {/* ПРОГРЕСС */}
          <div>

            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Прогресс</span>
              <span className="text-white">
                {project.progress_percent || 0}%
              </span>
            </div>

            <div className="w-full bg-gray-800 rounded h-2">
              <div
                className={`${getProgressColor(project.progress_percent)} h-full`}
                style={{ width: `${project.progress_percent || 0}%` }}
              />
            </div>

          </div>

        </div>

        {/* 🔥 TEAM TOGGLE */}
        <div className="border-t border-gray-800 pt-2">

          <div className="flex justify-end">

            <div
              onClick={() => setShowTeam(!showTeam)}
              className="text-xs text-blue-400 cursor-pointer select-none flex items-center gap-1"
            >
              Команда
              <span
                className={`transition-transform duration-300 ${showTeam ? "rotate-180" : ""
                  }`}
              >
                ▼
              </span>
            </div>

          </div>

          <div className={`overflow-hidden transition-all duration-300 ${showTeam ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
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

        {/* ACTIONS */}
        <div className="grid grid-cols-3 gap-2 text-sm pt-1">

          <div
            // onClick={() => navigate(`/projects/${projectId}/reports`)}
            className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
          >
            Отчёты
          </div>

          <div
            // onClick={() => navigate(`/projects/${projectId}/finance`)}
            className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
          >
            Финансы
          </div>

          <div
            onClick={() => navigate(`/projects/${projectId}/warehouses`)}
            className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
          >
            Склад
          </div>

        </div>

      </div>

      {/* ================= BLOCKS ================= */}

      <div className="space-y-3">

        {blocks.map(block => {

          const expanded = expandedBlockId === block.id;

          return (

            <div
              key={block.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
            >

              {/* HEADER */}
              <div
                onClick={() =>
                  setExpandedBlockId(expanded ? null : block.id)
                }
                className="flex justify-between items-center cursor-pointer"
              >

                <div className="flex flex-col leading-tight">



                  <span className="font-semibold text-sm">
                    {block.name}
                  </span>

                </div>
                <span className="text-blue-400 text-xs">
                  Данные {expanded ? "▲" : "▼"}
                </span>

              </div>
              {/* 🔥 БЮДЖЕТ + ПРОГРЕСС (ВСЕГДА ВИДНЫ) */}
              <div className="grid grid-cols-2 gap-4">

                {/* БЮДЖЕТ */}
                <div>

                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Бюджет</span>
                    <span className="text-white">{getBudgetPercent(block)}%</span>
                  </div>

                  <div className="w-full bg-gray-800 rounded h-2">
                    <div
                      className={`${getBudgetColor(block)} h-full`}
                      style={{ width: `${getBudgetPercent(block)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatMoney(block.planned_budget)}</span>
                    <span>{formatMoney(block.actual_budget)}</span>
                  </div>

                </div>

                {/* ПРОГРЕСС */}
                <div>

                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Прогресс</span>
                    <span className="text-white">
                      {block.progress_percent || 0}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-800 rounded h-2">
                    <div
                      className={`${getProgressColor(block.progress_percent)} h-full`}
                      style={{ width: `${block.progress_percent || 0}%` }}
                    />
                  </div>

                </div>

              </div>

              {/* 🔥 РАСКРЫВАЕМАЯ ЧАСТЬ */}


              <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
                <div className="space-y-3 border-t border-gray-800 pt-3">

                  {/* INFO */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Общая площадь</div>
                      <div>{block.total_area}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Площадь продажи</div>
                      <div>{block.sale_area}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Объём работ</div>
                      <div>{block.planned_volume}</div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs">Сделано</div>
                      <div className="text-green-400">{block.done_volume}</div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs">Остаток</div>
                      <div className="text-yellow-400">{block.remaining_volume}</div>
                    </div>
                  </div>

                </div>
              </div>



              {/* ACTIONS */}
              <div className="grid grid-cols-4 gap-2 text-xs">

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/estimates`)
                  }
                  className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
                >
                  Сметы
                </div>

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/material-requests`)
                  }
                  className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
                >
                  Заявки
                </div>

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/purchase-orders`)
                  }
                  className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
                >
                  Закуп
                </div>

                <div
                  onClick={() =>
                    navigate(`/projects/${projectId}/blocks/${block.id}/work-performed`)
                  }
                  className="bg-gray-800 rounded p-2 text-center cursor-pointer hover:bg-gray-700 select-none"
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