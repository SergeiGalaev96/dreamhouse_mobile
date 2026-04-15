import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest, postRequest } from "../api/request";
import { formatDate } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import { themeBorder, themeControl, themeMisc, themeSurface, themeText } from "../utils/themeStyles";
import toast from "react-hot-toast";

export default function ProjectCard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [project, setProject] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [showTeam, setShowTeam] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState(null);

  const loadProject = async () => {
    const res = await getRequest(`/projects/getById/${projectId}`);
    if (res.success) setProject(res.data);
  };

  const loadBlocks = async () => {
    const res = await postRequest("/projectBlocks/search", { project_id: Number(projectId) });
    if (res.success) setBlocks(res.data);
  };

  const loadDicts = async () => {
    setDictionaries(await loadDictionaries(["projectStatuses", "users"]));
  };

  const openWarehouseStocks = async () => {
    const res = await postRequest("/warehouses/search", {
      project_id: Number(projectId),
      page: 1,
      size: 1
    });
    const warehouse = res?.success ? res.data?.[0] : null;
    if (warehouse?.id) {
      navigate(`/projects/${projectId}/warehouses/${warehouse.id}/warehouse-stocks`);
      return;
    }
    toast.error("Склад для проекта не найден");
  };

  useEffect(() => {
    loadProject();
    loadBlocks();
    loadDicts();
  }, [projectId]);

  if (!project) return null;

  const cardClass = themeSurface.card(isDark);
  const titleClass = themeText.title(isDark);
  const textClass = themeText.primary(isDark);
  const subTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const dividerClass = themeBorder.divider(isDark);
  const trackClass = themeMisc.progressTrack(isDark).replace("h-2 w-full overflow-hidden rounded-full ", "");
  const actionButtonClass = themeControl.actionTile(isDark);

  const getUserName = (id) => {
    if (!id) return "-";
    const user = dictionaries.users?.find((item) => item.id === id);
    if (!user) return id;
    return `${user.first_name} ${user.last_name}`;
  };

  const getStatusStyle = (id) => {
    const status = dictionaries.projectStatuses?.find((item) => item.id === id);
    if (!status) {
      return { label: "", color: isDark ? "bg-gray-700 text-gray-300" : "bg-slate-200 text-slate-800" };
    }
    switch (status.label) {
      case "Планирование":
        return { label: status.label, color: isDark ? "bg-gray-700 text-gray-300" : "bg-slate-200 text-slate-800" };
      case "В работе":
        return { label: status.label, color: "bg-blue-600 text-white" };
      case "Завершен":
        return { label: status.label, color: "bg-green-600 text-white" };
      case "Приостановлен":
        return { label: status.label, color: "bg-red-600 text-white" };
      default:
        return { label: status.label, color: isDark ? "bg-gray-700 text-gray-300" : "bg-slate-200 text-slate-800" };
    }
  };

  const getProgressColor = (percent) => {
    if (percent < 30) return "bg-red-500";
    if (percent < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatMoney = (value) => (!value ? "0" : Number(value).toLocaleString("ru-RU"));
  const getBudgetPercentRaw = (item) => (!item.planned_budget || !item.actual_budget ? 0 : (item.actual_budget / item.planned_budget) * 100);
  const getBudgetPercentUI = (item) => Math.min(getBudgetPercentRaw(item), 100);
  const getBudgetColor = (item) => {
    const planned = Number(item.planned_budget);
    const actual = Number(item.actual_budget);
    if (!planned) return "bg-gray-500";
    if (actual > planned) return "bg-red-500";
    if (actual > planned * 0.7) return "bg-yellow-500";
    return "bg-green-500";
  };

  const projectStatus = getStatusStyle(project.status);

  return (
    <div className={isDark ? "space-y-4 text-white" : "space-y-4 text-black"}>
      <div className={`${cardClass} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className={`select-none truncate text-base font-semibold ${titleClass}`}>{project.name}</h1>
          <div className={`select-none rounded px-2 py-[3px] text-xs ${projectStatus.color}`}>{projectStatus.label}</div>
        </div>

        <div className={`flex flex-wrap justify-between gap-x-2 text-sm select-none ${subTextClass}`}>
          <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
          <span className={`max-w-[60%] truncate ${textClass}`}>{project.address || "-"}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className={`mb-1 flex justify-between text-xs select-none ${subTextClass}`}>
              <span>Бюджет</span>
              <span className={titleClass}>{Math.round(getBudgetPercentRaw(project))}%</span>
            </div>
            <div className={`h-2 w-full rounded ${trackClass} select-none`}>
              <div className={`${getBudgetColor(project)} h-full`} style={{ width: `${getBudgetPercentUI(project)}%` }} />
            </div>
            <div className={`mt-1 flex justify-between text-xs select-none ${mutedTextClass}`}>
              <span>{formatMoney(project.planned_budget)}</span>
              <span>{formatMoney(project.actual_budget)}</span>
            </div>
          </div>

          <div>
            <div className={`mb-1 flex justify-between text-xs select-none ${subTextClass}`}>
              <span>Прогресс</span>
              <span className={titleClass}>{project.progress_percent || 0}%</span>
            </div>
            <div className={`h-2 w-full rounded ${trackClass} select-none`}>
              <div className={`${getProgressColor(project.progress_percent)} h-full`} style={{ width: `${project.progress_percent || 0}%` }} />
            </div>
          </div>
        </div>

        <div className={`border-t pt-2 ${dividerClass}`}>
          <div className="flex justify-end">
            <div onClick={() => setShowTeam(!showTeam)} className="flex cursor-pointer items-center gap-1 text-xs text-blue-500 select-none">
              Команда
              <span className={`transition-transform duration-300 ${showTeam ? "rotate-180" : ""}`}>▼</span>
            </div>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${showTeam ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className={`space-y-1 text-sm ${textClass}`}>
              <div className="flex justify-between gap-3"><span className={mutedTextClass}>Менеджер</span><span>{getUserName(project.manager_id)}</span></div>
              <div className="flex justify-between gap-3"><span className={mutedTextClass}>Прораб</span><span>{getUserName(project.foreman_id)}</span></div>
              <div className="flex justify-between gap-3"><span className={mutedTextClass}>Мастер</span><span>{getUserName(project.master_id)}</span></div>
              <div className="flex justify-between gap-3"><span className={mutedTextClass}>Склад</span><span>{getUserName(project.warehouse_manager_id)}</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 pt-1 text-xs select-none">
          <div onClick={() => navigate(`/projects/${projectId}/documents`)} className={actionButtonClass}>Юр отдел</div>
          <div onClick={() => navigate(`/projects/${projectId}/reports`)} className={actionButtonClass}>Отчеты</div>
          <div onClick={() => navigate(`/projects/${projectId}/tasks`)} className={actionButtonClass}>Задачи</div>
          <div onClick={openWarehouseStocks} className={actionButtonClass}>Склад</div>
        </div>
      </div>

      <div className="space-y-3">
        {blocks.map((block) => {
          const expanded = expandedBlockId === block.id;

          return (
            <div key={block.id} className={`${cardClass} space-y-3 p-4`}>
              <div onClick={() => setExpandedBlockId(expanded ? null : block.id)} className="flex cursor-pointer items-center justify-between">
                <span className={`text-sm font-semibold ${titleClass}`}>{block.name}</span>
                <span className="text-xs text-blue-500">Данные {expanded ? "▲" : "▼"}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={`mb-1 flex justify-between text-xs ${subTextClass}`}>
                    <span>Бюджет</span>
                    <span className={titleClass}>{Math.round(getBudgetPercentRaw(block))}%</span>
                  </div>
                  <div className={`h-2 w-full rounded ${trackClass}`}>
                    <div className={`${getBudgetColor(block)} h-full`} style={{ width: `${getBudgetPercentUI(block)}%` }} />
                  </div>
                  <div className={`mt-1 flex justify-between text-xs ${mutedTextClass}`}>
                    <span>{formatMoney(block.planned_budget)}</span>
                    <span>{formatMoney(block.actual_budget)}</span>
                  </div>
                </div>

                <div>
                  <div className={`mb-1 flex justify-between text-xs ${subTextClass}`}>
                    <span>Прогресс</span>
                    <span className={titleClass}>{block.progress_percent || 0}%</span>
                  </div>
                  <div className={`h-2 w-full rounded ${trackClass}`}>
                    <div className={`${getProgressColor(block.progress_percent)} h-full`} style={{ width: `${block.progress_percent || 0}%` }} />
                  </div>
                </div>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className={`space-y-3 border-t pt-3 ${dividerClass}`}>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><div className={`text-xs ${mutedTextClass}`}>Общая площадь</div><div className={textClass}>{block.total_area}</div></div>
                    <div><div className={`text-xs ${mutedTextClass}`}>Площадь продажи</div><div className={textClass}>{block.sale_area}</div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><div className={`text-xs ${mutedTextClass}`}>Объем работ</div><div className={textClass}>{block.planned_volume}</div></div>
                    <div><div className={`text-xs ${mutedTextClass}`}>Сделано</div><div className="text-green-500">{block.done_volume}</div></div>
                    <div><div className={`text-xs ${mutedTextClass}`}>Остаток</div><div className="text-yellow-500">{block.remaining_volume}</div></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div onClick={() => navigate(`/projects/${projectId}/blocks/${block.id}/estimates`)} className={actionButtonClass}>Смета</div>
                <div onClick={() => navigate(`/projects/${projectId}/blocks/${block.id}/material-requests`)} className={actionButtonClass}>Заявки</div>
                <div onClick={() => navigate(`/projects/${projectId}/blocks/${block.id}/purchase-orders`)} className={actionButtonClass}>Закуп</div>
                <div onClick={() => navigate(`/projects/${projectId}/blocks/${block.id}/work-performed`)} className={actionButtonClass}>АВР</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
