import { useContext, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { formatDate } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import { AuthContext } from "../auth/AuthContext";
import { themeBorder, themeControl, themeMisc, themeSurface, themeText } from "../utils/themeStyles";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const STRUCTURE_EDITOR_ROLE_IDS = [1, 10, 11];

const emptyStageForm = {
  id: null,
  name: ""
};

const emptySubsectionForm = {
  id: null,
  name: ""
};

export default function ProjectCard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);

  const [project, setProject] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [showTeam, setShowTeam] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [blockStages, setBlockStages] = useState({});
  const [stageSubsections, setStageSubsections] = useState({});
  const [loadingStructureBlockId, setLoadingStructureBlockId] = useState(null);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [subsectionModalOpen, setSubsectionModalOpen] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [savingSubsection, setSavingSubsection] = useState(false);
  const [stageForm, setStageForm] = useState(emptyStageForm);
  const [subsectionForm, setSubsectionForm] = useState(emptySubsectionForm);
  const [stageModalBlockId, setStageModalBlockId] = useState(null);
  const [subsectionModalStageId, setSubsectionModalStageId] = useState(null);

  const canManageStructure = STRUCTURE_EDITOR_ROLE_IDS.includes(Number(user?.role_id));

  const loadProject = async () => {
    const res = await getRequest(`/projects/getById/${projectId}`);
    if (res.success) setProject(res.data);
  };

  const loadBlocks = async () => {
    const res = await postRequest("/projectBlocks/search", { project_id: Number(projectId) });
    if (res.success) setBlocks(res.data || []);
  };

  const loadDicts = async () => {
    setDictionaries(await loadDictionaries(["projectStatuses", "users"]));
  };

  const loadBlockStructure = async (blockId) => {
    try {
      setLoadingStructureBlockId(blockId);
      const stagesRes = await postRequest("/blockStages/search", {
        block_id: Number(blockId),
        page: 1,
        size: 200
      });

      const stages = stagesRes?.success ? stagesRes.data || [] : [];
      setBlockStages((prev) => ({ ...prev, [blockId]: stages }));

      if (!stages.length) {
        return;
      }

      const subsectionResults = await Promise.all(
        stages.map((stage) =>
          postRequest("/stageSubsections/search", {
            stage_id: Number(stage.id),
            page: 1,
            size: 200
          }).then((res) => ({
            stageId: stage.id,
            items: res?.success ? res.data || [] : []
          }))
        )
      );

      setStageSubsections((prev) => {
        const next = { ...prev };
        subsectionResults.forEach(({ stageId, items }) => {
          next[stageId] = items;
        });
        return next;
      });
    } catch (error) {
      console.error("Structure load error", error);
      toast.error("Ошибка загрузки этапов");
    } finally {
      setLoadingStructureBlockId(null);
    }
  };

  const toggleBlock = async (blockId) => {
    const nextExpanded = expandedBlockId === blockId ? null : blockId;
    setExpandedBlockId(nextExpanded);

    if (nextExpanded && !blockStages[blockId]) {
      await loadBlockStructure(blockId);
    }
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

  const cardClass = themeSurface.card(isDark);
  const titleClass = themeText.title(isDark);
  const textClass = themeText.primary(isDark);
  const subTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const dividerClass = themeBorder.divider(isDark);
  const trackClass = themeMisc.progressTrack(isDark).replace("h-2 w-full overflow-hidden rounded-full ", "");
  const actionButtonClass = themeControl.actionTile(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);

  const getUserName = (id) => {
    if (!id) return "-";
    const dictionaryUser = dictionaries.users?.find((item) => item.id === id);
    if (!dictionaryUser) return id;
    return `${dictionaryUser.first_name} ${dictionaryUser.last_name}`;
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

  const projectStatus = useMemo(() => getStatusStyle(project?.status), [project?.status, dictionaries.projectStatuses, isDark]);

  const openCreateStage = (blockId) => {
    setStageForm(emptyStageForm);
    setStageModalBlockId(blockId);
    setStageModalOpen(true);
  };

  const openEditStage = (blockId, stage) => {
    setStageForm({ id: stage.id, name: stage.name || "" });
    setStageModalBlockId(blockId);
    setStageModalOpen(true);
  };

  const closeStageModal = () => {
    setStageForm(emptyStageForm);
    setStageModalBlockId(null);
    setStageModalOpen(false);
  };

  const openCreateSubsection = (stageId) => {
    setSubsectionForm(emptySubsectionForm);
    setSubsectionModalStageId(stageId);
    setSubsectionModalOpen(true);
  };

  const openEditSubsection = (stageId, subsection) => {
    setSubsectionForm({
      id: subsection.id,
      name: subsection.name || ""
    });
    setSubsectionModalStageId(stageId);
    setSubsectionModalOpen(true);
  };

  const closeSubsectionModal = () => {
    setSubsectionForm(emptySubsectionForm);
    setSubsectionModalStageId(null);
    setSubsectionModalOpen(false);
  };

  const saveStage = async (e) => {
    e.preventDefault();
    if (!stageForm.name.trim() || !stageModalBlockId) {
      toast.error("Введите название этапа");
      return;
    }

    try {
      setSavingStage(true);
      const payload = { name: stageForm.name.trim(), block_id: Number(stageModalBlockId) };
      const res = stageForm.id
        ? await putRequest(`/blockStages/update/${stageForm.id}`, payload)
        : await postRequest("/blockStages/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить этап");
        return;
      }

      toast.success(stageForm.id ? "Этап обновлен" : "Этап создан");
      closeStageModal();
      await loadBlockStructure(stageModalBlockId);
    } catch (error) {
      console.error("Stage save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения этапа");
    } finally {
      setSavingStage(false);
    }
  };

  const saveSubsection = async (e) => {
    e.preventDefault();
    if (!subsectionForm.name.trim() || !subsectionModalStageId) {
      toast.error("Введите название подэтапа");
      return;
    }

    try {
      setSavingSubsection(true);
      const payload = {
        name: subsectionForm.name.trim(),
        stage_id: Number(subsectionModalStageId)
      };

      const res = subsectionForm.id
        ? await putRequest(`/stageSubsections/update/${subsectionForm.id}`, payload)
        : await postRequest("/stageSubsections/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить подэтап");
        return;
      }

      toast.success(subsectionForm.id ? "Подэтап обновлен" : "Подэтап создан");
      closeSubsectionModal();
      if (expandedBlockId) {
        await loadBlockStructure(expandedBlockId);
      }
    } catch (error) {
      console.error("Subsection save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения подэтапа");
    } finally {
      setSavingSubsection(false);
    }
  };

  const deleteStageItem = async (blockId, stage) => {
    if (!window.confirm(`Удалить этап "${stage.name}"?`)) return;

    try {
      const res = await deleteRequest(`/blockStages/delete/${stage.id}`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить этап");
        return;
      }
      toast.success("Этап удален");
      await loadBlockStructure(blockId);
    } catch (error) {
      console.error("Stage delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления этапа");
    }
  };

  const deleteSubsectionItem = async (blockId, subsection) => {
    if (!window.confirm(`Удалить подэтап "${subsection.name}"?`)) return;

    try {
      const res = await deleteRequest(`/stageSubsections/delete/${subsection.id}`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить подэтап");
        return;
      }
      toast.success("Подэтап удален");
      await loadBlockStructure(blockId);
    } catch (error) {
      console.error("Subsection delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления подэтапа");
    }
  };

  if (!project) return null;

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

        <div className="grid grid-cols-4 gap-1.5 pt-1 text-xs select-none">
          <div onClick={() => toast("Раздел платежей в работе")} className={actionButtonClass}>Платежи</div>
        </div>
      </div>

      <div className="space-y-3">
        {blocks.map((block) => {
          const expanded = expandedBlockId === block.id;
          const stages = blockStages[block.id] || [];

          return (
            <div key={block.id} className={`${cardClass} space-y-3 p-4`}>
              <div onClick={() => toggleBlock(block.id)} className="flex cursor-pointer items-center justify-between">
                <span className={`text-sm font-semibold ${titleClass}`}>{block.name}</span>
                <span className="text-xs text-blue-500">Этапы {expanded ? "▲" : "▼"}</span>
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

              <div className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-2 max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
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

                  <div className={`rounded-xl border px-1 py-2.5 ${dividerClass}`}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <div className={`text-sm font-semibold ${titleClass}`}>Этапы и подэтапы</div>
                        <div className={`text-xs ${subTextClass}`}>Структура блока</div>
                      </div>

                      {canManageStructure && (
                        <button
                          onClick={() => openCreateStage(block.id)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
                        >
                          <Plus size={14} />
                          Этап
                        </button>
                      )}
                    </div>

                    {loadingStructureBlockId === block.id && (
                      <div className={`text-sm ${subTextClass}`}>Загрузка этапов...</div>
                    )}

                    {!loadingStructureBlockId && stages.length === 0 && (
                      <div className={`text-sm ${subTextClass}`}>Этапы для блока еще не добавлены.</div>
                    )}

                    <div className="space-y-3">
                      {stages.map((stage) => {
                        const subsections = stageSubsections[stage.id] || [];

                        return (
                          <div key={stage.id} className={`rounded-xl border px-2 py-2 ${isDark ? "border-gray-800 bg-gray-950/60" : "border-slate-200 bg-slate-50"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`break-words text-sm font-semibold ${titleClass}`}>{stage.name}</div>
                                <div className={`mt-1 text-xs ${mutedTextClass}`}>
                                  {stage.start_date ? `Начало: ${formatDate(stage.start_date)}` : "Дата не указана"}
                                  {stage.end_date ? ` • Конец: ${formatDate(stage.end_date)}` : ""}
                                </div>
                              </div>

                              {canManageStructure && (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => deleteStageItem(block.id, stage)} className="rounded-lg bg-red-600/20 p-2 text-red-500 hover:bg-red-600/30">
                                    <Trash2 size={14} />
                                  </button>
                                  <button onClick={() => openCreateSubsection(stage.id)} className={themeControl.actionTilePadded(isDark)}>
                                    <Plus size={14} />
                                  </button>
                                  <button onClick={() => openEditStage(block.id, stage)} className={themeControl.actionTilePadded(isDark)}>
                                    <Pencil size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 space-y-2">
                              {subsections.length === 0 && (
                                <div className={`text-xs ${subTextClass}`}>Подэтапы еще не добавлены.</div>
                              )}

                              {subsections.map((subsection) => (
                                <div key={subsection.id} className={`flex items-center justify-between gap-3 rounded-lg border px-2 py-1.5 ${isDark ? "border-gray-800 bg-gray-900/70" : "border-slate-200 bg-white"}`}>
                                  <div className="min-w-0 flex-1">
                                    <div className={`break-words text-sm ${textClass}`}>{subsection.name}</div>
                                  </div>

                                  {canManageStructure && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => deleteSubsectionItem(block.id, subsection)} className="rounded-lg bg-red-600/20 p-2 text-red-500 hover:bg-red-600/30">
                                        <Trash2 size={14} />
                                      </button>
                                      <button onClick={() => openEditSubsection(stage.id, subsection)} className={themeControl.actionTilePadded(isDark)}>
                                        <Pencil size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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

      {stageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} w-full max-w-md p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>{stageForm.id ? "Редактирование этапа" : "Новый этап"}</div>
                <div className={`text-xs ${subTextClass}`}>Этап внутри блока</div>
              </div>
              <button onClick={closeStageModal} className={`${subTextClass} ${isDark ? "hover:text-white" : "hover:text-black"}`}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveStage} className="space-y-3">
              <input
                value={stageForm.name}
                onChange={(e) => setStageForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Название этапа"
                className={modalInputClass}
              />

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeStageModal} className={subtleButtonClass}>Отмена</button>
                <button type="submit" disabled={savingStage} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingStage ? "Сохранение..." : stageForm.id ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {subsectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} w-full max-w-md p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>{subsectionForm.id ? "Редактирование подэтапа" : "Новый подэтап"}</div>
                <div className={`text-xs ${subTextClass}`}>Подэтап внутри этапа</div>
              </div>
              <button onClick={closeSubsectionModal} className={`${subTextClass} ${isDark ? "hover:text-white" : "hover:text-black"}`}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveSubsection} className="space-y-3">
              <input
                value={subsectionForm.name}
                onChange={(e) => setSubsectionForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Название подэтапа"
                className={modalInputClass}
              />

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeSubsectionModal} className={subtleButtonClass}>Отмена</button>
                <button type="submit" disabled={savingSubsection} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingSubsection ? "Сохранение..." : subsectionForm.id ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
