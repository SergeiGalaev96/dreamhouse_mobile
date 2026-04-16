import { useContext, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { useParams } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import { FileIcon, defaultStyles } from "react-file-icon";
import api, { baseURL } from "../api/axios";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { AuthContext } from "../auth/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AuditLogModal from "./AuditLogModal";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDate, formatDateTime } from "../utils/date";
import { getAuthToken } from "../utils/authStorage";
import { themeBorder, themeControl, themeSurface, themeText } from "../utils/themeStyles";

const emptyDocumentForm = {
  name: "",
  description: "",
  location: "",
  price: "",
  deadline: "",
  status: 1,
  responsible_users: []
};

const emptyStageForm = { name: "" };

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("ru-RU")} сом`;
};

const isImageFile = (file) => file?.mime_type?.startsWith("image");

const getStatusStyle = (statusId, statuses, isDark) => {
  const label = statuses.find((item) => item.id === Number(statusId))?.label || "Без статуса";
  const normalized = label.toLowerCase();

  if (normalized.includes("подпис")) return "border-green-800 bg-green-950 text-green-300";
  if (normalized.includes("провер") || normalized.includes("соглас")) return "border-blue-800 bg-blue-950 text-blue-300";
  if (normalized.includes("отклон") || normalized.includes("проср")) return "border-red-800 bg-red-950 text-red-300";

  return isDark ? "border-gray-700 bg-gray-800 text-gray-300" : "border-slate-300 bg-slate-100 text-slate-700";
};

const getSelectStyles = (isDark) => ({
  control: (base, state) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff",
    borderColor: state.isFocused ? "#3b82f6" : isDark ? "#374151" : "#cbd5e1",
    boxShadow: "none",
    minHeight: 42
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff",
    border: `1px solid ${isDark ? "#374151" : "#cbd5e1"}`
  }),
  menuList: (base) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff"
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? (isDark ? "#374151" : "#e2e8f0") : isDark ? "#111827" : "#ffffff",
    color: isDark ? "#f9fafb" : "#0f172a",
    cursor: "pointer"
  }),
  singleValue: (base) => ({ ...base, color: isDark ? "#f9fafb" : "#0f172a" }),
  placeholder: (base) => ({ ...base, color: isDark ? "#9ca3af" : "#64748b" }),
  input: (base) => ({ ...base, color: isDark ? "#f9fafb" : "#0f172a" }),
  multiValue: (base) => ({ ...base, backgroundColor: isDark ? "#1f2937" : "#e2e8f0" }),
  multiValueLabel: (base) => ({ ...base, color: isDark ? "#f9fafb" : "#0f172a" }),
  dropdownIndicator: (base) => ({ ...base, color: isDark ? "#9ca3af" : "#64748b" }),
  indicatorSeparator: () => ({ display: "none" })
});

export default function ProjectDocuments() {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [documents, setDocuments] = useState({});
  const [loadedStages, setLoadedStages] = useState({});
  const [stages, setStages] = useState([]);
  const [stagePagination, setStagePagination] = useState(null);
  const [dictionaries, setDictionaries] = useState({ documentStatuses: [], users: [], projects: [] });
  const [loading, setLoading] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [stageSearch, setStageSearch] = useState("");
  const [stageInputSearch, setStageInputSearch] = useState("");
  const [stagePage, setStagePage] = useState(1);
  const [searchByStage, setSearchByStage] = useState({});
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [expandedStageId, setExpandedStageId] = useState(null);
  const [documentFiles, setDocumentFiles] = useState({});
  const [loadingFilesId, setLoadingFilesId] = useState(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageForm, setStageForm] = useState(emptyStageForm);
  const [previewFiles, setPreviewFiles] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntity, setHistoryEntity] = useState(null);
  const [historyId, setHistoryId] = useState(null);

  const touchStartX = useRef(0);

  const canApprove = user?.role_id === 1 || user?.role_id === 2;
  const canDelete = user?.role_id === 1 || user?.role_id === 14;

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const panelClass = `${themeSurface.panel(isDark)} rounded-2xl px-3 py-3`;
  const itemPanelClass = `${themeSurface.panel(isDark)} rounded-2xl px-2 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.08)]`;
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);

  const projectName = dictionaries.projects?.find((item) => item.id === Number(projectId))?.label || `Проект #${projectId}`;

  const userOptions = useMemo(
    () => (dictionaries.users || []).map((item) => ({ value: item.id, label: item.label || item.username })),
    [dictionaries.users]
  );

  const openHistory = (id) => {
    setHistoryEntity("document");
    setHistoryId(id);
    setHistoryOpen(true);
  };

  const getUserNames = (ids = []) => {
    if (!Array.isArray(ids) || !ids.length) return "—";
    return ids.map((id) => dictionaries.users?.find((item) => item.id === Number(id))?.label).filter(Boolean).join(", ") || "—";
  };

  const getStatusName = (statusId) => dictionaries.documentStatuses?.find((item) => item.id === Number(statusId))?.label || "—";

  const loadDicts = async () => {
    const dicts = await loadDictionaries(["documentStatuses", "users", "projects"]);
    setDictionaries({
      documentStatuses: dicts.documentStatuses || [],
      users: dicts.users || [],
      projects: dicts.projects || []
    });
  };

  const loadStages = async () => {
    try {
      setLoadingStages(true);
      const res = await postRequest("/documentStages/search", { page: stagePage, size: 10, search: stageSearch });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить этапы");
        return;
      }

      const filteredStages = (res.data || []).filter((item) => Number(item.project_id) === Number(projectId));

      setStages(filteredStages);
      setStagePagination(res.pagination || null);
      setDocuments((prev) => {
        const next = {};
        filteredStages.forEach((stage) => {
          next[stage.id] = prev[stage.id] || [];
        });
        return next;
      });
      setLoadedStages((prev) => {
        const next = {};
        filteredStages.forEach((stage) => {
          next[stage.id] = Boolean(prev[stage.id]);
        });
        return next;
      });
      setSearchByStage((prev) => {
        const next = {};
        filteredStages.forEach((stage) => {
          next[stage.id] = prev[stage.id] || "";
        });
        return next;
      });
      setExpandedStageId((prev) => {
        if (prev && filteredStages.some((stage) => stage.id === prev)) return prev;
        return null;
      });
    } catch (error) {
      console.error("Stages load error", error);
      toast.error("Ошибка загрузки этапов");
    } finally {
      setLoadingStages(false);
    }
  };

  const loadDocuments = async (stageId, searchValue = "") => {
    try {
      setLoading(true);
      const res = await postRequest("/documents/search", {
        entity_type: "document_stage",
        entity_id: Number(stageId),
        page: 1,
        size: 200,
        name: searchValue.trim() || undefined
      });

      if (res?.success) {
        setDocuments((prev) => ({ ...prev, [stageId]: res.data || [] }));
        setLoadedStages((prev) => ({ ...prev, [stageId]: true }));
      } else {
        toast.error(res?.message || "Не удалось загрузить документы");
      }
    } catch (error) {
      console.error("Documents load error", error);
      toast.error("Ошибка загрузки документов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDicts();
  }, [projectId]);

  useEffect(() => {
    loadStages();
  }, [projectId, stagePage, stageSearch]);

  useEffect(() => {
    if (!expandedStageId || loadedStages[expandedStageId]) return;
    loadDocuments(expandedStageId, searchByStage[expandedStageId] || "");
  }, [expandedStageId, loadedStages, searchByStage]);

  const loadFiles = async (documentId) => {
    try {
      setLoadingFilesId(documentId);
      const res = await getRequest(`/documentFiles/files/${documentId}`);
      if (res?.success) setDocumentFiles((prev) => ({ ...prev, [documentId]: res.data || [] }));
      else toast.error(res?.message || "Не удалось загрузить файлы");
    } catch (error) {
      console.error("Document files load error", error);
      toast.error("Ошибка загрузки файлов");
    } finally {
      setLoadingFilesId(null);
    }
  };

  const toggleDocument = async (documentId) => {
    if (expandedDocId === documentId) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(documentId);
    await loadFiles(documentId);
  };

  const openCreateDocument = () => {
    setEditingDocument(null);
    setDocumentForm(emptyDocumentForm);
    setDocumentModalOpen(true);
  };

  const openEditDocument = (item) => {
    setEditingDocument(item);
    setDocumentForm({
      name: item.name || "",
      description: item.description || "",
      location: item.location || "",
      price: item.price || "",
      deadline: item.deadline ? String(item.deadline).slice(0, 10) : "",
      status: item.status || "",
      responsible_users: Array.isArray(item.responsible_users)
        ? item.responsible_users.map((id) => ({
          value: id,
          label: dictionaries.users?.find((userItem) => userItem.id === Number(id))?.label || `User #${id}`
        }))
        : []
    });
    setDocumentModalOpen(true);
  };

  const closeDocumentModal = () => {
    setEditingDocument(null);
    setDocumentForm(emptyDocumentForm);
    setDocumentModalOpen(false);
  };

  const openCreateStage = () => {
    setEditingStage(null);
    setStageForm(emptyStageForm);
    setStageModalOpen(true);
  };

  const openEditStage = (item) => {
    setEditingStage(item);
    setStageForm({ name: item.name || "" });
    setStageModalOpen(true);
  };

  const closeStageModal = () => {
    setEditingStage(null);
    setStageForm(emptyStageForm);
    setStageModalOpen(false);
  };

  const handleStageSearch = () => {
    setStagePage(1);
    setStageSearch(stageInputSearch.trim());
  };

  const resetStageSearch = () => {
    setStageInputSearch("");
    setStagePage(1);
    setStageSearch("");
  };

  const saveDocument = async (e) => {
    e.preventDefault();
    if (!documentForm.name.trim()) return toast.error("Введите название документа");

    try {
      setSavingDocument(true);
      const targetStageId = editingDocument?.entity_id || expandedStageId;

      if (!targetStageId) {
        toast.error("Сначала выберите этап");
        return;
      }

      const payload = {
        entity_type: "document_stage",
        entity_id: Number(targetStageId),
        name: documentForm.name.trim(),
        description: documentForm.description.trim() || null,
        location: documentForm.location.trim() || null,
        price: documentForm.price === "" ? null : Number(documentForm.price),
        deadline: documentForm.deadline || null,
        status: Number(documentForm.status),
        responsible_users: (documentForm.responsible_users || []).map((item) => item.value)
      };

      const res = editingDocument
        ? await putRequest(`/documents/update/${editingDocument.id}`, payload)
        : await postRequest("/documents/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить документ");
        return;
      }

      toast.success(editingDocument ? "Документ обновлен" : "Документ создан");
      closeDocumentModal();
      await loadDocuments(targetStageId, searchByStage[targetStageId] || "");
    } catch (error) {
      console.error("Document save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения документа");
    } finally {
      setSavingDocument(false);
    }
  };

  const saveStage = async (e) => {
    e.preventDefault();
    if (!stageForm.name.trim()) return toast.error("Введите название этапа");

    try {
      setSavingStage(true);
      const payload = { name: stageForm.name.trim(), project_id: Number(projectId) };
      const res = editingStage
        ? await putRequest(`/documentStages/update/${editingStage.id}`, payload)
        : await postRequest("/documentStages/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить этап");
        return;
      }

      toast.success(editingStage ? "Этап обновлен" : "Этап создан");
      closeStageModal();
      if (!editingStage && stagePagination?.pages && stagePage !== 1) setStagePage(1);
      else await loadStages();
    } catch (error) {
      console.error("Stage save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения этапа");
    } finally {
      setSavingStage(false);
    }
  };

  const deleteDocumentItem = async (item) => {
    if (!canDelete) return;
    const confirmed = window.confirm(`Удалить документ "${item.name}"?`);
    if (!confirmed) return;

    try {
      const res = await deleteRequest(`/documents/delete/${item.id}`);
      if (res?.success) {
        toast.success("Документ удален");
        await loadDocuments(item.entity_id, searchByStage[item.entity_id] || "");
      } else {
        toast.error(res?.message || "Не удалось удалить документ");
      }
    } catch (error) {
      console.error("Document delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления документа");
    }
  };

  const deleteStageItem = async (item) => {
    if (!canDelete) return;
    const confirmed = window.confirm(`Удалить этап "${item.name}"?`);
    if (!confirmed) return;

    try {
      const res = await deleteRequest(`/documentStages/delete/${item.id}`);
      if (res?.success) {
        toast.success("Этап удален");
        if (stages.length === 1 && stagePage > 1) setStagePage((prev) => prev - 1);
        else await loadStages();
      } else {
        toast.error(res?.message || "Не удалось удалить этап");
      }
    } catch (error) {
      console.error("Stage delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления этапа");
    }
  };

  const handleUploadFiles = async (e, documentId) => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const token = getAuthToken();
      const res = await api.post(`/documentFiles/upload/${documentId}`, formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        toast.success("Файлы загружены");
        await loadFiles(documentId);
      } else {
        toast.error(res.data?.message || "Не удалось загрузить файлы");
      }
    } catch (error) {
      console.error("File upload error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки файлов");
    } finally {
      e.target.value = null;
    }
  };

  const handleDeleteFile = async (fileId, documentId) => {
    if (!canDelete) return;
    const confirmed = window.confirm("Удалить файл?");
    if (!confirmed) return;

    try {
      const res = await deleteRequest(`/documentFiles/${fileId}`);
      if (res?.success) {
        toast.success("Файл удален");
        await loadFiles(documentId);
      } else {
        toast.error(res?.message || "Не удалось удалить файл");
      }
    } catch (error) {
      console.error("File delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления файла");
    }
  };

  const getFileUrl = (fileId) => `${baseURL()}/documentFiles/download/${fileId}`;

  const openPreview = (files, index) => {
    setPreviewFiles(files.filter(isImageFile));
    setPreviewIndex(index);
  };

  const closePreview = () => {
    setPreviewFiles([]);
    setPreviewIndex(null);
  };

  const nextPreview = () => {
    setPreviewIndex((prev) => (prev + 1) % previewFiles.length);
  };

  const prevPreview = () => {
    setPreviewIndex((prev) => (prev === 0 ? previewFiles.length - 1 : prev - 1));
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50) nextPreview();
    if (delta < -50) prevPreview();
  };

  const getFileIcon = (file, size = 40) => {
    const name = (file.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const style = defaultStyles[ext] || defaultStyles.txt;

    return (
      <div style={{ width: size, height: size }}>
        <FileIcon extension={ext} {...style} />
      </div>
    );
  };

  const handleApprove = (item) => {
    console.log("approve", item.id);
  };

  const handleReject = (item) => {
    console.log("reject", item.id);
  };

  const renderFileTile = (file, files, imageIndex, documentId) => {
    const image = isImageFile(file);

    return (
      <div key={file.id} className={`${themeSurface.panel(isDark)} flex h-[140px] w-full flex-col p-2`}>
        <div className={`flex h-[70px] items-center justify-center overflow-hidden rounded-lg ${themeSurface.panelMuted(isDark)}`}>
          {image ? (
            <img
              src={getFileUrl(file.id)}
              alt={file.name}
              onClick={() => openPreview(files, imageIndex)}
              className="h-full w-full cursor-pointer object-contain"
            />
          ) : (
            getFileIcon(file, 42)
          )}
        </div>

        <div className={`mt-1 line-clamp-2 text-[11px] ${themeText.primary(isDark)}`}>{file.name}</div>

        <div className="mt-auto flex items-center justify-between px-1 pt-1">
          {canDelete ? (
            <button
              onClick={() => handleDeleteFile(file.id, documentId)}
              className="flex items-center justify-center rounded-md bg-red-600/20 p-1.5 text-red-500"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={() => window.open(getFileUrl(file.id), "_blank")}
            className="flex items-center justify-center rounded-md bg-blue-600/20 p-1.5 text-blue-400"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderDocumentsList = (stageId) => (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setExpandedStageId(stageId);
            openCreateDocument();
          }}
          className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
        >
          <Plus size={13} />
          Документ
        </button>
      </div>

      <div className="space-y-3">
        {loading && expandedStageId === stageId && <div className={`text-sm ${themeText.secondary(isDark)}`}>Загрузка документов...</div>}
        {!loading && loadedStages[stageId] && (documents[stageId] || []).length === 0 && <div className={`text-sm ${themeText.secondary(isDark)}`}>Документы не найдены.</div>}

        {!loading &&
          loadedStages[stageId] &&
          (documents[stageId] || []).map((item) => {
            const expanded = expandedDocId === item.id;
            const files = documentFiles[item.id] || [];
            let imageCounter = -1;

            return (
              <div key={item.id} className={itemPanelClass}>
                <div onClick={() => toggleDocument(item.id)} className="cursor-pointer space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex items-center gap-2 text-[11px] ${themeText.secondary(isDark)}`}>
                      <span>Создан: {formatDateTime(item.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDocumentItem(item);
                          }}
                          className="rounded-xl bg-red-600 p-2.5 text-white hover:bg-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openHistory(item.id);
                        }}
                        className={themeControl.actionTilePadded(isDark)}
                      >
                        <Clock size={14} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDocument(item);
                        }}
                        className={themeControl.actionTilePadded(isDark)}
                      >
                        <Pencil size={14} />
                      </button>

                      <div className={themeControl.actionTilePadded(isDark)}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  <div className={`break-words text-base font-semibold ${themeText.title(isDark)}`}>{item.name}</div>

                  {item.description && <div className={`break-words text-sm ${themeText.primary(isDark)}`}>{item.description}</div>}
                  {item.location && (
                    <div className={`break-words text-sm ${themeText.primary(isDark)}`}>
                      <span className={themeText.muted(isDark)}>Место:</span> {item.location}
                    </div>
                  )}

                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${themeText.primary(isDark)}`}>
                    <span>
                      <span className={themeText.muted(isDark)}>Цена:</span> {formatMoney(item.price)}
                    </span>
                    <span>
                      <span className={themeText.muted(isDark)}>Дедлайн:</span> {item.deadline ? formatDate(item.deadline) : "—"}
                    </span>
                    <div className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusStyle(item.status, dictionaries.documentStatuses, isDark)}`}>
                      {getStatusName(item.status)}
                    </div>
                  </div>

                  <div className={`rounded-lg px-3 py-1.5 text-[11px] leading-snug ${isDark ? "bg-gray-950/80 text-gray-300" : "bg-slate-100 text-slate-700"}`}>
                    <div className={`mb-0.5 text-[10px] ${themeText.muted(isDark)}`}>Ответственные</div>
                    {getUserNames(item.responsible_users)}
                  </div>

                  {canApprove && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(item);
                        }}
                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500"
                      >
                        Отклонить
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(item);
                        }}
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-500"
                      >
                        Подписать
                      </button>
                    </div>
                  )}
                </div>

                {expanded && (
                  <div className={`mt-3 rounded-2xl border p-2.5 ${themeBorder.divider(isDark)} ${isDark ? "bg-gray-950/70" : "bg-slate-50"}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                        <FolderOpen size={16} />
                        Файлы документа
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500">
                        <Upload size={14} />
                        Добавить
                        <input type="file" multiple className="hidden" onChange={(e) => handleUploadFiles(e, item.id)} />
                      </label>
                    </div>

                    {loadingFilesId === item.id && <div className={`text-xs ${themeText.secondary(isDark)}`}>Загрузка файлов...</div>}
                    {!loadingFilesId && files.length === 0 && (
                      <div className={`rounded-lg border border-dashed p-4 text-center text-xs ${isDark ? "border-gray-800 bg-gray-900/60 text-gray-500" : "border-slate-300 bg-white text-slate-500"}`}>
                        Файлы еще не добавлены
                      </div>
                    )}
                    {!loadingFilesId && files.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {files.map((file) => {
                          const imageIndex = isImageFile(file) ? ++imageCounter : -1;
                          return renderFileTile(file, files, imageIndex, item.id);
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );

  return (
    <div className={pageClass}>
      <div className="flex items-center gap-2">
        <Briefcase size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">Юр. отдел: {projectName}</h1>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-blue-400" />
            <div className={`text-xl font-semibold ${themeText.title(isDark)}`}>Этапы документов</div>
          </div>

          <button onClick={openCreateStage} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500">
            <Plus size={14} />
            Этап
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
            <input
              value={stageInputSearch}
              onChange={(e) => setStageInputSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStageSearch()}
              placeholder="Поиск этапа..."
              className={inputClass}
            />
          </div>

          <button onClick={handleStageSearch} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm text-white hover:bg-blue-500">
            Go
          </button>

          {(stageSearch || stageInputSearch) && (
            <button onClick={resetStageSearch} className={subtleButtonClass}>
              Сброс
            </button>
          )}
        </div>

        {loadingStages ? (
          <div className={`text-sm ${themeText.secondary(isDark)}`}>Загрузка этапов...</div>
        ) : stages.length === 0 ? (
          <div className={`text-sm ${themeText.secondary(isDark)}`}>Этапы еще не добавлены.</div>
        ) : (
          <div className="space-y-4">
            {stages.map((stage) => {
              const expanded = expandedStageId === stage.id;

              return (
                <div key={stage.id} className={panelClass}>
                  <div onClick={() => setExpandedStageId(expanded ? null : stage.id)} className="flex cursor-pointer items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] ${themeText.muted(isDark)}`}>Создан: {formatDateTime(stage.created_at)}</div>
                      <div className={`mt-1 break-words text-base font-semibold ${themeText.title(isDark)}`}>{stage.name}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteStageItem(stage);
                            }}
                            className="rounded-xl bg-red-600 p-2.5 text-white hover:bg-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditStage(stage);
                          }}
                          className={themeControl.actionTilePadded(isDark)}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>

                      <div className={themeControl.actionTilePadded(isDark)}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  {expanded && <div className="mt-3 -mx-1">{renderDocumentsList(stage.id)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {stagePagination && stagePagination.pages > 1 && (
          <div className="mt-4 flex justify-center gap-3">
            <button disabled={!stagePagination.hasPrev} onClick={() => setStagePage((prev) => prev - 1)} className={subtleButtonClass}>
              Назад
            </button>
            <span className={`text-sm ${themeText.secondary(isDark)}`}>{stagePagination.page} / {stagePagination.pages}</span>
            <button disabled={!stagePagination.hasNext} onClick={() => setStagePage((prev) => prev + 1)} className={subtleButtonClass}>
              Далее
            </button>
          </div>
        )}
      </div>

      {previewIndex !== null && previewFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={closePreview} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <img src={getFileUrl(previewFiles[previewIndex].id)} alt={previewFiles[previewIndex].name} className="max-h-[88vh] max-w-[92vw] rounded-xl" onClick={(e) => e.stopPropagation()} />
          {previewFiles.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prevPreview(); }} className="absolute left-3 rounded-full bg-black/50 p-3 text-white"><ChevronLeft size={28} /></button>
              <button onClick={(e) => { e.stopPropagation(); nextPreview(); }} className="absolute right-3 rounded-full bg-black/50 p-3 text-white"><ChevronRight size={28} /></button>
            </>
          )}
          <button onClick={closePreview} className="absolute left-4 top-4 rounded-full bg-black/50 p-3 text-white"><X size={22} /></button>
        </div>
      )}

      {documentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${themeSurface.panel(isDark)} flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden`}>
            <div className={`flex items-start justify-between gap-3 border-b px-4 py-4 ${themeBorder.divider(isDark)}`}>
              <div>
                <div className={`text-lg font-semibold ${themeText.title(isDark)}`}>{editingDocument ? "Редактирование документа" : "Новый документ"}</div>
                <div className={`text-xs ${themeText.secondary(isDark)}`}>Управление документом и его ответственными</div>
              </div>
              <button onClick={closeDocumentModal} className={`${themeText.secondary(isDark)} ${isDark ? "hover:text-white" : "hover:text-black"}`}><X size={18} /></button>
            </div>

            <div className="overflow-y-auto px-4 py-4">
              <form onSubmit={saveDocument} className="space-y-3">
                <input value={documentForm.name} onChange={(e) => setDocumentForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Название документа" className={modalInputClass} />
                <textarea value={documentForm.description} onChange={(e) => setDocumentForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Описание" rows={4} className={modalInputClass} />
                <input value={documentForm.location} onChange={(e) => setDocumentForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Место" className={modalInputClass} />
                <input type="number" min="0" value={documentForm.price} onChange={(e) => setDocumentForm((prev) => ({ ...prev, price: e.target.value }))} placeholder="Стоимость" className={modalInputClass} />

                <div>
                  <div className={`mb-2 text-xs ${themeText.primary(isDark)}`}>Дедлайн</div>
                  <div className="relative">
                    <Calendar size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
                    <input type="date" value={documentForm.deadline} onChange={(e) => setDocumentForm((prev) => ({ ...prev, deadline: e.target.value }))} className={inputClass} />
                  </div>
                </div>

                <div>
                  <div className={`mb-2 flex items-center gap-2 text-xs ${themeText.primary(isDark)}`}><Users size={14} />Ответственные</div>
                  <Select
                    isMulti
                    styles={getSelectStyles(isDark)}
                    menuPosition="fixed"
                    options={userOptions}
                    value={documentForm.responsible_users}
                    onChange={(value) => setDocumentForm((prev) => ({ ...prev, responsible_users: value || [] }))}
                    placeholder="Выберите пользователей"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeDocumentModal} className={subtleButtonClass}>Отмена</button>
                  <button type="submit" disabled={savingDocument} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                    {savingDocument ? "Сохранение..." : editingDocument ? "Сохранить" : "Создать"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {stageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 pb-24">
          <div className={`${themeSurface.panel(isDark)} -translate-y-8 w-full max-w-md p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${themeText.title(isDark)}`}>{editingStage ? "Редактирование этапа" : "Новый этап"}</div>
                <div className={`text-xs ${themeText.secondary(isDark)}`}>Этапы юр. документов внутри проекта</div>
              </div>
              <button onClick={closeStageModal} className={`${themeText.secondary(isDark)} ${isDark ? "hover:text-white" : "hover:text-black"}`}><X size={18} /></button>
            </div>

            <form onSubmit={saveStage} className="space-y-3">
              <input value={stageForm.name} onChange={(e) => setStageForm({ name: e.target.value })} placeholder="Название этапа" className={modalInputClass} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeStageModal} className={subtleButtonClass}>Отмена</button>
                <button type="submit" disabled={savingStage} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  {savingStage ? "Сохранение..." : editingStage ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AuditLogModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entity={historyEntity}
        entityId={historyId}
        fieldsMap={{ name: "Название", price: "Цена", deadline: "Дедлайн", status: "Статус", description: "Описание", location: "Место" }}
      />
    </div>
  );
}
