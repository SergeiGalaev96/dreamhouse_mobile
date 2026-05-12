import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pencil, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import PullToRefresh from "../components/PullToRefresh";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const EMPTY_ASSET_GROUPS = { "2d": [], "3d": [] };
const EMPTY_UNIT_FORM = {
  unit_number: "",
  lot_type: "apartment",
  rooms: "",
  area_total: "",
  price_total: "",
  currency: "KGS",
  status_id: "",
  description: ""
};

const LOT_TYPE_LABELS = {
  apartment: "Квартира",
  parking: "Паркинг",
  storage: "Кладовая",
  commercial: "Коммерция"
};

const isImageFile = (file) =>
  (file?.mime_type || "").startsWith("image/") ||
  /\.(png|jpe?g|webp|gif|svg)$/i.test(file?.name || "");

const getUnitFileKind = (file) => {
  const name = String(file?.name || "").toLowerCase();
  if (name.includes("3d") || name.includes("render")) return "3d";
  return "2d";
};

const formatEditableNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return String(numeric);
};

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-900 p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-gray-400">{subtitle}</div> : null}
          </div>
          <button onClick={onClose} className="rounded bg-gray-800 px-3 py-1 text-white hover:bg-gray-700">
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SalesUnitDetails() {
  const { projectId, blockId, floorId, unitId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [project, setProject] = useState(null);
  const [overview, setOverview] = useState(null);
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [filesSaving, setFilesSaving] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [unitFiles, setUnitFiles] = useState([]);
  const [activeTab, setActiveTab] = useState("2d");
  const [activeIndexByKind, setActiveIndexByKind] = useState({ "2d": 0, "3d": 0 });
  const [assetGroups, setAssetGroups] = useState(EMPTY_ASSET_GROUPS);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
  const objectUrlsRef = useRef([]);

  const pageClass = themeText.page(isDark);
  const titleClass = themeText.title(isDark);
  const secondaryTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-3`;
  const cardClass = `${themeSurface.card(isDark)} p-3`;
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const modalInputClass = themeControl.modalInput(isDark);

  const floors = overview?.floors || [];
  const selectedFloor = useMemo(
    () => floors.find((item) => Number(item.id) === Number(floorId)) || null,
    [floors, floorId]
  );
  const units = selectedFloor?.units || [];
  const unit = useMemo(
    () => units.find((item) => Number(item.id) === Number(unitId)) || null,
    [units, unitId]
  );

  const statusMap = useMemo(() => {
    const map = new Map();
    for (const item of unitStatuses) {
      map.set(Number(item.id), item);
    }
    return map;
  }, [unitStatuses]);

  const statusMeta = useMemo(() => {
    const status = statusMap.get(Number(unit?.status_id));
    const code = status?.code;
    if (code === "free") return { label: status?.name || "Свободно", chip: "border border-slate-300 bg-white text-slate-900" };
    if (code === "reserved") return { label: status?.name || "Бронь", chip: "border border-yellow-400 bg-yellow-300/85 text-slate-900" };
    if (code === "sold") return { label: status?.name || "Продано", chip: "border border-slate-500 bg-slate-400 text-white" };
    return { label: status?.name || "Без статуса", chip: "border border-slate-300 bg-slate-100 text-slate-700" };
  }, [statusMap, unit]);

  const currentAssets = assetGroups[activeTab] || [];
  const currentIndex = Math.min(activeIndexByKind[activeTab] || 0, Math.max(currentAssets.length - 1, 0));
  const currentAsset = currentAssets[currentIndex] || null;
  const currentTabLabel = activeTab === "3d" ? "3D план" : "2D план";

  const revokeAssetUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  };

  useEffect(() => () => revokeAssetUrls(), []);

  const formatMoney = (value, currency = "KGS") => {
    if (value === null || value === undefined || value === "") return "—";
    return `${Number(value).toLocaleString("ru-RU")} ${currency}`;
  };

  const formatArea = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    return `${Number(value).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    })} м²`;
  };

  const normalizeActiveIndexes = (groups) => {
    setActiveIndexByKind((prev) => ({
      "2d": Math.min(prev["2d"] || 0, Math.max((groups["2d"]?.length || 1) - 1, 0)),
      "3d": Math.min(prev["3d"] || 0, Math.max((groups["3d"]?.length || 1) - 1, 0))
    }));
  };

  const loadAssetsDocument = async (createIfMissing = false) => {
    const docsRes = await postRequest("/documents/search", {
      entity_type: "salesUnit",
      entity_id: Number(unitId),
      page: 1,
      size: 20
    });

    let doc = docsRes?.success && Array.isArray(docsRes.data) ? docsRes.data[0] || null : null;

    if (!doc && createIfMissing) {
      const createRes = await postRequest("/documents/create", {
        entity_type: "salesUnit",
        entity_id: Number(unitId),
        name: `Файлы лота №${unit?.unit_number || unitId}`,
        description: `Планы и визуализации квартиры ${unit?.unit_number || unitId}`,
        status: 1
      });

      if (!createRes?.success) {
        throw new Error(createRes?.message || "Не удалось создать документ для квартиры");
      }

      doc = createRes.data || null;
    }

    if (!doc) {
      setUnitFiles([]);
      return { doc: null, files: [] };
    }

    const filesRes = await getRequest(`/documentFiles/files/${doc.id}`);
    const files = filesRes?.success ? filesRes.data || [] : [];
    setUnitFiles(files);
    return { doc, files };
  };

  const loadAssets = async () => {
    if (!unitId) return;

    try {
      setAssetsLoading(true);
      const { files } = await loadAssetsDocument(false);
      const imageFiles = files.filter(isImageFile);

      revokeAssetUrls();

      const groups = { "2d": [], "3d": [] };
      for (const file of imageFiles) {
        const res = await api.get(`/documentFiles/download/${file.id}`, {
          responseType: "blob"
        });
        const url = URL.createObjectURL(res.data);
        objectUrlsRef.current.push(url);
        groups[getUnitFileKind(file)].push({ file, url });
      }

      setAssetGroups(groups);
      normalizeActiveIndexes(groups);

      if (!groups[activeTab]?.length) {
        setActiveTab(groups["2d"].length ? "2d" : groups["3d"].length ? "3d" : "2d");
      }
    } catch (error) {
      console.error("SalesUnitDetails load assets error", error);
      setAssetGroups(EMPTY_ASSET_GROUPS);
      setActiveIndexByKind({ "2d": 0, "3d": 0 });
    } finally {
      setAssetsLoading(false);
    }
  };

  const loadPage = async () => {
    try {
      setLoading(true);
      const [projectRes, overviewRes, statusesRes] = await Promise.all([
        getRequest(`/projects/getById/${projectId}`),
        getRequest(`/sales/blocks/${blockId}/overview`),
        getRequest("/sales/unit-statuses")
      ]);

      if (projectRes?.success) setProject(projectRes.data || null);
      if (overviewRes?.success) setOverview(overviewRes.data || null);
      if (statusesRes?.success) setUnitStatuses(statusesRes.data || []);
    } catch (error) {
      console.error("SalesUnitDetails load error", error);
      toast.error(error?.response?.data?.message || "Не удалось загрузить квартиру");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [projectId, blockId]);

  useEffect(() => {
    loadAssets();
  }, [unitId, unit?.unit_number]);

  const handleRefresh = async () => {
    await loadPage();
    await loadAssets();
  };

  const openAssetsManager = async () => {
    try {
      await loadAssetsDocument(true);
      setAssetsModalOpen(true);
    } catch (error) {
      console.error("SalesUnitDetails open assets manager error", error);
      toast.error(error?.message || "Не удалось открыть файлы квартиры");
    }
  };

  const openEditModal = () => {
    setUnitForm({
      unit_number: unit?.unit_number ? String(unit.unit_number) : "",
      lot_type: unit?.lot_type || "apartment",
      rooms: unit?.rooms === null || unit?.rooms === undefined ? "" : String(unit.rooms),
      area_total: formatEditableNumber(unit?.area_total),
      price_total: formatEditableNumber(unit?.price_total),
      currency: unit?.currency || "KGS",
      status_id: unit?.status_id ? String(unit.status_id) : "",
      description: unit?.description || ""
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setUnitForm(EMPTY_UNIT_FORM);
  };

  const saveUnit = async (event) => {
    event.preventDefault();
    if (!unit?.id) return;

    try {
      setFilesSaving(true);

      const payload = {
        unit_number: unitForm.unit_number.trim(),
        lot_type: unitForm.lot_type,
        rooms: unitForm.rooms === "" ? null : Number(unitForm.rooms),
        area_total: unitForm.area_total === "" ? null : Number(unitForm.area_total),
        price_total: unitForm.price_total === "" ? null : Number(unitForm.price_total),
        currency: unitForm.currency.trim() || "KGS",
        status_id: unitForm.status_id ? Number(unitForm.status_id) : null,
        description: unitForm.description.trim() || null
      };

      const res = await putRequest(`/sales/units/update/${unit.id}`, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Не удалось обновить квартиру");
      }

      toast.success("Данные квартиры обновлены");
      closeEditModal();
      await loadPage();
    } catch (error) {
      console.error("SalesUnitDetails save unit error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка сохранения квартиры");
    } finally {
      setFilesSaving(false);
    }
  };

  const handleUploadAsset = async (kind, event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const invalidFile = files.find((file) => !isImageFile(file));
      if (invalidFile) {
        throw new Error("Можно загрузить только изображения или SVG");
      }

      setFilesSaving(true);
      const { doc } = await loadAssetsDocument(true);
      if (!doc?.id) {
        throw new Error("Документ квартиры не создан");
      }

      const formData = new FormData();
      files.forEach((file, index) => {
        const originalName = file.name || `${kind}-${index + 1}.png`;
        const extensionMatch = originalName.match(/\.[^.]+$/);
        const extension = extensionMatch?.[0] || ".png";
        const renamed = new File([file], `${kind}-${Date.now()}-${index + 1}${extension}`, { type: file.type });
        formData.append("files", renamed);
      });

      const uploadRes = await api.post(`/documentFiles/upload/${doc.id}`, formData);
      if (!uploadRes.data?.success || !uploadRes.data?.uploaded) {
        throw new Error(uploadRes.data?.message || "Не удалось загрузить файлы");
      }

      toast.success(kind === "3d" ? "3D изображения загружены" : "2D изображения загружены");
      await loadAssets();
      if (assetsModalOpen) {
        await loadAssetsDocument(false);
      }
      setActiveTab(kind);
      setActiveIndexByKind((prev) => ({ ...prev, [kind]: 0 }));
    } catch (error) {
      console.error("SalesUnitDetails upload asset error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки файлов");
    } finally {
      setFilesSaving(false);
      event.target.value = null;
    }
  };

  const handleDeleteAsset = async (fileId) => {
    if (!window.confirm("Удалить файл квартиры?")) return;

    try {
      const res = await deleteRequest(`/documentFiles/${fileId}`);
      if (!res?.success) {
        throw new Error(res?.message || "Не удалось удалить файл");
      }

      toast.success("Файл удален");
      await loadAssets();
      if (assetsModalOpen) {
        await loadAssetsDocument(false);
      }
    } catch (error) {
      console.error("SalesUnitDetails delete asset error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка удаления файла");
    }
  };

  const handleDownloadAsset = async (file) => {
    try {
      const res = await api.get(`/documentFiles/download/${file.id}`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name || `asset-${file.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("SalesUnitDetails download asset error", error);
      toast.error("Не удалось скачать файл");
    }
  };

  if (!unit && !loading) {
    return (
      <div className={`min-h-full ${pageClass}`}>
        <div className="p-4">
          <button onClick={() => navigate(`/projects/${projectId}/sales/blocks/${blockId}/floors/${floorId}`)} className={subtleButtonClass}>
            Назад
          </button>
          <div className={`${panelClass} mt-4 text-sm ${secondaryTextClass}`}>Лот не найден</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full ${pageClass}`}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl font-semibold ${titleClass}`}>Квартира №{unit?.unit_number || "—"}</h1>
            <div className={`text-sm ${secondaryTextClass}`}>
              {project?.name || "Объект"} • {overview?.block?.name || "Блок"} • {selectedFloor?.floor_number || "—"} этаж
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/projects/${projectId}/sales/blocks/${blockId}/floors/${floorId}`)}
              className={subtleButtonClass}
            >
              Назад
            </button>
          </div>
        </div>

        <div className={`${panelClass} relative mb-3`}>
          <button
            type="button"
            onClick={openEditModal}
            className={`absolute right-3 top-3 inline-flex shrink-0 items-center justify-center ${themeControl.actionTilePadded(isDark)}`}
            aria-label="Изменить"
            title="Изменить"
          >
            <Pencil size={14} />
          </button>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-12">
            <div className={`rounded-full px-2.5 py-1 text-xs ${statusMeta.chip}`}>{statusMeta.label}</div>
            <div className={`rounded-full border border-gray-700 px-2.5 py-1 text-xs ${secondaryTextClass}`}>
              {LOT_TYPE_LABELS[unit?.lot_type] || "Квартира"}
            </div>
            <div className={`rounded-full border border-gray-700 px-2.5 py-1 text-xs ${secondaryTextClass}`}>{formatArea(unit?.area_total)}</div>
            <div className={`rounded-full border border-gray-700 px-2.5 py-1 text-xs ${secondaryTextClass}`}>
              {unit?.rooms || "—"} ком
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("2d")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm sm:flex-none ${activeTab === "2d" ? "bg-amber-400 text-slate-900" : "bg-gray-800 text-white"}`}
            >
              2D План
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("3d")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm sm:flex-none ${activeTab === "3d" ? "bg-amber-400 text-slate-900" : "bg-gray-800 text-white"}`}
            >
              3D План
            </button>
            <button type="button" onClick={openAssetsManager} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white sm:flex-none">
              Файлы
            </button>
          </div>
        </div>

        <div className="space-y-4 xl:grid xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start xl:gap-4 xl:space-y-0">
          <div className="mx-[-8px] bg-[#f8f5ef] px-1 py-1 sm:mx-0 sm:px-2 sm:py-2">
            <div className="min-h-[620px] bg-[#fcfbf7] p-2 sm:p-4">
              {assetsLoading ? (
                <div className="flex min-h-[68vh] items-center justify-center text-sm text-slate-500">
                  Загружаем {currentTabLabel.toLowerCase()}...
                </div>
              ) : currentAsset ? (
                <div className="space-y-4">
                  <div className="flex min-h-[68vh] items-center justify-center">
                    <img
                      src={currentAsset.url}
                      alt={currentAsset.file.name || currentTabLabel}
                      className="max-h-[82vh] w-auto max-w-full object-contain"
                    />
                  </div>

                  {currentAssets.length > 1 ? (
                    <div className="overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        {currentAssets.map((asset, index) => (
                          <button
                            key={asset.file.id}
                            type="button"
                            onClick={() => setActiveIndexByKind((prev) => ({ ...prev, [activeTab]: index }))}
                            className={`overflow-hidden rounded-lg border ${
                              index === currentIndex ? "border-blue-500" : "border-stone-300"
                            } bg-white`}
                          >
                            <img src={asset.url} alt={asset.file.name || `${currentTabLabel} ${index + 1}`} className="h-24 w-28 object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-[68vh] items-center justify-center text-center">
                  <div className="max-w-sm space-y-3 text-slate-500">
                    <div className="text-lg font-semibold text-slate-700">{currentTabLabel} пока не загружен</div>
                    <div className="text-sm">
                      Нажмите «Файлы» и добавьте {activeTab === "3d" ? "рендеры или 3D изображения" : "2D изображения квартиры"} для этого лота.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`${panelClass} space-y-3 xl:sticky xl:top-4 xl:self-start`}>
            <div className="grid grid-cols-2 gap-2">
              <div className={cardClass}>
                <div className={`text-xs ${mutedTextClass}`}>Этаж</div>
                <div className="mt-1 text-lg font-semibold">{selectedFloor?.floor_number || "—"}</div>
              </div>
              <div className={cardClass}>
                <div className={`text-xs ${mutedTextClass}`}>Комнат</div>
                <div className="mt-1 text-lg font-semibold">{unit?.rooms || "—"}</div>
              </div>
              <div className={cardClass}>
                <div className={`text-xs ${mutedTextClass}`}>Площадь</div>
                <div className="mt-1 text-lg font-semibold">{formatArea(unit?.area_total)}</div>
              </div>
              <div className={cardClass}>
                <div className={`text-xs ${mutedTextClass}`}>Цена</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(unit?.price_total, unit?.currency || "KGS")}</div>
              </div>
            </div>

            <div className={cardClass}>
              <div className={`text-xs ${mutedTextClass}`}>Код квартиры</div>
              <div className="mt-1 break-all text-sm">{unit?.plan_code || unit?.external_code || "—"}</div>
            </div>

            <div className={cardClass}>
              <div className={`text-xs ${mutedTextClass}`}>Комментарий</div>
              <div className="mt-1 text-sm">{unit?.description || "Пока без комментария"}</div>
            </div>
          </div>
        </div>
      </PullToRefresh>

      {assetsModalOpen ? (
        <Modal
          title="Файлы квартиры"
          subtitle={`Лот №${unit?.unit_number || "—"} • ${overview?.block?.name || "Блок"}`}
          onClose={() => setAssetsModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500">
                <Upload size={16} />
                <span>{filesSaving ? "Загрузка..." : "Загрузить 2D"}</span>
                <input
                  type="file"
                  accept="image/*,.svg,image/svg+xml"
                  multiple
                  className="hidden"
                  onChange={(event) => handleUploadAsset("2d", event)}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-500">
                <Upload size={16} />
                <span>{filesSaving ? "Загрузка..." : "Загрузить 3D"}</span>
                <input
                  type="file"
                  accept="image/*,.svg,image/svg+xml"
                  multiple
                  className="hidden"
                  onChange={(event) => handleUploadAsset("3d", event)}
                />
              </label>
            </div>

            <div className="space-y-[6px]">
              {unitFiles.length ? (
                unitFiles.map((file) => {
                  const kind = getUnitFileKind(file);
                  return (
                    <div key={file.id} className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{file.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span className="rounded-full border border-gray-700 px-2 py-0.5">{kind === "3d" ? "3D" : "2D"}</span>
                            <span>{file.mime_type || "файл"}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadAsset(file)}
                            className="rounded-lg bg-gray-800 p-2 text-white hover:bg-gray-700"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAsset(file.id)}
                            className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 px-4 py-6 text-center text-sm text-gray-400">
                  Для этой квартиры пока не загружено ни одного файла
                </div>
              )}
            </div>
          </div>
        </Modal>
      ) : null}

      {editModalOpen ? (
        <Modal
          title="Редактировать квартиру"
          subtitle={`Лот №${unit?.unit_number || "—"} • ${overview?.block?.name || "Блок"}`}
          onClose={closeEditModal}
        >
          <form onSubmit={saveUnit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Номер лота</div>
                <input
                  value={unitForm.unit_number}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, unit_number: e.target.value }))}
                  className={modalInputClass}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Тип</div>
                <select
                  value={unitForm.lot_type}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, lot_type: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="apartment">Квартира</option>
                  <option value="parking">Паркинг</option>
                  <option value="storage">Кладовая</option>
                  <option value="commercial">Коммерция</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Комнат</div>
                <input
                  value={unitForm.rooms}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, rooms: e.target.value }))}
                  className={modalInputClass}
                  inputMode="numeric"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Статус</div>
                <select
                  value={unitForm.status_id}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, status_id: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="">Без статуса</option>
                  {unitStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Площадь</div>
                <input
                  value={unitForm.area_total}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, area_total: e.target.value }))}
                  className={modalInputClass}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Цена</div>
                <input
                  value={unitForm.price_total}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, price_total: e.target.value }))}
                  className={modalInputClass}
                  inputMode="decimal"
                />
              </label>
            </div>

            <label className="block">
              <div className="mb-1 text-xs text-gray-400">Валюта</div>
              <input
                value={unitForm.currency}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, currency: e.target.value }))}
                className={modalInputClass}
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs text-gray-400">Комментарий</div>
              <textarea
                value={unitForm.description}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, description: e.target.value }))}
                className={`${modalInputClass} min-h-[110px] resize-none`}
              />
            </label>

            <button
              type="submit"
              disabled={filesSaving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {filesSaving ? "Сохраняем..." : "Сохранить изменения"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
