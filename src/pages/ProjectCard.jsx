import { useContext, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { formatDate } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import { AuthContext } from "../auth/AuthContext";
import { themeBorder, themeControl, themeMisc, themeSurface, themeText } from "../utils/themeStyles";
import PullToRefresh from "../components/PullToRefresh";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const STRUCTURE_EDITOR_ROLE_IDS = [1, 10, 11];
const PROJECT_MANAGER_ROLE_IDS = [1, 10];

const emptyStageForm = {
  id: null,
  name: "",
  start_date: "",
  end_date: ""
};

const emptySubsectionForm = {
  id: null,
  name: ""
};

const emptyProjectForm = {
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

const emptyBlockForm = {
  id: null,
  name: "",
  planned_budget: "",
  total_area: "",
  sale_area: ""
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
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [stageForm, setStageForm] = useState(emptyStageForm);
  const [subsectionForm, setSubsectionForm] = useState(emptySubsectionForm);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [blockForm, setBlockForm] = useState(emptyBlockForm);
  const [stageModalBlockId, setStageModalBlockId] = useState(null);
  const [subsectionModalStageId, setSubsectionModalStageId] = useState(null);

  const canManageStructure = STRUCTURE_EDITOR_ROLE_IDS.includes(Number(user?.role_id));
  const canManageProject = PROJECT_MANAGER_ROLE_IDS.includes(Number(user?.role_id));

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

  const openEditProject = () => {
    setProjectForm({
      name: project?.name || "",
      address: project?.address || "",
      customer_name: project?.customer_name || "",
      start_date: project?.start_date ? String(project.start_date).slice(0, 10) : "",
      end_date: project?.end_date ? String(project.end_date).slice(0, 10) : "",
      planned_budget: project?.planned_budget ?? "",
      manager_id: project?.manager_id ?? "",
      foreman_id: project?.foreman_id ?? "",
      master_id: project?.master_id ?? "",
      warehouse_manager_id: project?.warehouse_manager_id ?? "",
      description: project?.description || ""
    });
    setProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setProjectForm(emptyProjectForm);
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
      const res = await putRequest(`/projects/update/${projectId}`, {
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
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить объект");
        return;
      }

      toast.success("Объект обновлен");
      closeProjectModal();
      await loadProject();
    } catch (error) {
      console.error("Project save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения объекта");
    } finally {
      setSavingProject(false);
    }
  };

  const deleteProjectItem = async () => {
    if (!window.confirm(`Удалить объект "${project?.name}"?`)) return;

    try {
      const res = await deleteRequest(`/projects/delete/${projectId}`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить объект");
        return;
      }

      toast.success("Объект удален");
      navigate("/projects");
    } catch (error) {
      console.error("Project delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления объекта");
    }
  };

  const openCreateBlock = () => {
    setBlockForm(emptyBlockForm);
    setBlockModalOpen(true);
  };

  const openEditBlock = (block) => {
    setBlockForm({
      id: block.id,
      name: block.name || "",
      planned_budget: block.planned_budget ?? "",
      total_area: block.total_area ?? "",
      sale_area: block.sale_area ?? ""
    });
    setBlockModalOpen(true);
  };

  const closeBlockModal = () => {
    setBlockForm(emptyBlockForm);
    setBlockModalOpen(false);
  };

  const handleBlockFormChange = (field, value) => {
    setBlockForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveBlock = async (e) => {
    e.preventDefault();

    if (!blockForm.name.trim()) {
      toast.error("Введите название блока");
      return;
    }

    try {
      setSavingBlock(true);
      const payload = {
        name: blockForm.name.trim(),
        project_id: Number(projectId),
        planned_budget: normalizeNullableNumber(blockForm.planned_budget) || 0,
        total_area: normalizeNullableNumber(blockForm.total_area) || 0,
        sale_area: normalizeNullableNumber(blockForm.sale_area) || 0
      };

      const res = blockForm.id
        ? await putRequest(`/projectBlocks/update/${blockForm.id}`, payload)
        : await postRequest("/projectBlocks/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить блок");
        return;
      }

      toast.success(blockForm.id ? "Блок обновлен" : "Блок создан");
      closeBlockModal();
      await loadBlocks();
    } catch (error) {
      console.error("Block save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения блока");
    } finally {
      setSavingBlock(false);
    }
  };

  const deleteBlockItem = async (block) => {
    if (!window.confirm(`Удалить блок "${block.name}"?`)) return;

    try {
      const res = await deleteRequest(`/projectBlocks/delete/${block.id}`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить блок");
        return;
      }

      toast.success("Блок удален");
      if (expandedBlockId === block.id) {
        setExpandedBlockId(null);
      }
      await loadBlocks();
    } catch (error) {
      console.error("Block delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления блока");
    }
  };

  useEffect(() => {
    loadProject();
    loadBlocks();
    loadDicts();
  }, [projectId]);

  useEffect(() => {
    const parentPath = "/projects";
    if (typeof window === "undefined") return undefined;

    window.history.pushState({ projectCardBackGuard: true }, "", window.location.href);

    const handlePopState = () => {
      navigate(parentPath, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  const handleRefresh = async () => {
    await Promise.all([loadProject(), loadBlocks(), loadDicts()]);

    if (expandedBlockId) {
      await loadBlockStructure(expandedBlockId);
    }
  };

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
  const formatPercent = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0";
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, "");
  };
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
    setStageForm({
      id: stage.id,
      name: stage.name || "",
      start_date: stage?.start_date ? String(stage.start_date).slice(0, 10) : "",
      end_date: stage?.end_date ? String(stage.end_date).slice(0, 10) : ""
    });
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
      const payload = {
        name: stageForm.name.trim(),
        block_id: Number(stageModalBlockId),
        start_date: stageForm.start_date || null,
        end_date: stageForm.end_date || null
      };
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
      <PullToRefresh onRefresh={handleRefresh}>
      <div className={`${cardClass} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className={`select-none truncate text-base font-semibold ${titleClass}`}>{project.name}</h1>
            <div className={`select-none rounded px-2 py-[3px] text-xs ${projectStatus.color}`}>{projectStatus.label}</div>
          </div>
          {canManageProject && (
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={deleteProjectItem} className="rounded bg-red-600/20 p-2 text-red-500 hover:bg-red-600/30">
                <Trash2 size={14} />
              </button>
              <button onClick={openEditProject} className={themeControl.actionTilePadded(isDark)}>
                <Pencil size={14} />
              </button>
            </div>
          )}
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
              <span className={titleClass}>{formatPercent(project.progress_percent)}%</span>
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
        {canManageProject && (
          <div className="flex justify-end">
            <button
              onClick={openCreateBlock}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
            >
              <Plus size={14} />
              Блок
            </button>
          </div>
        )}

        {blocks.map((block) => {
          const expanded = expandedBlockId === block.id;
          const stages = blockStages[block.id] || [];

          return (
            <div key={block.id} className={`${cardClass} space-y-3 p-3`}>
              <div onClick={() => toggleBlock(block.id)} className="flex cursor-pointer items-center justify-between gap-3">
                <span className={`text-sm font-semibold ${titleClass}`}>{block.name}</span>
                {canManageProject && (
                  <div className="ml-auto mr-3 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBlockItem(block);
                      }}
                      className="rounded bg-red-600/20 p-2 text-red-500 hover:bg-red-600/30"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditBlock(block);
                      }}
                      className={themeControl.actionTilePadded(isDark)}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
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
                    <span className={titleClass}>{formatPercent(block.progress_percent)}%</span>
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

                  <div className={`rounded-xl border px-1 py-2 ${dividerClass}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
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
                                  <button
                                    onClick={() => openCreateSubsection(stage.id)}
                                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
                                  >
                                    <Plus size={14} />
                                    Подэтап
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
      </PullToRefresh>

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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Дата начала</div>
                  <input
                    type="date"
                    value={stageForm.start_date}
                    onChange={(e) => setStageForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className={modalInputClass}
                  />
                </div>
                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Дата окончания</div>
                  <input
                    type="date"
                    value={stageForm.end_date}
                    onChange={(e) => setStageForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className={modalInputClass}
                  />
                </div>
              </div>

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

      {blockModalOpen && canManageProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} w-full max-w-md p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>{blockForm.id ? "Редактировать блок" : "Новый блок"}</div>
                <div className={`text-xs ${subTextClass}`}>Управление блоком</div>
              </div>
              <button onClick={closeBlockModal} className={`${subTextClass} ${isDark ? "hover:text-white" : "hover:text-black"}`}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveBlock} className="space-y-3">
              <div>
                <div className={`mb-1 text-xs ${subTextClass}`}>Название</div>
                <input
                  value={blockForm.name}
                  onChange={(e) => handleBlockFormChange("name", e.target.value)}
                  placeholder="Название блока"
                  className={modalInputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Бюджет</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={blockForm.planned_budget}
                    onChange={(e) => handleBlockFormChange("planned_budget", e.target.value)}
                    placeholder="Плановый бюджет"
                    className={modalInputClass}
                  />
                </div>
                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Общая площадь</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={blockForm.total_area}
                    onChange={(e) => handleBlockFormChange("total_area", e.target.value)}
                    placeholder="Общая площадь"
                    className={modalInputClass}
                  />
                </div>
              </div>

              <div>
                <div className={`mb-1 text-xs ${subTextClass}`}>Площадь продажи</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={blockForm.sale_area}
                  onChange={(e) => handleBlockFormChange("sale_area", e.target.value)}
                  placeholder="Площадь продажи"
                  className={modalInputClass}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeBlockModal} className={subtleButtonClass}>Отмена</button>
                <button type="submit" disabled={savingBlock} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingBlock ? "Сохранение..." : blockForm.id ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {projectModalOpen && canManageProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} flex max-h-[88vh] w-full max-w-xl flex-col p-3`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>Редактировать объект</div>
                <div className={`text-xs ${subTextClass}`}>Управление объектом</div>
              </div>
              <button onClick={closeProjectModal} className={`${subTextClass} ${isDark ? "hover:text-white" : "hover:text-black"}`}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveProject} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Название</div>
                    <input value={projectForm.name} onChange={(e) => handleProjectFormChange("name", e.target.value)} className={modalInputClass} placeholder="Название объекта" />
                  </div>
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Заказчик</div>
                    <input value={projectForm.customer_name} onChange={(e) => handleProjectFormChange("customer_name", e.target.value)} className={modalInputClass} placeholder="Заказчик" />
                  </div>
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Бюджет</div>
                    <input type="number" min="0" step="0.01" value={projectForm.planned_budget} onChange={(e) => handleProjectFormChange("planned_budget", e.target.value)} className={modalInputClass} placeholder="Плановый бюджет" />
                  </div>
                </div>

                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Адрес</div>
                  <input value={projectForm.address} onChange={(e) => handleProjectFormChange("address", e.target.value)} className={modalInputClass} placeholder="Адрес" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Дата начала</div>
                    <input type="date" value={projectForm.start_date} onChange={(e) => handleProjectFormChange("start_date", e.target.value)} className={modalInputClass} />
                  </div>
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Дата окончания</div>
                    <input type="date" value={projectForm.end_date} onChange={(e) => handleProjectFormChange("end_date", e.target.value)} className={modalInputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Менеджер</div>
                    <select value={projectForm.manager_id} onChange={(e) => handleProjectFormChange("manager_id", e.target.value)} className={modalInputClass}>
                      <option value="">Не выбран</option>
                      {(dictionaries.users || []).map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Прораб</div>
                    <select value={projectForm.foreman_id} onChange={(e) => handleProjectFormChange("foreman_id", e.target.value)} className={modalInputClass}>
                      <option value="">Не выбран</option>
                      {(dictionaries.users || []).map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Мастер</div>
                    <select value={projectForm.master_id} onChange={(e) => handleProjectFormChange("master_id", e.target.value)} className={modalInputClass}>
                      <option value="">Не выбран</option>
                      {(dictionaries.users || []).map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={`mb-1 text-xs ${subTextClass}`}>Кладовщик</div>
                    <select value={projectForm.warehouse_manager_id} onChange={(e) => handleProjectFormChange("warehouse_manager_id", e.target.value)} className={modalInputClass}>
                      <option value="">Не выбран</option>
                      {(dictionaries.users || []).map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className={`mb-1 text-xs ${subTextClass}`}>Комментарий</div>
                  <textarea value={projectForm.description} onChange={(e) => handleProjectFormChange("description", e.target.value)} className={`${modalInputClass} min-h-[72px] resize-none`} placeholder="Комментарий" />
                </div>
              </div>

              <div className="flex gap-2 border-t pt-2">
                <button type="button" onClick={closeProjectModal} className={subtleButtonClass}>Отмена</button>
                <button type="submit" disabled={savingProject} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingProject ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
