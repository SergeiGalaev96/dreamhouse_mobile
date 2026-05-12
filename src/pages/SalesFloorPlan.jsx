import { useEffect, useMemo, useState } from "react";
import { Download, Grid3X3, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import PullToRefresh from "../components/PullToRefresh";
import { deleteRequest, getRequest, postRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

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

const LOT_TYPE_CODE_MAP = {
  apartment: "FLA",
  parking: "PAR",
  storage: "STO",
  commercial: "KOM"
};

const CYRILLIC_BLOCK_MAP = {
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D"
};

const isSvgFile = (file) =>
  file?.mime_type === "image/svg+xml" || /\.svg$/i.test(file?.name || "");

const buildBlockCode = (blockName) => {
  const value = String(blockName || "").trim();
  const lastToken = value.split(/\s+/).filter(Boolean).at(-1) || "X";
  return CYRILLIC_BLOCK_MAP[lastToken.toUpperCase()] || lastToken.toUpperCase().replace(/[^A-Z0-9]/g, "") || "X";
};

const padCode = (value, width) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "".padStart(width, "0");
  if (/^\d+$/.test(normalized)) return normalized.padStart(width, "0");
  return normalized.toUpperCase();
};

const buildUnitCode = ({ lotType, blockName, floorNumber, unitNumber }) => {
  if (!blockName || !floorNumber || !String(unitNumber || "").trim()) {
    return "Будет создан автоматически";
  }

  return [
    LOT_TYPE_CODE_MAP[String(lotType || "").toLowerCase()] || "FLA",
    buildBlockCode(blockName),
    padCode(floorNumber, 2),
    padCode(unitNumber, 3)
  ].join("-");
};

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-4 text-white shadow-2xl">
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

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-gray-400">{label}</div>
      {children}
    </label>
  );
}

export default function SalesFloorPlan() {
  const { projectId, blockId, floorId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [project, setProject] = useState(null);
  const [overview, setOverview] = useState(null);
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [selectedFloorId, setSelectedFloorId] = useState(Number(floorId));
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [loadingFloorPlan, setLoadingFloorPlan] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
  const [floorPlanSvgRaw, setFloorPlanSvgRaw] = useState("");
  const [planManagerOpen, setPlanManagerOpen] = useState(false);
  const [planFilesSaving, setPlanFilesSaving] = useState(false);
  const [planFilesLoading, setPlanFilesLoading] = useState(false);
  const [floorPlanFiles, setFloorPlanFiles] = useState([]);

  const pageClass = themeText.page(isDark);
  const titleClass = themeText.title(isDark);
  const secondaryTextClass = themeText.secondary(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const modalInputClass = themeControl.modalInput(isDark);

  const floors = overview?.floors || [];
  const selectedFloor = useMemo(
    () => floors.find((item) => Number(item.id) === Number(selectedFloorId)) || floors[0] || null,
    [floors, selectedFloorId]
  );
  const units = selectedFloor?.units || [];

  const statusMap = useMemo(() => {
    const map = new Map();
    for (const item of unitStatuses) {
      map.set(Number(item.id), item);
    }
    return map;
  }, [unitStatuses]);

  const unitCodePreview = useMemo(
    () =>
      buildUnitCode({
        lotType: unitForm.lot_type,
        blockName: overview?.block?.name,
        floorNumber: selectedFloor?.floor_number,
        unitNumber: unitForm.unit_number
      }),
    [unitForm.lot_type, unitForm.unit_number, overview?.block?.name, selectedFloor?.floor_number]
  );

  useEffect(() => {
    setSelectedFloorId(Number(floorId));
  }, [floorId]);

  useEffect(() => {
    if (!units.length) {
      setSelectedUnitId(null);
      return;
    }

    setSelectedUnitId((prev) => (units.some((item) => Number(item.id) === Number(prev)) ? prev : units[0].id));
  }, [units]);

  const getStatusMeta = (unit) => {
    const status = statusMap.get(Number(unit?.status_id));
    const code = status?.code;

    if (code === "free") {
      return {
        label: status?.name || "Свободно",
        svgFill: "rgba(255,255,255,0.98)",
        svgStroke: "#3f3f46"
      };
    }

    if (code === "reserved") {
      return {
        label: status?.name || "Бронь",
        svgFill: "rgba(250,204,21,0.72)",
        svgStroke: "#ca8a04"
      };
    }

    if (code === "sold") {
      return {
        label: status?.name || "Продано",
        svgFill: "rgba(163,163,163,0.86)",
        svgStroke: "#52525b"
      };
    }

    return {
      label: status?.name || "Без статуса",
      svgFill: "rgba(241,245,249,0.95)",
      svgStroke: "#94a3b8"
    };
  };

  const renderedFloorPlanSvg = useMemo(() => {
    if (!floorPlanSvgRaw || typeof DOMParser === "undefined") return "";

    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(floorPlanSvgRaw, "image/svg+xml");
      const svg = xml.querySelector("svg");
      if (!svg) return "";

      svg.setAttribute("data-sales-floor-plan", "true");
      svg.setAttribute("preserveAspectRatio", svg.getAttribute("preserveAspectRatio") || "xMidYMid meet");
      svg.setAttribute("width", svg.getAttribute("width") || "1180");
      svg.setAttribute("height", svg.getAttribute("height") || "760");

      const style = xml.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = `
        [data-sales-floor-unit="true"] { cursor: pointer; transition: opacity .2s ease; }
        [data-sales-floor-unit="true"]:hover { opacity: .92; }
      `;
      svg.insertBefore(style, svg.firstChild);

      units.forEach((unit) => {
        const keys = [unit.plan_code, unit.external_code, unit.unit_number]
          .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
          .filter(Boolean);

        let root = null;
        for (const key of keys) {
          root = xml.getElementById(key);
          if (root) break;
        }
        if (!root) return;

        const meta = getStatusMeta(unit);
        const isActive = Number(unit.id) === Number(selectedUnitId);

        root.setAttribute("data-sales-floor-unit", "true");
        root.setAttribute("data-unit-id", String(unit.id));

        const shapeSelector = "path, polygon, rect, polyline, ellipse, circle";
        const shapes = root.matches?.(shapeSelector) ? [root] : Array.from(root.querySelectorAll(shapeSelector));
        const targets = shapes.length ? shapes : [root];

        targets.forEach((shape) => {
          const currentStrokeWidth = shape.getAttribute("stroke-width") || "2";
          shape.setAttribute("fill", meta.svgFill);
          shape.setAttribute("stroke", isActive ? "#2563eb" : meta.svgStroke);
          shape.setAttribute("stroke-width", isActive ? "4" : currentStrokeWidth);
          shape.setAttribute("vector-effect", "non-scaling-stroke");
        });
      });

      return new XMLSerializer().serializeToString(svg);
    } catch (error) {
      console.error("SalesFloorPlan svg render error", error);
      return "";
    }
  }, [floorPlanSvgRaw, units, selectedUnitId, unitStatuses]);

  const loadPage = async () => {
    try {
      const [projectRes, overviewRes, unitStatusesRes] = await Promise.all([
        getRequest(`/projects/getById/${projectId}`),
        getRequest(`/sales/blocks/${blockId}/overview`),
        getRequest("/sales/unit-statuses")
      ]);

      if (projectRes?.success) setProject(projectRes.data || null);
      if (overviewRes?.success) setOverview(overviewRes.data || null);
      if (unitStatusesRes?.success) setUnitStatuses(unitStatusesRes.data || []);
    } catch (error) {
      console.error("SalesFloorPlan load error", error);
      toast.error(error?.response?.data?.message || "Не удалось загрузить планировку этажа");
    }
  };

  const loadFloorPlanDocument = async (targetFloorId, { createIfMissing = false } = {}) => {
    const docsRes = await postRequest("/documents/search", {
      entity_type: "salesFloorPlan",
      entity_id: Number(targetFloorId),
      page: 1,
      size: 20
    });

    let doc = docsRes?.success && Array.isArray(docsRes.data) ? docsRes.data[0] || null : null;

    if (!doc && createIfMissing) {
      const createRes = await postRequest("/documents/create", {
        entity_type: "salesFloorPlan",
        entity_id: Number(targetFloorId),
        name: `План этажа ${selectedFloor?.floor_number || ""}`.trim(),
        description: `SVG-план этажа для ${overview?.block?.name || "блока"}`,
        status: 1
      });

      if (!createRes?.success) {
        throw new Error(createRes?.message || "Не удалось создать документ плана");
      }

      doc = createRes.data || null;
    }

    if (!doc) {
      setFloorPlanFiles([]);
      return { doc: null, files: [] };
    }

    const filesRes = await getRequest(`/documentFiles/files/${doc.id}`);
    const files = filesRes?.success ? filesRes.data || [] : [];
    setFloorPlanFiles(files);
    return { doc, files };
  };

  const loadFloorPlanAssets = async (targetFloorId) => {
    if (!targetFloorId) {
      setFloorPlanFiles([]);
      setFloorPlanSvgRaw("");
      return;
    }

    try {
      setLoadingFloorPlan(true);
      const { files } = await loadFloorPlanDocument(targetFloorId, { createIfMissing: false });
      const svgFile = files.find(isSvgFile);

      if (!svgFile) {
        setFloorPlanSvgRaw("");
        return;
      }

      const svgRes = await api.get(`/documentFiles/download/${svgFile.id}`, {
        responseType: "text",
        transformResponse: [(data) => data]
      });

      setFloorPlanSvgRaw(typeof svgRes.data === "string" && svgRes.data.includes("<svg") ? svgRes.data : "");
    } catch (error) {
      console.error("SalesFloorPlan load assets error", error);
      setFloorPlanSvgRaw("");
    } finally {
      setLoadingFloorPlan(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [projectId, blockId]);

  useEffect(() => {
    loadFloorPlanAssets(selectedFloorId);
  }, [selectedFloorId]);

  const handleRefresh = async () => {
    await loadPage();
    await loadFloorPlanAssets(selectedFloorId);
  };

  const formatArea = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    return `${Number(value).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    })} м²`;
  };

  const openPlanManager = async () => {
    if (!selectedFloor?.id) {
      toast.error("Сначала выберите этаж");
      return;
    }

    try {
      setPlanFilesLoading(true);
      await loadFloorPlanDocument(selectedFloor.id, { createIfMissing: true });
      setPlanManagerOpen(true);
    } catch (error) {
      console.error("SalesFloorPlan open manager error", error);
      toast.error(error?.message || "Не удалось открыть планы этажа");
    } finally {
      setPlanFilesLoading(false);
    }
  };

  const handleUploadPlan = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !selectedFloor?.id) return;

    try {
      const [file] = files;
      if (!isSvgFile(file)) {
        throw new Error("Допускается только SVG-файл плана этажа");
      }

      setPlanFilesSaving(true);
      const { doc, files: existingFiles } = await loadFloorPlanDocument(selectedFloor.id, { createIfMissing: true });
      if (!doc?.id) {
        throw new Error("Документ этажа не создан");
      }

      for (const existingFile of existingFiles) {
        const deleteRes = await deleteRequest(`/documentFiles/${existingFile.id}`);
        if (!deleteRes?.success) {
          throw new Error(deleteRes?.message || "Не удалось заменить старый SVG-план");
        }
      }

      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await api.post(`/documentFiles/upload/${doc.id}`, formData);
      if (!uploadRes.data?.success || !uploadRes.data?.uploaded) {
        throw new Error(uploadRes.data?.message || "Не удалось загрузить файл плана");
      }

      toast.success("SVG-план загружен");
      await loadFloorPlanAssets(selectedFloor.id);
      if (planManagerOpen) {
        await loadFloorPlanDocument(selectedFloor.id, { createIfMissing: false });
      }
    } catch (error) {
      console.error("SalesFloorPlan upload error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки SVG");
    } finally {
      setPlanFilesSaving(false);
      event.target.value = null;
    }
  };

  const handleDeletePlanFile = async (fileId) => {
    if (!window.confirm("Удалить SVG-план этажа?")) return;

    try {
      const res = await deleteRequest(`/documentFiles/${fileId}`);
      if (!res?.success) {
        throw new Error(res?.message || "Не удалось удалить файл");
      }

      toast.success("План удален");
      await loadFloorPlanAssets(selectedFloor.id);
      if (planManagerOpen) {
        await loadFloorPlanDocument(selectedFloor.id, { createIfMissing: false });
      }
    } catch (error) {
      console.error("SalesFloorPlan delete file error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка удаления файла");
    }
  };

  const handleDownloadPlanFile = async (file) => {
    try {
      const res = await api.get(`/documentFiles/download/${file.id}`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name || `floor-plan-${file.id}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("SalesFloorPlan download file error", error);
      toast.error("Не удалось скачать SVG");
    }
  };

  const openCreateUnit = () => {
    if (!selectedFloor?.id) {
      toast.error("Сначала выберите этаж");
      return;
    }

    setUnitForm({
      ...EMPTY_UNIT_FORM,
      status_id: unitStatuses[0]?.id ? String(unitStatuses[0].id) : ""
    });
    setUnitModalOpen(true);
  };

  const closeUnitModal = () => {
    setUnitForm(EMPTY_UNIT_FORM);
    setUnitModalOpen(false);
  };

  const saveUnit = async (event) => {
    event.preventDefault();
    if (!selectedFloor?.id) return;

    try {
      setSaving(true);

      const payload = {
        project_id: Number(projectId),
        block_id: Number(blockId),
        floor_id: Number(selectedFloor.id),
        unit_number: unitForm.unit_number.trim(),
        lot_type: unitForm.lot_type,
        rooms: unitForm.rooms === "" ? null : Number(unitForm.rooms),
        area_total: unitForm.area_total === "" ? null : Number(unitForm.area_total),
        price_total: unitForm.price_total === "" ? null : Number(unitForm.price_total),
        currency: unitForm.currency.trim() || "KGS",
        status_id: unitForm.status_id ? Number(unitForm.status_id) : null,
        description: unitForm.description.trim() || null
      };

      const res = await postRequest("/sales/units/create", payload);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать лот");
        return;
      }

      toast.success("Лот создан");
      closeUnitModal();
      await loadPage();
    } catch (error) {
      console.error("SalesFloorPlan save unit error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения лота");
    } finally {
      setSaving(false);
    }
  };

  const handleFloorSelect = (nextFloorId) => {
    setSelectedFloorId(Number(nextFloorId));
    navigate(`/projects/${projectId}/sales/blocks/${blockId}/floors/${nextFloorId}`);
  };

  const openUnitDetails = (unit) => {
    if (!unit?.id) return;
    setSelectedUnitId(unit.id);
    navigate(`/projects/${projectId}/sales/blocks/${blockId}/floors/${selectedFloorId}/units/${unit.id}`);
  };

  const handleExternalSvgClick = (event) => {
    const unitNode = event.target?.closest?.("[data-unit-id]");
    if (!unitNode) return;
    const unitId = Number(unitNode.getAttribute("data-unit-id"));
    const unit = units.find((item) => Number(item.id) === Number(unitId));
    if (unit) openUnitDetails(unit);
  };

  return (
    <div className={`min-h-full ${pageClass}`}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl font-semibold ${titleClass}`}>Планировка этажа</h1>
            <div className={`text-sm ${secondaryTextClass}`}>
              {project?.name || "Объект"} • {overview?.block?.name || "Блок"} • {selectedFloor?.floor_number || "—"} этаж
            </div>
          </div>
          <button onClick={() => navigate(`/projects/${projectId}/sales`)} className={subtleButtonClass}>
            Назад
          </button>
        </div>

        <div className={`${panelClass} mb-4 space-y-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedFloorId || ""} onChange={(e) => handleFloorSelect(e.target.value)} className={modalInputClass}>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.floor_number} этаж
                </option>
              ))}
            </select>

            <div className="ml-auto flex gap-2">
              <button
                onClick={openPlanManager}
                disabled={planFilesLoading}
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-white disabled:opacity-60"
              >
                <div className="flex items-center gap-1">
                  <Upload size={14} />
                  <span>Планы</span>
                </div>
              </button>
              <button onClick={openCreateUnit} className="rounded-lg bg-green-600 px-3 py-2 text-xs text-white">
                <div className="flex items-center gap-1">
                  <Plus size={14} />
                  <span>Лот</span>
                </div>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => openUnitDetails(unit)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    Number(selectedUnitId) === Number(unit.id)
                      ? "border-white bg-white/15 text-white"
                      : "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {formatArea(unit.area_total)} №{unit.unit_number}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="relative bg-[#f8f5ef] p-1 text-slate-900 sm:p-2">
            <div className="min-h-[620px]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Grid3X3 size={16} />
                  <span>Нажмите на квартиру на плане или в верхней ленте</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-300 bg-white/85 px-4 py-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-slate-400 bg-white" />
                    <span>Свободно</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-slate-400 bg-slate-400" />
                    <span>Продано</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-yellow-500 bg-yellow-300" />
                    <span>Бронь</span>
                  </div>
                </div>
              </div>

              <div className="overflow-auto pb-2">
                {loadingFloorPlan ? (
                  <div className="mx-auto flex min-h-[780px] min-w-[1180px] items-center justify-center bg-[#fcfbf7] p-2 text-sm text-slate-500">
                    Загружаем план этажа...
                  </div>
                ) : renderedFloorPlanSvg ? (
                  <div className="mx-auto min-h-[780px] min-w-[1180px] bg-[#fcfbf7] p-1">
                    <div className="mx-auto w-fit" onClick={handleExternalSvgClick} dangerouslySetInnerHTML={{ __html: renderedFloorPlanSvg }} />
                  </div>
                ) : (
                  <div className="mx-auto flex min-h-[780px] min-w-[1180px] items-center justify-center border border-dashed border-stone-300 bg-[#fcfbf7] p-2 text-center">
                    <div className="max-w-md space-y-3 text-slate-500">
                      <div className="text-lg font-semibold text-slate-700">Для этого этажа пока не загружен реальный SVG-план</div>
                      <div className="text-sm">
                        Откройте раздел «Планы» и загрузите SVG-файл этажа. После этого квартиры станут кликабельными и будут окрашиваться по статусам.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PullToRefresh>

      {planManagerOpen && (
        <Modal title="Планы этажа" subtitle={`${overview?.block?.name || "Блок"} • ${selectedFloor?.floor_number || "—"} этаж`} onClose={() => setPlanManagerOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3 text-sm text-gray-300">
              У зон в SVG должен быть <span className="font-semibold text-white">id</span>, совпадающий с{" "}
              <span className="font-semibold text-white">кодом квартиры</span>. На этаж загружается только один актуальный SVG-план, новый файл заменяет старый.
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500">
              <Upload size={16} />
              <span>{planFilesSaving ? "Загрузка..." : "Загрузить SVG"}</span>
              <input type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleUploadPlan} />
            </label>

            <div className="space-y-[6px]">
              {floorPlanFiles.length ? (
                floorPlanFiles.map((file) => (
                  <div key={file.id} className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{file.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          <span className="rounded-full border border-gray-700 px-2 py-0.5">SVG</span>
                          <span>{file.mime_type || "файл"}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => handleDownloadPlanFile(file)} className="rounded-lg bg-gray-800 p-2 text-white hover:bg-gray-700">
                          <Download size={14} />
                        </button>
                        <button type="button" onClick={() => handleDeletePlanFile(file.id)} className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 px-4 py-6 text-center text-sm text-gray-400">
                  Для этого этажа пока не загружен SVG-план
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {unitModalOpen && (
        <Modal title="Новый лот" subtitle={`${overview?.block?.name || "Блок"} • ${selectedFloor?.floor_number || "—"} этаж`} onClose={closeUnitModal}>
          <form onSubmit={saveUnit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Этаж">
                <input value={`${selectedFloor?.floor_number || "—"} этаж`} className={modalInputClass} disabled />
              </Field>
              <Field label="Тип">
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
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Номер лота">
                <input value={unitForm.unit_number} onChange={(e) => setUnitForm((prev) => ({ ...prev, unit_number: e.target.value }))} className={modalInputClass} placeholder="001" />
              </Field>
              <Field label="Статус">
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
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Комнат">
                <input value={unitForm.rooms} onChange={(e) => setUnitForm((prev) => ({ ...prev, rooms: e.target.value }))} className={modalInputClass} inputMode="numeric" />
              </Field>
              <Field label="Площадь">
                <input value={unitForm.area_total} onChange={(e) => setUnitForm((prev) => ({ ...prev, area_total: e.target.value }))} className={modalInputClass} inputMode="decimal" />
              </Field>
              <Field label="Валюта">
                <input value={unitForm.currency} onChange={(e) => setUnitForm((prev) => ({ ...prev, currency: e.target.value }))} className={modalInputClass} />
              </Field>
            </div>

            <Field label="Цена">
              <input value={unitForm.price_total} onChange={(e) => setUnitForm((prev) => ({ ...prev, price_total: e.target.value }))} className={modalInputClass} inputMode="decimal" />
            </Field>

            <Field label="Код квартиры">
              <input value={unitCodePreview} className={modalInputClass} disabled />
            </Field>

            <Field label="Комментарий">
              <textarea
                value={unitForm.description}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, description: e.target.value }))}
                className={`${modalInputClass} min-h-[110px] resize-none`}
              />
            </Field>

            <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60">
              {saving ? "Сохраняем..." : "Создать лот"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
