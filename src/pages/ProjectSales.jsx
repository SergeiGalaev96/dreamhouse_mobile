import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Download, FileText, Grid3X3, KeyRound, ListChecks, Phone, Pencil, Plus, Search, Trash2, Upload, UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";
import api from "../api/axios";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatEditableNumber, normalizeDecimalInput, toNullableNumber } from "../utils/numberInput";
import { useTheme } from "../context/ThemeContext";
import { formatDateTime } from "../utils/date";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const EMPTY_FLOOR_FORM = {
  floor_number: "",
  name: "",
  sort_order: ""
};

const EMPTY_UNIT_FORM = {
  floor_id: "",
  unit_number: "",
  lot_type: "apartment",
  rooms: "",
  area_total: "",
  price_total: "",
  currency: "",
  status_id: "",
  plan_code: "",
  external_code: "",
  description: ""
};

const EMPTY_LEAD_FORM = {
  full_name: "",
  phone: "",
  email: "",
  inn: "",
  status_id: "",
  source_id: "",
  comment: "",
  interest_rooms: "",
  interest_budget_from: "",
  interest_budget_to: ""
};

const EMPTY_CLIENT_FORM = {
  last_name: "",
  first_name: "",
  middle_name: "",
  phone: "",
  phone_extra: "",
  email: "",
  passport_number: "",
  pin: "",
  address: "",
  comment: "",
  block_id: "",
  floor_id: "",
  unit_id: ""
};

const EMPTY_UNIT_CLIENT_FORM = {
  client_id: "",
  deal_type_id: "",
  last_name: "",
  first_name: "",
  middle_name: "",
  phone: "",
  email: "",
  comment: ""
};

const EMPTY_CONVERT_FORM = {
  block_id: "",
  floor_id: "",
  unit_id: ""
};

const BLOCK_ASSET_TYPES = {
  facadeRender: {
    entityType: "salesFacadeRender",
    title: "Рендеры фасада",
    documentName: "Рендеры фасада блока",
    uploadLabel: "Загрузить рендеры",
    accept: "image/*",
    multiple: true
  },
  buildingView: {
    entityType: "salesBuildingView",
    title: "SVG шахматки",
    documentName: "SVG шахматка блока",
    uploadLabel: "Загрузить SVG",
    accept: ".svg,image/svg+xml",
    multiple: false
  }
};

const normalizeInnInput = (value) => String(value || "").replace(/\D/g, "").slice(0, 14);

const isSvgUpload = (file) =>
  String(file?.type || "").toLowerCase() === "image/svg+xml" ||
  String(file?.name || "").toLowerCase().endsWith(".svg");

const isImageUpload = (file) =>
  String(file?.type || "").toLowerCase().startsWith("image/") ||
  /\.(png|jpe?g|webp|gif|svg)$/i.test(String(file?.name || ""));

const getFloorLabel = (floor) => {
  if (!floor) return "—";
  const customName = String(floor.name || "").trim();
  return customName || `${floor.floor_number} этаж`;
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

const getNextUnitNumber = (items = []) => {
  const maxNumber = items.reduce((max, item) => {
    const value = String(item?.unit_number || "").trim();
    if (!/^\d+$/.test(value)) return max;
    return Math.max(max, Number(value));
  }, 0);

  return String(maxNumber + 1);
};

const unitStatusPills = {
  free: "border border-green-500/40 bg-green-600/15 text-green-400",
  reserved: "border border-yellow-500/40 bg-yellow-500/15 text-yellow-300",
  sold: "border border-red-500/40 bg-red-500/15 text-red-400",
  offmarket: "border border-slate-500/40 bg-slate-500/15 text-slate-300"
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

function FacadeBoard({ floors, selectedFloorId, getFloorCounters, onOpenFloor }) {
  const sortedFloors = [...floors].sort((a, b) => Number(b.floor_number) - Number(a.floor_number));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-b from-sky-900 via-slate-900 to-slate-950 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="max-w-[70%]">
          <div className="text-lg font-semibold text-white">Шахматка по этажам</div>
          <div className="mt-1 text-xs text-slate-300">Нажмите на этаж, чтобы открыть планировку и состав лотов</div>
        </div>
        <div className="rounded-xl bg-black/30 px-3 py-2 text-right text-xs text-white">
          <div>Этажей: {floors.length}</div>
          <div>Кликабельно</div>
        </div>
      </div>

      <div className="relative mx-auto h-[620px] max-w-[360px]">
        <div className="absolute inset-x-[6%] bottom-0 top-[6%] rounded-t-[28px] border border-slate-500/60 bg-slate-200 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-y-0 left-[41%] right-[41%] rounded-t-[20px] bg-slate-700" />

          <div className="absolute inset-[7%] grid grid-cols-6 gap-x-3 gap-y-3">
            {Array.from({ length: 48 }).map((_, index) => (
              <div key={index} className="rounded bg-slate-900/90 shadow-inner shadow-black/30" />
            ))}
          </div>

          <div className="absolute inset-x-[4%] top-[10%] bottom-[10%]">
            {sortedFloors.map((floor, index) => {
              const counters = getFloorCounters(floor);
              const total = Math.max(sortedFloors.length, 1);
              const rowHeight = 100 / total;
              const top = index * rowHeight;
              const isSelected = Number(selectedFloorId) === Number(floor.id);

              return (
                <button
                  key={floor.id}
                  onClick={() => onOpenFloor(floor)}
                  className={`absolute left-0 right-0 flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-500/35 text-white shadow-[0_0_0_1px_rgba(147,197,253,0.4)]"
                      : "border-blue-300/50 bg-blue-500/18 text-white hover:bg-blue-500/28"
                  }`}
                  style={{
                    top: `calc(${top}% + 4px)`,
                    height: `calc(${rowHeight}% - 8px)`
                  }}
                >
                  <div>
                    <div className="text-base font-semibold">{getFloorLabel(floor)}</div>
                    <div className="mt-1 text-[11px] text-blue-100">Лотов: {(floor.units || []).length}</div>
                  </div>
                  <div className="text-right text-[11px] leading-5 text-blue-50">
                    <div>Свободно: {counters.free}</div>
                    <div>Бронь: {counters.reserved}</div>
                    <div>Продано: {counters.sold}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildingViewBoard({ file, floors, selectedFloorId, onOpenFloor, secondaryTextClass }) {
  const [svgMarkup, setSvgMarkup] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedFloor = useMemo(
    () => floors.find((item) => Number(item.id) === Number(selectedFloorId)) || null,
    [floors, selectedFloorId]
  );

  useEffect(() => {
    let active = true;

    const loadSvg = async () => {
      if (!file?.id) {
        setSvgMarkup("");
        return;
      }

      try {
        setLoading(true);
        const res = await api.get(`/documentFiles/download/${file.id}`, {
          responseType: "text",
          transformResponse: [(data) => data]
        });

        if (!active) return;

        const markup = String(res.data || "")
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
          .replace(/\son\w+="[^"]*"/gi, "")
          .replace(/\son\w+='[^']*'/gi, "");

        setSvgMarkup(markup);
      } catch (error) {
        console.error("ProjectSales building view svg load error", error);
        if (active) setSvgMarkup("");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSvg();
    return () => {
      active = false;
    };
  }, [file?.id]);

  const highlightedSvgMarkup = useMemo(() => {
    if (!svgMarkup || !selectedFloor) return svgMarkup;

    const parser = new DOMParser();
    const document = parser.parseFromString(svgMarkup, "image/svg+xml");
    const parseError = document.querySelector("parsererror");
    if (parseError) return svgMarkup;

    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      .sales-floor-active {
        fill: #3b82f6 !important;
        fill-opacity: 0.32 !important;
        stroke: #2563eb !important;
        stroke-opacity: 1 !important;
        stroke-width: 3px !important;
        vector-effect: non-scaling-stroke;
      }
      [data-floor-id], [data-floor-number] {
        cursor: pointer;
      }
    `;
    document.documentElement.prepend(style);

    const floorNumber = String(selectedFloor.floor_number ?? "");
    const selectors = [
      `[data-floor-id="${selectedFloor.id}"]`,
      `[id="${selectedFloor.id}"]`,
      `[data-floor-number="${floorNumber}"]`,
      `[id="floor-${floorNumber}"]`,
      `[id="floor_${floorNumber}"]`,
      `[id="floor${floorNumber}"]`
    ].filter(Boolean);

    const target = selectors
      .map((selector) => document.querySelector(selector))
      .find(Boolean);

    if (target) {
      const shapeSelector = "path, polygon, polyline, rect, circle, ellipse";
      const paintTargets = target.matches?.(shapeSelector)
        ? [target]
        : Array.from(target.querySelectorAll(shapeSelector));
      const activeTargets = paintTargets.length > 0 ? paintTargets : [target];

      activeTargets.forEach((element) => {
        element.classList.add("sales-floor-active");
        element.setAttribute("fill", "#3b82f6");
        element.setAttribute("fill-opacity", "0.32");
        element.setAttribute("stroke", "#2563eb");
        element.setAttribute("stroke-opacity", "1");
        element.setAttribute("stroke-width", "3");
        element.setAttribute("pointer-events", "auto");
        const existingStyle = element.getAttribute("style") || "";
        element.setAttribute(
          "style",
          `${existingStyle};fill:#3b82f6!important;fill-opacity:0.32!important;stroke:#2563eb!important;stroke-opacity:1!important;stroke-width:3px!important;vector-effect:non-scaling-stroke;`
        );
      });
    }

    return new XMLSerializer().serializeToString(document.documentElement);
  }, [svgMarkup, selectedFloor]);

  const handleSvgClick = (event) => {
    const element = event.target.closest?.("[data-floor-id], [data-floor-number], [id]");
    if (!element) return;

    const rawValue = String(
      element.dataset?.floorId ||
      element.dataset?.floorNumber ||
      element.id ||
      ""
    );
    const numericValue = rawValue.match(/\d+/)?.[0];

    const floor = floors.find((item) =>
      String(item.id) === rawValue ||
      String(item.floor_number) === rawValue ||
      (numericValue && String(item.floor_number) === numericValue)
    );

    if (floor) onOpenFloor(floor);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">Шахматка по этажам</div>
          <div className={`mt-1 text-xs ${secondaryTextClass}`}>
            Загруженный SVG блока. Если в SVG есть id/data-floor-number, этаж откроется по клику.
          </div>
        </div>
        <div className="rounded-xl bg-blue-600/20 px-3 py-2 text-right text-xs text-blue-100">
          <div>Этажей: {floors.length}</div>
          <div>{file?.name || "SVG"}</div>
        </div>
      </div>

      <div
        className="building-view-svg min-h-[420px] overflow-auto rounded-xl border border-gray-800 bg-white p-2"
        onClick={handleSvgClick}
      >
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">Загрузка SVG...</div>
        ) : svgMarkup ? (
          <div
            className="mx-auto min-w-[640px] [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none"
            dangerouslySetInnerHTML={{ __html: highlightedSvgMarkup }}
          />
        ) : (
          <div className="flex min-h-[420px] items-center justify-center text-center text-sm text-slate-500">
            Не удалось отобразить SVG шахматки
          </div>
        )}
      </div>

      {selectedFloorId && (
        <div className="mt-2 text-xs text-blue-200">Выбран этаж ID: {selectedFloorId}</div>
      )}
    </div>
  );
}

export default function ProjectSales() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("management");
  const [project, setProject] = useState(null);
  const [overview, setOverview] = useState(null);
  const [salesOverviewBlocks, setSalesOverviewBlocks] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [dealTypes, setDealTypes] = useState([]);

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [autoOpenedManagementBlock, setAutoOpenedManagementBlock] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState(null);
  const [floorForm, setFloorForm] = useState(EMPTY_FLOOR_FORM);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);

  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(null);
  const [convertForm, setConvertForm] = useState(EMPTY_CONVERT_FORM);
  const [convertFloors, setConvertFloors] = useState([]);
  const [convertLoading, setConvertLoading] = useState(false);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientFloors, setClientFloors] = useState([]);
  const [clientFloorsLoading, setClientFloorsLoading] = useState(false);
  const [unitClientModalOpen, setUnitClientModalOpen] = useState(false);
  const [unitClientTarget, setUnitClientTarget] = useState(null);
  const [unitClientForm, setUnitClientForm] = useState(EMPTY_UNIT_CLIENT_FORM);

  const [leadInputSearch, setLeadInputSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [leads, setLeads] = useState([]);
  const [leadsPagination, setLeadsPagination] = useState(null);

  const [clientInputSearch, setClientInputSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPage, setClientPage] = useState(1);
  const [clients, setClients] = useState([]);
  const [clientsPagination, setClientsPagination] = useState(null);
  const [filesModalEntity, setFilesModalEntity] = useState(null);
  const [filesDocumentId, setFilesDocumentId] = useState(null);
  const [salesFiles, setSalesFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [blockAssetFiles, setBlockAssetFiles] = useState({
    facadeRender: [],
    buildingView: []
  });
  const [blockAssetDocumentIds, setBlockAssetDocumentIds] = useState({
    facadeRender: null,
    buildingView: null
  });
  const [blockAssetsExpanded, setBlockAssetsExpanded] = useState(false);
  const [loadingBlockAssets, setLoadingBlockAssets] = useState(false);
  const [uploadingBlockAsset, setUploadingBlockAsset] = useState("");

  const pageClass = themeText.page(isDark);
  const titleClass = themeText.title(isDark);
  const secondaryTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const cardClass = `${themeSurface.card(isDark)} p-3`;
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const actionTileClass = themeControl.actionTilePadded(isDark);
  const chipButtonClass = themeControl.chipButton(isDark);
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);

  const canManageCatalog = Boolean(user?.id);
  const canOverrideOwnership = Number(user?.role_id) === 1;

  const projectBlocks = useMemo(
    () => (dictionaries.projectBlocks || []).filter((item) => Number(item.project_id) === Number(projectId)),
    [dictionaries.projectBlocks, projectId]
  );

  const selectedBlock = useMemo(
    () => projectBlocks.find((item) => Number(item.id) === Number(selectedBlockId)) || null,
    [projectBlocks, selectedBlockId]
  );

  const floors = overview?.floors || [];
  const selectedFloor = useMemo(
    () => floors.find((item) => Number(item.id) === Number(selectedFloorId)) || null,
    [floors, selectedFloorId]
  );
  const selectedUnits = selectedFloor?.units || [];
  const unitFormFloor = useMemo(
    () => floors.find((item) => Number(item.id) === Number(unitForm.floor_id)) || null,
    [floors, unitForm.floor_id]
  );
  const unitCodePreview = useMemo(
    () =>
      buildUnitCode({
        lotType: unitForm.lot_type,
        blockName: selectedBlock?.name || selectedBlock?.label,
        floorNumber: unitFormFloor?.floor_number,
        unitNumber: unitForm.unit_number
      }),
    [selectedBlock?.label, selectedBlock?.name, unitForm.lot_type, unitForm.unit_number, unitFormFloor?.floor_number]
  );
  const convertUnits = useMemo(() => {
    const floor = convertFloors.find((item) => Number(item.id) === Number(convertForm.floor_id));
    return floor?.units || [];
  }, [convertFloors, convertForm.floor_id]);
  const clientUnits = useMemo(() => {
    const floor = clientFloors.find((item) => Number(item.id) === Number(clientForm.floor_id));
    return floor?.units || [];
  }, [clientFloors, clientForm.floor_id]);
  const projectSalesBlocks = useMemo(() => {
    const blockNameMap = new Map(projectBlocks.map((item) => [Number(item.id), item.label || item.name]));
    const rows = salesOverviewBlocks
      .filter((item) => Number(item.project_id) === Number(projectId))
      .map((item) => ({
        ...item,
        name: item.name || blockNameMap.get(Number(item.id)) || `Блок ${item.id}`
      }));

    if (rows.length) {
      return rows.sort((a, b) => {
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (createdA !== createdB) return createdA - createdB;
        return Number(a.id || 0) - Number(b.id || 0);
      });
    }

    return projectBlocks.map((item) => ({
      id: item.id,
      project_id: item.project_id,
      name: item.label || item.name,
      total_units: 0,
      free_units: 0,
      reserved_units: 0,
      sold_units: 0,
      total_area: 0,
      total_price: 0,
      free_price: 0,
      reserved_price: 0,
      sold_price: 0,
      apartments: 0,
      commercial_units: 0,
      parking_units: 0,
      storage_units: 0
    }));
  }, [projectBlocks, projectId, salesOverviewBlocks]);

  const managementStats = useMemo(() => {
    const result = {
      totalArea: 0,
      totalPrice: 0,
      freePrice: 0,
      reservedPrice: 0,
      soldPrice: 0,
      byType: {
        apartment: 0,
        commercial: 0,
        parking: 0,
        storage: 0
      }
    };

    for (const floor of floors) {
      for (const unit of floor.units || []) {
        const statusCode = unitStatuses.find((item) => Number(item.id) === Number(unit.status_id))?.code;
        const price = Number(unit.price_total || 0);
        const area = Number(unit.area_total || 0);

        result.totalPrice += Number.isFinite(price) ? price : 0;
        result.totalArea += Number.isFinite(area) ? area : 0;

        if (statusCode === "free") result.freePrice += price;
        if (statusCode === "reserved") result.reservedPrice += price;
        if (statusCode === "sold") result.soldPrice += price;

        if (result.byType[unit.lot_type] !== undefined) {
          result.byType[unit.lot_type] += 1;
        }
      }
    }

    return result;
  }, [floors, unitStatuses]);

  useEffect(() => {
    loadInitial();
    setAutoOpenedManagementBlock(false);
  }, [projectId]);

  useEffect(() => {
    if (activeTab !== "management" || autoOpenedManagementBlock || !projectSalesBlocks.length) return;

    const blockExists = projectSalesBlocks.some((block) => Number(block.id) === Number(selectedBlockId));
    if (!selectedBlockId || !blockExists) {
      setSelectedBlockId(projectSalesBlocks[0].id);
      setSelectedFloorId(null);
    }
    setAutoOpenedManagementBlock(true);
  }, [activeTab, autoOpenedManagementBlock, projectSalesBlocks, selectedBlockId]);

  useEffect(() => {
    if (activeTab !== "units" || !projectSalesBlocks.length) return;

    const blockExists = projectSalesBlocks.some((block) => Number(block.id) === Number(selectedBlockId));
    if (!selectedBlockId || !blockExists) {
      setSelectedBlockId(projectSalesBlocks[0].id);
      setSelectedFloorId(null);
    }
  }, [activeTab, selectedBlockId, projectSalesBlocks]);

  useEffect(() => {
    if (!selectedBlockId) {
      setOverview(null);
      setSelectedFloorId(null);
      setBlockAssetFiles({ facadeRender: [], buildingView: [] });
      setBlockAssetDocumentIds({ facadeRender: null, buildingView: null });
      return;
    }
    loadOverview(selectedBlockId);
    loadBlockAssets(selectedBlockId);
  }, [selectedBlockId]);

  useEffect(() => {
    if (activeTab === "leads") {
      loadLeads();
    }
  }, [activeTab, leadPage, leadSearch, leadStatusFilter, selectedBlockId]);

  useEffect(() => {
    if (activeTab === "clients" || activeTab === "management") {
      loadClients();
    }
  }, [activeTab, clientPage, clientSearch, selectedBlockId]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [projectRes, salesObjectsRes, unitStatusesRes, leadStatusesRes, leadSourcesRes, dealTypesRes, dicts] = await Promise.all([
        getRequest(`/projects/getById/${projectId}`),
        getRequest("/sales/objects/overview"),
        getRequest("/sales/unit-statuses"),
        getRequest("/sales/lead-statuses"),
        getRequest("/sales/lead-sources"),
        getRequest("/sales/deal-types"),
        loadDictionaries(["users", "projectBlocks", "currencies"])
      ]);

      if (projectRes?.success) {
        setProject(projectRes.data || null);
      }

      const nextDicts = dicts || {};
      setSalesOverviewBlocks(salesObjectsRes?.success ? salesObjectsRes.data?.blocks || [] : []);
      setUnitStatuses(unitStatusesRes?.success ? unitStatusesRes.data || [] : []);
      const nextLeadStatuses = leadStatusesRes?.success ? leadStatusesRes.data || [] : [];
      setLeadStatuses(nextLeadStatuses);
      setLeadSources(leadSourcesRes?.success ? leadSourcesRes.data || [] : []);
      setDealTypes(dealTypesRes?.success ? dealTypesRes.data || [] : []);
      setDictionaries(nextDicts);
      setLeadStatusFilter((prev) => prev || (nextLeadStatuses[0]?.id ? String(nextLeadStatuses[0].id) : ""));
    } catch (error) {
      console.error("ProjectSales init error", error);
      toast.error("Не удалось загрузить модуль продаж");
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async (blockId) => {
    try {
      setLoading(true);
      const res = await getRequest(`/sales/blocks/${blockId}/overview`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить этажи и лоты");
        return;
      }
      const nextOverview = res.data || null;
      setOverview(nextOverview);
      setSelectedFloorId((prev) => {
        const nextFloors = nextOverview?.floors || [];
        return nextFloors.some((item) => Number(item.id) === Number(prev)) ? prev : null;
      });
    } catch (error) {
      console.error("ProjectSales overview error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки структуры блока");
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      setLoading(true);
      const res = await postRequest("/sales/leads/search", {
        project_id: Number(projectId),
        block_id: selectedBlockId ? Number(selectedBlockId) : undefined,
        status_id: leadStatusFilter
          ? Number(leadStatusFilter)
          : (leadStatuses[0]?.id ? Number(leadStatuses[0].id) : undefined),
        exclude_converted: true,
        search: leadSearch || undefined,
        page: leadPage,
        size: 10
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить лиды");
        return;
      }

      setLeads(res.data || []);
      setLeadsPagination(res.pagination || null);
    } catch (error) {
      console.error("ProjectSales leads load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки лидов");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      setLoading(true);
      const res = await postRequest("/sales/clients/search", {
        project_id: Number(projectId),
        block_id: selectedBlockId ? Number(selectedBlockId) : undefined,
        search: clientSearch || undefined,
        page: clientPage,
        size: 10
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить клиентов");
        return;
      }

      setClients(res.data || []);
      setClientsPagination(res.pagination || null);
    } catch (error) {
      console.error("ProjectSales clients load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки клиентов");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadInitial();
    if (selectedBlockId) {
      await Promise.all([loadOverview(selectedBlockId), loadBlockAssets(selectedBlockId)]);
    }
    if (activeTab === "leads") {
      await loadLeads();
    }
    if (activeTab === "clients") {
      await loadClients();
    }
  };

  const currencies = dictionaries.currencies || [];
  const defaultCurrencyId = currencies.find((item) => item.code === "KGS")?.id || currencies[0]?.id || "";
  const getCurrencyCode = (currency, currencyInfo = null) => {
    if (currencyInfo?.code) return currencyInfo.code;
    if (typeof currency === "object" && currency?.code) return currency.code;
    return currencies.find((item) => Number(item.id) === Number(currency))?.code || "KGS";
  };

  const formatMoney = (value, currency = "KGS", currencyInfo = null) => {
    if (value === null || value === undefined || value === "") return "—";
    return `${Number(value).toLocaleString("ru-RU")} ${getCurrencyCode(currency, currencyInfo)}`;
  };

  const formatArea = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м²`;
  };

  const getLotTypeLabel = (type) => ({
    apartment: "Квартира",
    commercial: "Помещение",
    parking: "Паркинг",
    storage: "Кладовая"
  }[type] || "Лот");

  const getUnitOptionLabel = (unit) =>
    `${getLotTypeLabel(unit?.lot_type)} №${unit?.unit_number || unit?.id} · ${formatArea(unit?.area_total)} · ${formatMoney(unit?.price_total, unit?.currency, unit?.currency_info)}`;

  const getUserName = (userId) =>
    dictionaries.users?.find((item) => Number(item.id) === Number(userId))?.label || "—";

  const getLeadStatus = (statusId) => leadStatuses.find((item) => Number(item.id) === Number(statusId));
  const getLeadSource = (sourceId) => leadSources.find((item) => Number(item.id) === Number(sourceId));
  const defaultLeadStatusId = leadStatuses[0]?.id ? String(leadStatuses[0].id) : "";
  const getUnitStatus = (statusId) => unitStatuses.find((item) => Number(item.id) === Number(statusId));
  const getUnitStatusByCode = (code) => unitStatuses.find((item) => item.code === code);
  const getDealType = (dealTypeId) => dealTypes.find((item) => Number(item.id) === Number(dealTypeId));

  const getUnitStatusCodeForDealType = (dealType) => {
    const code = dealType?.code;
    if (!code) return null;
    if (code === "free") return "free";
    if (code === "reservation" || code === "reservation_hadiya" || code === "reservation_barter" || code === "deposit") {
      return "reserved";
    }
    if (["regular", "barter", "land_barter", "exchange", "hadiya"].includes(code)) {
      return "sold";
    }
    return null;
  };

  const updateUnitStatus = async (unit, statusCode, options = {}) => {
    const status = getUnitStatusByCode(statusCode);
    if (!status) {
      toast.error("Статус лота не найден");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        project_id: Number(projectId),
        block_id: Number(unit.block_id || selectedBlockId),
        floor_id: Number(unit.floor_id),
        unit_number: unit.unit_number,
        lot_type: unit.lot_type,
        rooms: unit.rooms === null || unit.rooms === undefined ? null : Number(unit.rooms),
        area_total: unit.area_total === null || unit.area_total === undefined ? null : Number(unit.area_total),
        price_total: unit.price_total === null || unit.price_total === undefined ? null : Number(unit.price_total),
        currency: unit.currency || defaultCurrencyId,
        status_id: Number(status.id),
        plan_code: unit.plan_code || null,
        external_code: unit.external_code || null,
        description: unit.description || null
      };

      const res = await putRequest(`/sales/units/update/${unit.id}`, payload);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось изменить статус лота");
        return;
      }

      if (!options.silent) {
        toast.success(statusCode === "reserved" ? "Лот забронирован" : statusCode === "sold" ? "Лот выкуплен" : "Статус обновлен");
      }
      await Promise.all([loadOverview(selectedBlockId), loadInitial()]);
    } catch (error) {
      console.error("ProjectSales unit status error", error);
      toast.error(error?.response?.data?.message || "Ошибка изменения статуса лота");
    } finally {
      setSaving(false);
    }
  };

  const openCreateFloor = () => {
    if (!selectedBlockId) return toast.error("Сначала выберите блок");
    setEditingFloor(null);
    setFloorForm(EMPTY_FLOOR_FORM);
    setFloorModalOpen(true);
  };

  const openEditFloor = (floor) => {
    setEditingFloor(floor);
    setFloorForm({
      floor_number: floor.floor_number ?? "",
      name: floor.name || "",
      sort_order: floor.sort_order ?? ""
    });
    setFloorModalOpen(true);
  };

  const closeFloorModal = () => {
    setEditingFloor(null);
    setFloorForm(EMPTY_FLOOR_FORM);
    setFloorModalOpen(false);
  };

  const openCreateUnit = () => {
    if (!selectedBlockId) return toast.error("Сначала выберите блок");
    if (!selectedFloor?.id) return toast.error("Сначала создайте или выберите этаж");
    setEditingUnit(null);
    setUnitForm({
      ...EMPTY_UNIT_FORM,
      floor_id: String(selectedFloor.id),
      unit_number: getNextUnitNumber(selectedUnits),
      status_id: unitStatuses[0]?.id ? String(unitStatuses[0].id) : "",
      currency: defaultCurrencyId ? String(defaultCurrencyId) : ""
    });
    setUnitModalOpen(true);
  };

  const openEditUnit = (unit) => {
    setEditingUnit(unit);
    setUnitForm({
      floor_id: unit.floor_id ? String(unit.floor_id) : "",
      unit_number: unit.unit_number || "",
      lot_type: unit.lot_type || "apartment",
      rooms: unit.rooms ?? "",
      area_total: formatEditableNumber(unit.area_total),
      price_total: formatEditableNumber(unit.price_total),
      currency: unit.currency ? String(unit.currency) : (defaultCurrencyId ? String(defaultCurrencyId) : ""),
      status_id: unit.status_id ? String(unit.status_id) : "",
      plan_code: unit.plan_code || "",
      external_code: unit.external_code || "",
      description: unit.description || ""
    });
    setUnitModalOpen(true);
  };

  const closeUnitModal = () => {
    setEditingUnit(null);
    setUnitForm(EMPTY_UNIT_FORM);
    setUnitModalOpen(false);
  };

  const openCreateLead = () => {
    setEditingLead(null);
    setLeadForm({
      ...EMPTY_LEAD_FORM,
      status_id: defaultLeadStatusId
    });
    setLeadModalOpen(true);
  };

  const openEditLead = (lead) => {
    setEditingLead(lead);
    setLeadForm({
      full_name: lead.full_name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      inn: lead.inn || "",
      status_id: lead.status_id ? String(lead.status_id) : "",
      source_id: lead.source_id ? String(lead.source_id) : "",
      comment: lead.comment || "",
      interest_rooms: lead.interest_rooms ?? "",
      interest_budget_from: lead.interest_budget_from ?? "",
      interest_budget_to: lead.interest_budget_to ?? ""
    });
    setLeadModalOpen(true);
  };

  const closeLeadModal = () => {
    setEditingLead(null);
    setLeadForm(EMPTY_LEAD_FORM);
    setLeadModalOpen(false);
  };

  const loadConvertFloors = async (blockId, unitId = "") => {
    if (!blockId) {
      setConvertFloors([]);
      setConvertForm((prev) => ({ ...prev, floor_id: "", unit_id: "" }));
      return;
    }

    try {
      setConvertLoading(true);
      const res = await getRequest(`/sales/blocks/${blockId}/overview`);
      const nextFloors = res?.success ? res.data?.floors || [] : [];
      setConvertFloors(nextFloors);

      const nextUnitId = unitId ? String(unitId) : "";
      const nextFloor = nextUnitId
        ? nextFloors.find((floor) => (floor.units || []).some((unit) => Number(unit.id) === Number(nextUnitId)))
        : null;

      setConvertForm((prev) => ({
        ...prev,
        floor_id: nextFloor ? String(nextFloor.id) : "",
        unit_id: nextFloor ? nextUnitId : ""
      }));
    } catch (error) {
      console.error("ProjectSales convert floors load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки квартир блока");
      setConvertFloors([]);
      setConvertForm((prev) => ({ ...prev, floor_id: "", unit_id: "" }));
    } finally {
      setConvertLoading(false);
    }
  };

  const loadClientFloors = async (blockId, unitId = "") => {
    if (!blockId) {
      setClientFloors([]);
      setClientForm((prev) => ({ ...prev, floor_id: "", unit_id: "" }));
      return;
    }

    try {
      setClientFloorsLoading(true);
      const res = await getRequest(`/sales/blocks/${blockId}/overview`);
      const nextFloors = res?.success ? res.data?.floors || [] : [];
      setClientFloors(nextFloors);

      const nextUnitId = unitId ? String(unitId) : "";
      const nextFloor = nextUnitId
        ? nextFloors.find((floor) => (floor.units || []).some((unit) => Number(unit.id) === Number(nextUnitId)))
        : null;

      setClientForm((prev) => ({
        ...prev,
        floor_id: nextFloor ? String(nextFloor.id) : "",
        unit_id: nextFloor ? nextUnitId : ""
      }));
    } catch (error) {
      console.error("ProjectSales client floors load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки квартир блока");
      setClientFloors([]);
      setClientForm((prev) => ({ ...prev, floor_id: "", unit_id: "" }));
    } finally {
      setClientFloorsLoading(false);
    }
  };

  const openConvertLeadModal = (lead) => {
    const defaultBlockId = lead.block_id || selectedBlockId || projectBlocks[0]?.id || "";
    setConvertingLead(lead);
    setConvertForm({
      block_id: defaultBlockId ? String(defaultBlockId) : "",
      floor_id: "",
      unit_id: lead.unit_id ? String(lead.unit_id) : ""
    });
    setConvertFloors([]);
    setConvertModalOpen(true);

    if (defaultBlockId) {
      loadConvertFloors(defaultBlockId, lead.unit_id);
    }
  };

  const closeConvertLeadModal = () => {
    setConvertModalOpen(false);
    setConvertingLead(null);
    setConvertForm(EMPTY_CONVERT_FORM);
    setConvertFloors([]);
  };

  const updateConvertBlock = (blockId) => {
    setConvertForm({
      block_id: blockId,
      floor_id: "",
      unit_id: ""
    });
    setConvertFloors([]);
    if (blockId) {
      loadConvertFloors(blockId);
    }
  };

  const openCreateClient = () => {
    const defaultBlockId = selectedBlockId || projectBlocks[0]?.id || "";
    setEditingClient(null);
    setClientForm({
      ...EMPTY_CLIENT_FORM,
      block_id: defaultBlockId ? String(defaultBlockId) : ""
    });
    setClientFloors([]);
    setClientModalOpen(true);
    if (defaultBlockId) {
      loadClientFloors(defaultBlockId);
    }
  };

  const openEditClient = (client) => {
    const defaultBlockId = client.block_id || client.sales_unit?.block_id || selectedBlockId || projectBlocks[0]?.id || "";
    const defaultUnitId = client.unit_id || client.sales_unit?.id || "";
    setEditingClient(client);
    setClientForm({
      last_name: client.last_name || "",
      first_name: client.first_name || (!client.last_name && !client.middle_name ? client.full_name || "" : ""),
      middle_name: client.middle_name || "",
      phone: client.phone || "",
      phone_extra: client.phone_extra || "",
      email: client.email || "",
      passport_number: client.passport_number || "",
      pin: client.pin || "",
      address: client.address || "",
      comment: client.comment || "",
      block_id: defaultBlockId ? String(defaultBlockId) : "",
      floor_id: "",
      unit_id: defaultUnitId ? String(defaultUnitId) : ""
    });
    setClientFloors([]);
    setClientModalOpen(true);
    if (defaultBlockId) {
      loadClientFloors(defaultBlockId, defaultUnitId);
    }
  };

  const closeClientModal = () => {
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFloors([]);
    setClientModalOpen(false);
  };

  const updateClientBlock = (blockId) => {
    setClientForm((prev) => ({
      ...prev,
      block_id: blockId,
      floor_id: "",
      unit_id: ""
    }));
    setClientFloors([]);
    if (blockId) {
      loadClientFloors(blockId);
    }
  };

  const openUnitClientModal = (unit) => {
    const defaultDealType = dealTypes.find((item) => item.code === "reservation") || dealTypes[0];
    setUnitClientTarget(unit);
    setUnitClientForm({
      ...EMPTY_UNIT_CLIENT_FORM,
      deal_type_id: defaultDealType?.id ? String(defaultDealType.id) : "",
      comment: `Интерес к ${getLotTypeLabel(unit.lot_type).toLowerCase()} №${unit.unit_number}`
    });
    setUnitClientModalOpen(true);
  };

  const closeUnitClientModal = () => {
    setUnitClientTarget(null);
    setUnitClientForm(EMPTY_UNIT_CLIENT_FORM);
    setUnitClientModalOpen(false);
  };

  const saveFloor = async (e) => {
    e.preventDefault();
    if (!selectedBlockId) return toast.error("Сначала выберите блок");
    if (floorForm.floor_number === "") return toast.error("Введите номер этажа");
    const floorNumber = Number(floorForm.floor_number);
    if (!Number.isFinite(floorNumber)) return toast.error("Номер этажа должен быть числом, название укажите отдельным полем");

    try {
      setSaving(true);
      const payload = {
        project_id: Number(projectId),
        block_id: Number(selectedBlockId),
        floor_number: floorNumber,
        name: floorForm.name?.trim() || null,
        sort_order: floorForm.sort_order === "" ? null : Number(floorForm.sort_order)
      };

      const res = editingFloor
        ? await putRequest(`/sales/floors/update/${editingFloor.id}`, payload)
        : await postRequest("/sales/floors/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить этаж");
        return;
      }

      toast.success(editingFloor ? "Этаж обновлен" : "Этаж создан");
      closeFloorModal();
      await Promise.all([loadOverview(selectedBlockId), loadInitial()]);
    } catch (error) {
      console.error("ProjectSales floor save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения этажа");
    } finally {
      setSaving(false);
    }
  };

  const deleteFloor = async (floor) => {
    if (!floor?.id) return;
    if ((floor.units || []).length > 0) {
      toast.error("Нельзя удалить этаж, на котором есть лоты");
      return;
    }
    if (!window.confirm(`Удалить этаж "${getFloorLabel(floor)}"?`)) return;

    try {
      setSaving(true);
      const res = await deleteRequest(`/sales/floors/delete/${floor.id}`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить этаж");
        return;
      }

      toast.success("Этаж удален");
      if (Number(selectedFloorId) === Number(floor.id)) {
        setSelectedFloorId(null);
      }
      await Promise.all([loadOverview(selectedBlockId), loadInitial()]);
    } catch (error) {
      console.error("ProjectSales floor delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления этажа");
    } finally {
      setSaving(false);
    }
  };

  const saveUnit = async (e) => {
    e.preventDefault();
    if (!selectedBlockId) return toast.error("Сначала выберите блок");
    if (!unitForm.floor_id) return toast.error("Выберите этаж");
    if (!unitForm.unit_number.trim()) return toast.error("Введите номер лота");

    try {
      setSaving(true);
      const payload = {
        project_id: Number(projectId),
        block_id: Number(selectedBlockId),
        floor_id: Number(unitForm.floor_id),
        unit_number: unitForm.unit_number.trim(),
        lot_type: unitForm.lot_type,
        rooms: unitForm.rooms === "" ? null : Number(unitForm.rooms),
        area_total: toNullableNumber(unitForm.area_total),
        price_total: toNullableNumber(unitForm.price_total),
        currency: unitForm.currency ? Number(unitForm.currency) : null,
        status_id: unitForm.status_id ? Number(unitForm.status_id) : null,
        plan_code: unitCodePreview,
        external_code: unitCodePreview,
        description: unitForm.description.trim() || null
      };

      const res = editingUnit
        ? await putRequest(`/sales/units/update/${editingUnit.id}`, payload)
        : await postRequest("/sales/units/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить лот");
        return;
      }

      toast.success(editingUnit ? "Лот обновлен" : "Лот создан");
      closeUnitModal();
      await Promise.all([loadOverview(selectedBlockId), loadInitial()]);
    } catch (error) {
      console.error("ProjectSales unit save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения лота");
    } finally {
      setSaving(false);
    }
  };

  const saveLead = async (e) => {
    e.preventDefault();
    if (!leadForm.full_name.trim()) return toast.error("Введите имя лида");
    if (!leadForm.status_id) return toast.error("Выберите статус лида");

    try {
      setSaving(true);
      const payload = {
        project_id: Number(projectId),
        block_id: selectedBlockId ? Number(selectedBlockId) : null,
        full_name: leadForm.full_name.trim(),
        phone: leadForm.phone.trim() || null,
        email: leadForm.email.trim() || null,
        inn: leadForm.inn.trim() || null,
        status_id: Number(leadForm.status_id),
        source_id: leadForm.source_id ? Number(leadForm.source_id) : null,
        comment: leadForm.comment.trim() || null,
        interest_rooms: leadForm.interest_rooms === "" ? null : Number(leadForm.interest_rooms),
        interest_budget_from: leadForm.interest_budget_from === "" ? null : Number(leadForm.interest_budget_from),
        interest_budget_to: leadForm.interest_budget_to === "" ? null : Number(leadForm.interest_budget_to)
      };

      const res = editingLead
        ? await putRequest(`/sales/leads/update/${editingLead.id}`, payload)
        : await postRequest("/sales/leads/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить лида");
        return;
      }

      toast.success(editingLead ? "Лид обновлен" : "Лид создан");
      closeLeadModal();
      await loadLeads();
    } catch (error) {
      console.error("ProjectSales lead save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения лида");
    } finally {
      setSaving(false);
    }
  };

  const saveClient = async (e) => {
    e.preventDefault();
    const fullName = [clientForm.last_name, clientForm.first_name, clientForm.middle_name].map((item) => item.trim()).filter(Boolean).join(" ");
    if (!fullName && !clientForm.phone.trim()) {
      return toast.error("Введите имя клиента");
    }

    try {
      setSaving(true);
      const payload = {
        last_name: clientForm.last_name.trim() || null,
        first_name: clientForm.first_name.trim() || null,
        middle_name: clientForm.middle_name.trim() || null,
        full_name: fullName || editingClient?.full_name || clientForm.phone.trim() || null,
        phone: clientForm.phone.trim() || null,
        phone_extra: clientForm.phone_extra.trim() || null,
        email: clientForm.email.trim() || null,
        passport_number: clientForm.passport_number.trim() || null,
        pin: clientForm.pin.trim() || null,
        address: clientForm.address.trim() || null,
        comment: clientForm.comment.trim() || null,
        project_id: Number(projectId),
        block_id: clientForm.block_id ? Number(clientForm.block_id) : null,
        unit_id: clientForm.unit_id ? Number(clientForm.unit_id) : null
      };

      const res = editingClient
        ? await putRequest(`/sales/clients/update/${editingClient.id}`, payload)
        : await postRequest("/sales/clients/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить клиента");
        return;
      }

      toast.success(editingClient ? "Клиент обновлен" : "Клиент создан");
      closeClientModal();
      await loadClients();
    } catch (error) {
      console.error("ProjectSales client save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения клиента");
    } finally {
      setSaving(false);
    }
  };

  const saveUnitClient = async (e) => {
    e.preventDefault();
    if (!unitClientTarget) return;

    const existingClient = clients.find((item) => Number(item.id) === Number(unitClientForm.client_id));
    if (!existingClient && !unitClientForm.first_name.trim() && !unitClientForm.last_name.trim()) {
      toast.error("Выберите клиента или введите имя нового");
      return;
    }

    const selectedDealType = getDealType(unitClientForm.deal_type_id);

    try {
      setSaving(true);
      let client = existingClient;

      if (!client) {
        const clientRes = await postRequest("/sales/clients/create", {
          last_name: unitClientForm.last_name.trim() || null,
          first_name: unitClientForm.first_name.trim() || null,
          middle_name: unitClientForm.middle_name.trim() || null,
          phone: unitClientForm.phone.trim() || null,
          email: unitClientForm.email.trim() || null,
          comment: unitClientForm.comment.trim() || null
        });

        if (!clientRes?.success) {
          toast.error(clientRes?.message || "Не удалось создать клиента");
          return;
        }

        client = clientRes.data;
      }

      const clientName =
        client.full_name ||
        [client.last_name, client.first_name, client.middle_name].filter(Boolean).join(" ") ||
        "Клиент";
      const defaultComment = `Клиент привязан к лоту №${unitClientTarget.unit_number}`;
      const leadComment = [
        selectedDealType ? `Тип сделки: ${selectedDealType.name}` : "",
        unitClientForm.comment.trim()
      ].filter(Boolean).join("\n") || defaultComment;

      const leadRes = await postRequest("/sales/leads/create", {
        project_id: Number(projectId),
        block_id: selectedBlockId ? Number(selectedBlockId) : null,
        unit_id: Number(unitClientTarget.id),
        client_id: Number(client.id),
        full_name: clientName,
        phone: client.phone || unitClientForm.phone.trim() || null,
        email: client.email || unitClientForm.email.trim() || null,
        status_id: defaultLeadStatusId ? Number(defaultLeadStatusId) : undefined,
        comment: leadComment,
        interest_rooms: unitClientTarget.rooms === null || unitClientTarget.rooms === undefined ? null : Number(unitClientTarget.rooms),
        interest_budget_from: unitClientTarget.price_total === null || unitClientTarget.price_total === undefined ? null : Number(unitClientTarget.price_total),
        interest_budget_to: unitClientTarget.price_total === null || unitClientTarget.price_total === undefined ? null : Number(unitClientTarget.price_total)
      });

      if (!leadRes?.success) {
        toast.error(leadRes?.message || "Не удалось привязать клиента к лоту");
        return;
      }

      const nextStatusCode = getUnitStatusCodeForDealType(selectedDealType);
      if (nextStatusCode) {
        await updateUnitStatus(unitClientTarget, nextStatusCode, { silent: true });
      }

      toast.success("Клиент добавлен к лоту");
      closeUnitClientModal();
      await Promise.all([loadClients(), loadLeads()]);
    } catch (error) {
      console.error("ProjectSales unit client save error", error);
      toast.error(error?.response?.data?.message || "Ошибка привязки клиента");
    } finally {
      setSaving(false);
    }
  };

  const claimLead = async (leadId) => {
    try {
      const res = await postRequest(`/sales/leads/claim/${leadId}`, {});
      if (!res?.success) {
        toast.error(res?.message || "Не удалось закрепить лида");
        return;
      }
      toast.success(res.message || "Лид закреплен за вами");
      await loadLeads();
    } catch (error) {
      console.error("ProjectSales claim lead error", error);
      toast.error(error?.response?.data?.message || "Ошибка закрепления лида");
    }
  };

  const convertLeadToClient = async () => {
    if (!convertingLead) return;
    if (!convertForm.unit_id) {
      toast.error("Выберите квартиру");
      return;
    }

    try {
      setSaving(true);
      const res = await postRequest(`/sales/leads/convert-to-client/${convertingLead.id}`, {
        unit_id: Number(convertForm.unit_id)
      });
      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать клиента из лида");
        return;
      }
      toast.success(res.message || "Клиент создан из лида");
      closeConvertLeadModal();
      await Promise.all([loadLeads(), loadClients(), selectedBlockId ? loadOverview(selectedBlockId) : Promise.resolve()]);
    } catch (error) {
      console.error("ProjectSales convert lead error", error);
      toast.error(error?.response?.data?.message || "Ошибка создания клиента из лида");
    } finally {
      setSaving(false);
    }
  };

  const claimClient = async (clientId) => {
    try {
      const res = await postRequest(`/sales/clients/claim/${clientId}`, {});
      if (!res?.success) {
        toast.error(res?.message || "Не удалось закрепить клиента");
        return;
      }
      toast.success(res.message || "Клиент закреплен за вами");
      await loadClients();
    } catch (error) {
      console.error("ProjectSales claim client error", error);
      toast.error(error?.response?.data?.message || "Ошибка закрепления клиента");
    }
  };

  const loadBlockAssetFiles = async (kind, blockId) => {
    const config = BLOCK_ASSET_TYPES[kind];
    if (!config || !blockId) return { documentId: null, files: [] };

    const docs = await postRequest("/documents/search", {
      entity_type: config.entityType,
      entity_id: Number(blockId),
      page: 1,
      size: 1
    });

    const documentId = docs?.success ? docs.data?.[0]?.id || null : null;
    if (!documentId) {
      return { documentId: null, files: [] };
    }

    const files = await getRequest(`/documentFiles/files/${documentId}`);
    return {
      documentId,
      files: files?.success ? files.data || [] : []
    };
  };

  const loadBlockAssets = async (blockId = selectedBlockId) => {
    if (!blockId) return;

    try {
      setLoadingBlockAssets(true);
      const entries = await Promise.all(
        Object.keys(BLOCK_ASSET_TYPES).map(async (kind) => [kind, await loadBlockAssetFiles(kind, blockId)])
      );

      setBlockAssetFiles((prev) => ({
        ...prev,
        ...Object.fromEntries(entries.map(([kind, value]) => [kind, value.files]))
      }));
      setBlockAssetDocumentIds((prev) => ({
        ...prev,
        ...Object.fromEntries(entries.map(([kind, value]) => [kind, value.documentId]))
      }));
    } catch (error) {
      console.error("ProjectSales loadBlockAssets error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки файлов фасада");
    } finally {
      setLoadingBlockAssets(false);
    }
  };

  const ensureBlockAssetDocument = async (kind) => {
    const config = BLOCK_ASSET_TYPES[kind];
    if (!config || !selectedBlockId) {
      throw new Error("Сначала выберите блок");
    }

    if (blockAssetDocumentIds[kind]) {
      return blockAssetDocumentIds[kind];
    }

    const existing = await loadBlockAssetFiles(kind, selectedBlockId);
    if (existing.documentId) {
      setBlockAssetDocumentIds((prev) => ({ ...prev, [kind]: existing.documentId }));
      setBlockAssetFiles((prev) => ({ ...prev, [kind]: existing.files }));
      return existing.documentId;
    }

    const created = await postRequest("/documents/create", {
      entity_type: config.entityType,
      entity_id: Number(selectedBlockId),
      name: `${config.documentName}: ${selectedBlock?.label || selectedBlockId}`,
      description: selectedBlock?.label || null,
      status: 1
    });

    if (!created?.success || !created.data?.id) {
      throw new Error(created?.message || "Не удалось создать документ");
    }

    setBlockAssetDocumentIds((prev) => ({ ...prev, [kind]: created.data.id }));
    return created.data.id;
  };

  const handleUploadBlockAsset = async (event, kind) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const config = BLOCK_ASSET_TYPES[kind];
      if (!config) return;

      if (kind === "buildingView" && (blockAssetFiles.buildingView || []).length > 0) {
        throw new Error("Сначала удалите текущую SVG-шахматку");
      }

      if (kind === "buildingView" && (files.length > 1 || !isSvgUpload(files[0]))) {
        throw new Error("Для шахматки нужен один SVG-файл");
      }

      if (kind === "facadeRender" && files.some((file) => !isImageUpload(file))) {
        throw new Error("Для фасада можно загружать только изображения");
      }

      setUploadingBlockAsset(kind);
      const documentId = await ensureBlockAssetDocument(kind);

      const formData = new FormData();
      (kind === "buildingView" ? files.slice(0, 1) : files).forEach((file) => formData.append("files", file));

      const uploadRes = await api.post(`/documentFiles/upload/${documentId}`, formData);
      if (!uploadRes.data?.success) {
        throw new Error(uploadRes.data?.message || "Не удалось загрузить файл");
      }

      toast.success(kind === "buildingView" ? "SVG шахматки загружен" : "Рендеры фасада загружены");
      await loadBlockAssets(selectedBlockId);
    } catch (error) {
      console.error("ProjectSales uploadBlockAsset error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки файла");
    } finally {
      setUploadingBlockAsset("");
      event.target.value = null;
    }
  };

  const handleDeleteBlockAssetFile = async (kind, fileId) => {
    if (!window.confirm("Удалить файл?")) return;

    try {
      const res = await deleteRequest(`/documentFiles/${fileId}`);
      if (!res?.success) {
        throw new Error(res?.message || "Не удалось удалить файл");
      }

      toast.success("Файл удален");
      await loadBlockAssets(selectedBlockId);
    } catch (error) {
      console.error("ProjectSales deleteBlockAssetFile error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка удаления файла");
    }
  };

  const getSalesFilesMeta = (kind, entity) => {
    if (kind === "lead") {
      return {
        entityType: "salesLead",
        title: "Файлы лида",
        name: entity?.full_name || `Лид #${entity?.id || ""}`,
        documentName: `Файлы лида №${entity?.id || ""}`
      };
    }

    const clientName =
      entity?.full_name ||
      [entity?.last_name, entity?.first_name, entity?.middle_name].filter(Boolean).join(" ") ||
      `Клиент #${entity?.id || ""}`;

    return {
      entityType: "salesClient",
      title: "Файлы клиента",
      name: clientName,
      documentName: `Файлы клиента №${entity?.id || ""}`
    };
  };

  const loadSalesFiles = async (kind, entityId) => {
    if (!kind || !entityId) return;

    const meta = getSalesFilesMeta(kind, { id: entityId });

    try {
      setLoadingFiles(true);

      const docs = await postRequest("/documents/search", {
        entity_type: meta.entityType,
        entity_id: Number(entityId),
        page: 1,
        size: 1
      });

      if (!docs?.success) {
        toast.error(docs?.message || "Не удалось загрузить документы");
        setFilesDocumentId(null);
        setSalesFiles([]);
        return;
      }

      const documentId = docs.data?.[0]?.id || null;
      setFilesDocumentId(documentId);

      if (!documentId) {
        setSalesFiles([]);
        return;
      }

      const files = await getRequest(`/documentFiles/files/${documentId}`);
      setSalesFiles(files?.success ? files.data || [] : []);
    } catch (error) {
      console.error("ProjectSales loadSalesFiles error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки файлов");
      setSalesFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const ensureSalesDocument = async () => {
    if (filesDocumentId) return filesDocumentId;
    if (!filesModalEntity?.kind || !filesModalEntity?.entity?.id) {
      throw new Error("Не выбрана сущность для файлов");
    }

    const { kind, entity } = filesModalEntity;
    const meta = getSalesFilesMeta(kind, entity);

    const docs = await postRequest("/documents/search", {
      entity_type: meta.entityType,
      entity_id: Number(entity.id),
      page: 1,
      size: 1
    });

    if (docs?.success && docs.data?.[0]?.id) {
      setFilesDocumentId(docs.data[0].id);
      return docs.data[0].id;
    }

    const created = await postRequest("/documents/create", {
      entity_type: meta.entityType,
      entity_id: Number(entity.id),
      name: meta.documentName,
      description: meta.name,
      status: 1
    });

    if (!created?.success) {
      throw new Error(created?.message || "Не удалось создать документ");
    }

    setFilesDocumentId(created.data.id);
    return created.data.id;
  };

  const openSalesFiles = async (kind, entity) => {
    setFilesModalEntity({ kind, entity });
    setFilesDocumentId(null);
    setSalesFiles([]);
    await loadSalesFiles(kind, entity.id);
  };

  const closeSalesFiles = () => {
    setFilesModalEntity(null);
    setFilesDocumentId(null);
    setSalesFiles([]);
  };

  const handleUploadSalesFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !filesModalEntity) return;

    try {
      setUploadingFiles(true);
      const documentId = await ensureSalesDocument();
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await postRequest(`/documentFiles/upload/${documentId}`, formData);
      if (!res?.success) {
        throw new Error(res?.message || "Не удалось загрузить файлы");
      }

      toast.success("Файлы загружены");
      await loadSalesFiles(filesModalEntity.kind, filesModalEntity.entity.id);
    } catch (error) {
      console.error("ProjectSales uploadSalesFiles error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки файлов");
    } finally {
      setUploadingFiles(false);
      event.target.value = null;
    }
  };

  const handleDeleteSalesFile = async (fileId) => {
    if (!window.confirm("Удалить файл?")) return;

    try {
      const res = await deleteRequest(`/documentFiles/${fileId}`);
      if (!res?.success) {
        throw new Error(res?.message || "Не удалось удалить файл");
      }

      toast.success("Файл удален");
      await loadSalesFiles(filesModalEntity.kind, filesModalEntity.entity.id);
    } catch (error) {
      console.error("ProjectSales deleteSalesFile error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка удаления файла");
    }
  };

  const handleDownloadSalesFile = async (file) => {
    try {
      const res = await api.get(`/documentFiles/download/${file.id}`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name || `sales-file-${file.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("ProjectSales downloadSalesFile error", error);
      toast.error("Не удалось скачать файл");
    }
  };

  const getFloorCounters = (floor) => {
    const counters = { free: 0, reserved: 0, sold: 0, offmarket: 0 };
    for (const unit of floor?.units || []) {
      const code = getUnitStatus(unit.status_id)?.code;
      if (code && counters[code] !== undefined) {
        counters[code] += 1;
      }
    }
    return counters;
  };

  const openFloorPlan = (floor) => {
    setSelectedFloorId(floor.id);
    navigate(`/projects/${projectId}/sales/blocks/${selectedBlockId}/floors/${floor.id}`);
  };

  const tabs = [
    { id: "management", label: "Управление", icon: ListChecks },
    { id: "units", label: "Шахматка", icon: Grid3X3 },
    { id: "leads", label: "Лиды", icon: UserPlus },
    { id: "clients", label: "Клиенты", icon: Users }
  ];

  return (
    <div className={`min-h-full ${pageClass}`}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl font-semibold ${titleClass}`}>Продажи: {project?.name || "Объект"}</h1>
            <div className={`text-sm ${secondaryTextClass}`}>{selectedBlock?.label || "Выберите блок"}</div>
          </div>
          <button onClick={() => navigate(`/projects/${projectId}`)} className={subtleButtonClass}>
            Назад
          </button>
        </div>

        <div className={`${panelClass} mb-4 space-y-3`}>
          <div className="grid grid-cols-4 gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={activeTab === id ? "rounded-lg bg-blue-600 px-3 py-2 text-sm text-white" : `${chipButtonClass} py-2`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon size={15} />
                  <span>{label}</span>
                </div>
              </button>
            ))}
          </div>

          {activeTab === "units" && (
            <Field label="Блок">
              <select
                value={selectedBlockId || ""}
                onChange={(event) => {
                  setSelectedBlockId(event.target.value ? Number(event.target.value) : null);
                  setSelectedFloorId(null);
                }}
                className={inputClass}
              >
                {projectSalesBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name || block.label || `Блок ${block.id}`}
                  </option>
                ))}
              </select>
            </Field>
          )}

        </div>

        {activeTab === "management" && (
          <>
            <div className={`${panelClass} mb-4 space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-semibold ${titleClass}`}>Блоки объекта</div>
                  <div className={`text-xs ${secondaryTextClass}`}>Продажи по блокам и быстрый выбор этажа</div>
                </div>
                {canManageCatalog && (
                  <button onClick={openCreateFloor} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">
                    <div className="flex items-center gap-1">
                      <Plus size={14} />
                      <span>Этаж</span>
                    </div>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {projectSalesBlocks.map((block) => {
                  const isSelectedBlock = Number(selectedBlockId) === Number(block.id);
                  const soldPercent = Number(block.total_units || 0)
                    ? Math.round((Number(block.sold_units || 0) / Number(block.total_units || 0)) * 100)
                    : 0;
                  const blockFloors = isSelectedBlock ? floors : [];

                  return (
                    <div
                      key={block.id}
                      className={`rounded-xl border p-3 transition ${
                        isSelectedBlock ? "border-blue-500 bg-blue-600/15" : "border-gray-800 bg-gray-900"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const nextBlockId = isSelectedBlock ? null : block.id;
                          setSelectedBlockId(nextBlockId);
                          setSelectedFloorId(null);
                          setLeadPage(1);
                          setClientPage(1);
                        }}
                        className="w-full text-left"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{block.name}</div>
                            <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                              {block.free_units || 0} свободно из {block.total_units || 0}
                            </div>
                          </div>
                          <div className="rounded-lg bg-gray-950/40 px-2 py-1 text-xs text-blue-200">
                            {soldPercent}% продано
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-gray-950/30 p-2">
                            <div className="font-semibold">{block.total_units || 0}</div>
                            <div className={mutedTextClass}>Лотов</div>
                          </div>
                          <div className="rounded-lg bg-green-500/10 p-2 text-green-300">
                            <div className="font-semibold">{block.free_units || 0}</div>
                            <div>Своб.</div>
                          </div>
                          <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-300">
                            <div className="font-semibold">{block.reserved_units || 0}</div>
                            <div>Бронь</div>
                          </div>
                          <div className="rounded-lg bg-red-500/10 p-2 text-red-300">
                            <div className="font-semibold">{block.sold_units || 0}</div>
                            <div>Выкуп</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg border border-gray-800 p-2">
                            <div className={mutedTextClass}>Площадь</div>
                            <div className="mt-1 font-semibold">{formatArea(block.total_area)}</div>
                          </div>
                          <div className="rounded-lg border border-gray-800 p-2">
                            <div className={mutedTextClass}>Фонд</div>
                            <div className="mt-1 truncate font-semibold">{formatMoney(block.total_price)}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full border border-gray-700 px-2 py-1">Квартир: {block.apartments || 0}</span>
                          <span className="rounded-full border border-gray-700 px-2 py-1">Помещ.: {block.commercial_units || 0}</span>
                          <span className="rounded-full border border-gray-700 px-2 py-1">Паркинг: {block.parking_units || 0}</span>
                          <span className="rounded-full border border-gray-700 px-2 py-1">Клад.: {block.storage_units || 0}</span>
                        </div>
                      </button>

                      {isSelectedBlock && blockFloors.length ? (
                        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-gray-800 pt-3">
                          {blockFloors.map((floor) => {
                            const counters = getFloorCounters(floor);
                            const isSelected = Number(selectedFloorId) === Number(floor.id);

                            return (
                              <button
                                key={floor.id}
                                type="button"
                                onClick={() => setSelectedFloorId(floor.id)}
                                className={`min-w-0 rounded-lg border px-2 py-2 text-left text-xs ${
                                  isSelected ? "border-blue-500 bg-blue-600/25" : "border-gray-700 bg-gray-950/30"
                                }`}
                              >
                                <div className="truncate font-semibold">{getFloorLabel(floor)}</div>
                                <div className="mt-1 flex gap-1">
                                  <span className="rounded-full bg-green-500/10 px-1.5 text-green-300">{counters.free}</span>
                                  <span className="rounded-full bg-yellow-500/10 px-1.5 text-yellow-300">{counters.reserved}</span>
                                  <span className="rounded-full bg-red-500/10 px-1.5 text-red-300">{counters.sold}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {!projectSalesBlocks.length && !loading && (
                <div className={`rounded-xl border border-dashed border-gray-700 p-4 text-center text-sm ${secondaryTextClass}`}>
                  Для объекта пока нет блоков продаж.
                </div>
              )}
            </div>

            {selectedFloor && (
              <div className={`${panelClass} mb-4 space-y-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{getFloorLabel(selectedFloor)}</div>
                    <div className={`text-xs ${secondaryTextClass}`}>Управление квартирами и лотами этажа</div>
                  </div>
                  <div className="flex gap-2">
                    {canManageCatalog && (
                      <button onClick={openCreateUnit} className="rounded-lg bg-green-600 px-3 py-2 text-xs text-white">
                        <div className="flex items-center gap-1">
                          <Plus size={14} />
                          <span>Лот</span>
                        </div>
                      </button>
                    )}
                    <button onClick={() => openFloorPlan(selectedFloor)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">
                      План
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedUnits.map((unit) => {
                    const status = getUnitStatus(unit.status_id);
                    const statusCode = status?.code || "";
                    const statusClass =
                      statusCode === "free" ? "border-green-500/40 bg-green-500/10 text-green-300" :
                      statusCode === "reserved" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" :
                      statusCode === "sold" ? "border-red-500/40 bg-red-500/10 text-red-300" :
                      "border-gray-700 text-gray-300";

                    return (
                      <div key={unit.id} className={`${cardClass} p-3`}>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{getLotTypeLabel(unit.lot_type)} №{unit.unit_number}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass}`}>{status?.name || "Без статуса"}</span>
                            </div>
                            <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                              {formatArea(unit.area_total)} · {unit.rooms ?? "—"} ком · {formatMoney(unit.price_total, unit.currency, unit.currency_info)}
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/projects/${projectId}/sales/blocks/${selectedBlockId}/floors/${selectedFloor.id}/units/${unit.id}`)}
                            className={actionTileClass}
                            title="Открыть"
                          >
                            <Building2 size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => updateUnitStatus(unit, "reserved")}
                            disabled={saving || statusCode === "reserved"}
                            className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold text-gray-950 disabled:opacity-50"
                          >
                            Бронь
                          </button>
                          <button
                            onClick={() => updateUnitStatus(unit, "sold")}
                            disabled={saving || statusCode === "sold"}
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Выкуп
                          </button>
                          <button
                            onClick={() => openUnitClientModal(unit)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            <span className="inline-flex items-center gap-1">
                              <KeyRound size={13} />
                              Клиент
                            </span>
                          </button>
                          <button
                            onClick={() => openEditUnit(unit)}
                            className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Изменить
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!selectedUnits.length && (
                  <div className={`rounded-xl border border-dashed border-gray-700 p-4 text-center text-sm ${secondaryTextClass}`}>
                    На выбранном этаже пока нет лотов. Добавьте квартиру, помещение или паркинг.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "units" && (
          <>
            <div className={`${panelClass} mb-4 space-y-3`}>
              <button
                type="button"
                onClick={() => setBlockAssetsExpanded((value) => !value)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <div className={`text-sm font-semibold ${titleClass}`}>Фасад и шахматка</div>
                  <div className={`text-xs ${secondaryTextClass}`}>
                    Рендеры фасада храним отдельно от SVG-шахматки блока.
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {loadingBlockAssets && <span className={`text-xs ${secondaryTextClass}`}>Загрузка...</span>}
                  <span className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-white">
                    {blockAssetsExpanded ? "Свернуть" : "Открыть"}
                  </span>
                </div>
              </button>

              {blockAssetsExpanded && (
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(BLOCK_ASSET_TYPES).map(([kind, config]) => {
                  const files = blockAssetFiles[kind] || [];
                  const uploading = uploadingBlockAsset === kind;
                  const svgLimitReached = kind === "buildingView" && files.length > 0;

                  return (
                    <div key={kind} className={`${cardClass} p-3`}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{config.title}</div>
                          <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                            {kind === "buildingView"
                              ? "Один SVG-файл с кликабельными этажами."
                              : "Можно загрузить несколько изображений фасада."}
                          </div>
                        </div>
                        <span className="rounded-full bg-gray-800 px-2 py-1 text-[11px] text-gray-300">
                          {files.length}
                        </span>
                      </div>

                      {canManageCatalog && (
                        <label
                          className={`mb-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                            svgLimitReached
                              ? "cursor-not-allowed bg-gray-700 opacity-60"
                              : "cursor-pointer bg-blue-600 hover:bg-blue-500"
                          }`}
                        >
                          <Upload size={14} />
                          <span>{svgLimitReached ? "SVG уже загружен" : (uploading ? "Загрузка..." : config.uploadLabel)}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept={config.accept}
                            multiple={config.multiple}
                            disabled={uploading || svgLimitReached}
                            onChange={(event) => handleUploadBlockAsset(event, kind)}
                          />
                        </label>
                      )}

                      <div className="space-y-[6px]">
                        {files.length ? (
                          files.map((file) => (
                            <div key={file.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium">{file.name}</div>
                                <div className={`text-[11px] ${mutedTextClass}`}>{file.mime_type || "файл"}</div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSalesFile(file)}
                                  className="rounded bg-gray-800 p-2 text-white hover:bg-gray-700"
                                  title="Скачать"
                                >
                                  <Download size={13} />
                                </button>
                                {canManageCatalog && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBlockAssetFile(kind, file.id)}
                                    className="rounded bg-red-600 p-2 text-white hover:bg-red-500"
                                    title="Удалить"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className={`rounded-lg border border-dashed border-gray-700 px-3 py-4 text-center text-xs ${secondaryTextClass}`}>
                            Файлы пока не загружены
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {floors.length > 0 && (
              <div className="mb-4">
                {(blockAssetFiles.buildingView || [])[0] ? (
                  <BuildingViewBoard
                    file={(blockAssetFiles.buildingView || [])[0]}
                    floors={floors}
                    selectedFloorId={selectedFloorId}
                    onOpenFloor={openFloorPlan}
                    secondaryTextClass={secondaryTextClass}
                  />
                ) : (
                  <FacadeBoard
                    floors={floors}
                    selectedFloorId={selectedFloorId}
                    getFloorCounters={getFloorCounters}
                    onOpenFloor={openFloorPlan}
                  />
                )}
              </div>
            )}

            <div className={`${panelClass} mb-4 space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-semibold ${titleClass}`}>Этажи блока</div>
                  <div className={`text-xs ${secondaryTextClass}`}>Пока заполняем вручную, позже подключим Excel-импорт</div>
                </div>
                {canManageCatalog && (
                  <div className="flex gap-2">
                    <button onClick={openCreateFloor} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">
                      <div className="flex items-center gap-1">
                        <Plus size={14} />
                        <span>Этаж</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={
                      Number(selectedFloorId) === Number(floor.id)
                        ? "rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
                        : chipButtonClass
                    }
                  >
                    {getFloorLabel(floor)}
                  </button>
                ))}
              </div>

              {!floors.length && !loading && (
                <div className={`mt-3 text-center text-sm ${secondaryTextClass}`}>
                  Для этого блока пока нет этажей. Начните с кнопки «Этаж».
                </div>
              )}
            </div>



            {selectedFloor && (
              <div className={`${panelClass} mb-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">Выбран этаж: {getFloorLabel(selectedFloor)}</div>
                    <div className={`text-xs ${secondaryTextClass}`}>Лотов на этаже: {selectedUnits.length}</div>
                  </div>
                  <div className="flex gap-2">
                    {canManageCatalog && (
                      <>
                        {selectedUnits.length === 0 && (
                          <button
                            onClick={() => deleteFloor(selectedFloor)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500"
                            title="Удалить этаж"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button onClick={() => openEditFloor(selectedFloor)} className={actionTileClass}>
                          <Pencil size={14} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openFloorPlan(selectedFloor)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
                    >
                      Открыть этаж
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className={`${cardClass} p-2`}>
                    <div className={`text-xs ${mutedTextClass}`}>Свободно</div>
                    <div className="mt-1 text-sm font-semibold text-green-400">{getFloorCounters(selectedFloor).free}</div>
                  </div>
                  <div className={`${cardClass} p-2`}>
                    <div className={`text-xs ${mutedTextClass}`}>Бронь</div>
                    <div className="mt-1 text-sm font-semibold text-yellow-300">{getFloorCounters(selectedFloor).reserved}</div>
                  </div>
                  <div className={`${cardClass} p-2`}>
                    <div className={`text-xs ${mutedTextClass}`}>Продано</div>
                    <div className="mt-1 text-sm font-semibold text-red-400">{getFloorCounters(selectedFloor).sold}</div>
                  </div>
                  <div className={`${cardClass} p-2`}>
                    <div className={`text-xs ${mutedTextClass}`}>Лотов</div>
                    <div className="mt-1 text-sm font-semibold">{selectedUnits.length}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "leads" && (
          <>
            <div className={`${panelClass} mb-4 space-y-3`}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className={`absolute left-3 top-3 ${secondaryTextClass}`} />
                  <input
                    value={leadInputSearch}
                    onChange={(e) => setLeadInputSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setLeadPage(1);
                        setLeadSearch(leadInputSearch.trim());
                      }
                    }}
                    placeholder="Поиск лидов..."
                    className={inputClass}
                  />
                </div>
                <button
                  onClick={() => {
                    setLeadPage(1);
                    setLeadSearch(leadInputSearch.trim());
                  }}
                  className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
                >
                  Go
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={leadStatusFilter}
                  onChange={(e) => {
                    setLeadPage(1);
                    setLeadStatusFilter(e.target.value);
                  }}
                  className={modalInputClass}
                >
                  <option value="">Все статусы</option>
                  {leadStatuses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <button onClick={openCreateLead} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white">
                  <div className="flex items-center gap-2">
                    <Plus size={16} />
                    <span>Лид</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-[2px]">
              {leads.map((lead) => {
                const status = getLeadStatus(lead.status_id);
                const source = getLeadSource(lead.source_id);
                const isMine = Number(lead.manager_user_id) === Number(user?.id);
                const isLockedByOther = lead.manager_user_id && !isMine && Boolean(lead.is_locked);

                return (
                  <div key={lead.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{lead.full_name || "Без имени"}</div>
                        <div className={`mt-1 flex items-center gap-1 text-xs ${secondaryTextClass}`}>
                          <Phone size={12} />
                          <span>{lead.phone || "—"}</span>
                        </div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>
                          {status?.name || "Без статуса"}
                          {source?.name ? ` • ${source.name}` : ""}
                        </div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>ИНН: {lead.inn || "—"}</div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>
                          Блок: {projectBlocks.find((item) => Number(item.id) === Number(lead.block_id))?.label || "—"}
                        </div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>
                          Менеджер: {lead.manager_user_id ? getUserName(lead.manager_user_id) : "не закреплен"}
                        </div>
                        <div className={`mt-1 text-[11px] ${mutedTextClass}`}>{formatDateTime(lead.created_at)}</div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button onClick={() => openSalesFiles("lead", lead)} className={actionTileClass} title="Файлы">
                          <FileText size={14} />
                        </button>
                        {!isLockedByOther && (
                          <button onClick={() => openEditLead(lead)} className={actionTileClass}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {!lead.client_id && (
                          <button onClick={() => openConvertLeadModal(lead)} className="rounded bg-emerald-600 px-3 py-2 text-xs text-white">
                            В клиента
                          </button>
                        )}
                        {!lead.manager_user_id && (
                          <button onClick={() => claimLead(lead.id)} className="rounded bg-blue-600 px-3 py-2 text-xs text-white">
                            Забрать
                          </button>
                        )}
                        {isLockedByOther && canOverrideOwnership && (
                          <button onClick={() => claimLead(lead.id)} className="rounded bg-orange-600 px-3 py-2 text-xs text-white">
                            Перезабрать
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!leads.length && !loading && <div className={`py-8 text-center text-sm ${secondaryTextClass}`}>Лидов пока нет</div>}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setLeadPage((prev) => Math.max(prev - 1, 1))} disabled={leadPage <= 1} className={subtleButtonClass}>
                Назад
              </button>
              <div className="text-sm">{leadPage} / {leadsPagination?.pages || 1}</div>
              <button
                onClick={() => setLeadPage((prev) => prev + 1)}
                disabled={!leadsPagination?.hasNext}
                className={subtleButtonClass}
              >
                Далее
              </button>
            </div>
          </>
        )}

        {activeTab === "clients" && (
          <>
            <div className={`${panelClass} mb-4 space-y-3`}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className={`absolute left-3 top-3 ${secondaryTextClass}`} />
                  <input
                    value={clientInputSearch}
                    onChange={(e) => setClientInputSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setClientPage(1);
                        setClientSearch(clientInputSearch.trim());
                      }
                    }}
                    placeholder="Поиск клиентов..."
                    className={inputClass}
                  />
                </div>
                <button
                  onClick={() => {
                    setClientPage(1);
                    setClientSearch(clientInputSearch.trim());
                  }}
                  className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
                >
                  Go
                </button>
              </div>

              <div className="flex justify-end">
                <button onClick={openCreateClient} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white">
                  <div className="flex items-center gap-2">
                    <Plus size={16} />
                    <span>Клиент</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-[2px]">
              {clients.map((client) => {
                const isMine = Number(client.manager_user_id) === Number(user?.id);
                const isLockedByOther = client.manager_user_id && !isMine && Boolean(client.is_locked);
                const name = client.full_name || [client.last_name, client.first_name, client.middle_name].filter(Boolean).join(" ") || "Без имени";

                return (
                  <div key={client.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{name}</div>
                        <div className={`mt-1 flex items-center gap-1 text-xs ${secondaryTextClass}`}>
                          <Phone size={12} />
                          <span>{client.phone || "—"}</span>
                        </div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>Email: {client.email || "—"}</div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>
                          Менеджер: {client.manager_user_id ? getUserName(client.manager_user_id) : "не закреплен"}
                        </div>
                        {client.sales_unit ? (
                          <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                            {client.sales_project?.name || project?.name || "Объект"} · {client.sales_block?.name || "Блок"} · {getFloorLabel(client.sales_floor)} · №{client.sales_unit.unit_number || client.sales_unit.id}
                          </div>
                        ) : null}
                        <div className={`mt-1 text-[11px] ${mutedTextClass}`}>{formatDateTime(client.created_at)}</div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button onClick={() => openSalesFiles("client", client)} className={actionTileClass} title="Файлы">
                          <FileText size={14} />
                        </button>
                        {!isLockedByOther && (
                          <button onClick={() => openEditClient(client)} className={actionTileClass}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {!client.manager_user_id && (
                          <button onClick={() => claimClient(client.id)} className="rounded bg-blue-600 px-3 py-2 text-xs text-white">
                            Забрать
                          </button>
                        )}
                        {isLockedByOther && canOverrideOwnership && (
                          <button onClick={() => claimClient(client.id)} className="rounded bg-orange-600 px-3 py-2 text-xs text-white">
                            Перезабрать
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!clients.length && !loading && <div className={`py-8 text-center text-sm ${secondaryTextClass}`}>Клиентов пока нет</div>}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))} disabled={clientPage <= 1} className={subtleButtonClass}>
                Назад
              </button>
              <div className="text-sm">{clientPage} / {clientsPagination?.pages || 1}</div>
              <button
                onClick={() => setClientPage((prev) => prev + 1)}
                disabled={!clientsPagination?.hasNext}
                className={subtleButtonClass}
              >
                Далее
              </button>
            </div>
          </>
        )}
      </PullToRefresh>

      {filesModalEntity ? (() => {
        const meta = getSalesFilesMeta(filesModalEntity.kind, filesModalEntity.entity);

        return (
          <Modal title={meta.title} subtitle={meta.name} onClose={closeSalesFiles}>
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500">
                <Upload size={16} />
                <span>{uploadingFiles ? "Загрузка..." : "Загрузить файлы"}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploadingFiles}
                  onChange={handleUploadSalesFiles}
                />
              </label>

              <div className="space-y-[6px]">
                {loadingFiles ? (
                  <div className="rounded-xl border border-dashed border-gray-700 px-4 py-6 text-center text-sm text-gray-400">
                    Загружаем файлы...
                  </div>
                ) : salesFiles.length ? (
                  salesFiles.map((file) => (
                    <div key={file.id} className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{file.name}</div>
                          <div className="mt-1 text-xs text-gray-400">{file.mime_type || "файл"}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadSalesFile(file)}
                            className="rounded-lg bg-gray-800 p-2 text-white hover:bg-gray-700"
                            title="Скачать"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSalesFile(file.id)}
                            className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-500"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-700 px-4 py-6 text-center text-sm text-gray-400">
                    Файлы пока не прикреплены
                  </div>
                )}
              </div>
            </div>
          </Modal>
        );
      })() : null}

      {unitClientModalOpen && unitClientTarget && (
        <Modal
          title="Клиент на квартиру"
          subtitle={`${getLotTypeLabel(unitClientTarget.lot_type)} №${unitClientTarget.unit_number}`}
          onClose={closeUnitClientModal}
        >
          <form onSubmit={saveUnitClient} className="space-y-3">
            <Field label="Существующий клиент">
              <select
                value={unitClientForm.client_id}
                onChange={(e) => setUnitClientForm((prev) => ({ ...prev, client_id: e.target.value }))}
                className={modalInputClass}
              >
                <option value="">Создать нового / не выбран</option>
                {clients.map((client) => {
                  const name = client.full_name || [client.last_name, client.first_name, client.middle_name].filter(Boolean).join(" ") || `Клиент №${client.id}`;
                  return (
                    <option key={client.id} value={client.id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </Field>

            <Field label="Тип сделки">
              <select
                value={unitClientForm.deal_type_id}
                onChange={(e) => setUnitClientForm((prev) => ({ ...prev, deal_type_id: e.target.value }))}
                className={modalInputClass}
              >
                <option value="">Не выбран</option>
                {dealTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            {!unitClientForm.client_id && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Фамилия">
                    <input
                      value={unitClientForm.last_name}
                      onChange={(e) => setUnitClientForm((prev) => ({ ...prev, last_name: e.target.value }))}
                      className={modalInputClass}
                    />
                  </Field>
                  <Field label="Имя">
                    <input
                      value={unitClientForm.first_name}
                      onChange={(e) => setUnitClientForm((prev) => ({ ...prev, first_name: e.target.value }))}
                      className={modalInputClass}
                    />
                  </Field>
                </div>
                <Field label="Отчество">
                  <input
                    value={unitClientForm.middle_name}
                    onChange={(e) => setUnitClientForm((prev) => ({ ...prev, middle_name: e.target.value }))}
                    className={modalInputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Телефон">
                    <input
                      value={unitClientForm.phone}
                      onChange={(e) => setUnitClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className={modalInputClass}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      value={unitClientForm.email}
                      onChange={(e) => setUnitClientForm((prev) => ({ ...prev, email: e.target.value }))}
                      className={modalInputClass}
                    />
                  </Field>
                </div>
              </>
            )}

            <Field label="Комментарий">
              <textarea
                value={unitClientForm.comment}
                onChange={(e) => setUnitClientForm((prev) => ({ ...prev, comment: e.target.value }))}
                className={`${modalInputClass} min-h-[84px]`}
              />
            </Field>

            <button disabled={saving} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Сохранение..." : "Добавить клиента к лоту"}
            </button>
          </form>
        </Modal>
      )}

      {convertModalOpen && (
        <Modal
          title="Создать клиента"
          subtitle={`${convertingLead?.full_name || convertingLead?.phone || "Лид"} · ${project?.name || "Объект"}`}
          onClose={closeConvertLeadModal}
        >
          <div className="space-y-3">
            <Field label="Объект">
              <input value={project?.name || ""} readOnly className={`${modalInputClass} opacity-80`} />
            </Field>

            <Field label="Блок">
              <select value={convertForm.block_id} onChange={(e) => updateConvertBlock(e.target.value)} className={modalInputClass}>
                <option value="">Выберите блок</option>
                {projectBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.label || block.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Этаж">
                <select
                  value={convertForm.floor_id}
                  onChange={(e) => setConvertForm((prev) => ({ ...prev, floor_id: e.target.value, unit_id: "" }))}
                  className={modalInputClass}
                  disabled={!convertForm.block_id || convertLoading}
                >
                  <option value="">{convertLoading ? "Загрузка..." : "Выберите этаж"}</option>
                  {convertFloors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {getFloorLabel(floor)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Квартира">
                <select
                  value={convertForm.unit_id}
                  onChange={(e) => setConvertForm((prev) => ({ ...prev, unit_id: e.target.value }))}
                  className={modalInputClass}
                  disabled={!convertForm.floor_id}
                >
                  <option value="">Выберите квартиру</option>
                  {convertUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {getUnitOptionLabel(unit)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button disabled={saving || convertLoading} onClick={convertLeadToClient} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Создание..." : "Создать клиента и привязать"}
            </button>
          </div>
        </Modal>
      )}

      {floorModalOpen && (
        <Modal title={editingFloor ? "Редактировать этаж" : "Новый этаж"} subtitle={selectedBlock?.label || ""} onClose={closeFloorModal}>
          <form onSubmit={saveFloor} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Номер по счету">
                <input
                  type="number"
                  value={floorForm.floor_number}
                  onChange={(e) => setFloorForm((prev) => ({ ...prev, floor_number: e.target.value }))}
                  className={modalInputClass}
                  placeholder="6"
                />
              </Field>
              <Field label="Название">
                <input
                  value={floorForm.name}
                  onChange={(e) => setFloorForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={modalInputClass}
                  placeholder="Мансарда"
                />
              </Field>
            </div>
            <Field label="Порядок сортировки">
              <input
                value={floorForm.sort_order}
                onChange={(e) => setFloorForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                className={modalInputClass}
              />
            </Field>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm text-white disabled:opacity-60">
              {saving ? "Сохранение..." : editingFloor ? "Сохранить этаж" : "Создать этаж"}
            </button>
          </form>
        </Modal>
      )}

      {unitModalOpen && (
        <Modal title={editingUnit ? "Редактировать лот" : "Новый лот"} subtitle={selectedBlock?.label || ""} onClose={closeUnitModal}>
          <form onSubmit={saveUnit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Этаж">
                <select
                  value={unitForm.floor_id}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, floor_id: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="">Выберите этаж</option>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {getFloorLabel(floor)}
                    </option>
                  ))}
                </select>
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
                <input
                  value={unitForm.unit_number}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, unit_number: e.target.value }))}
                  className={modalInputClass}
                />
              </Field>
              <Field label="Статус">
                <select
                  value={unitForm.status_id}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, status_id: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="">Выберите статус</option>
                  {unitStatuses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Комнат">
                <input
                  value={unitForm.rooms}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, rooms: e.target.value }))}
                  className={modalInputClass}
                />
              </Field>
              <Field label="Площадь">
                <input
                  value={unitForm.area_total}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, area_total: normalizeDecimalInput(e.target.value) }))}
                  className={modalInputClass}
                />
              </Field>
              <Field label="Валюта">
                <select
                  value={unitForm.currency}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="">Р’С‹Р±РµСЂРёС‚Рµ РІР°Р»СЋС‚Сѓ</option>
                  {currencies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code || item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Цена">
              <input
                value={unitForm.price_total}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, price_total: normalizeDecimalInput(e.target.value) }))}
                className={modalInputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Код плана">
                <input
                  value={unitCodePreview}
                  className={modalInputClass}
                  disabled
                />
              </Field>
              <Field label="Внешний код">
                <input
                  value={unitCodePreview}
                  className={modalInputClass}
                  disabled
                />
              </Field>
            </div>

            <Field label="Комментарий">
              <textarea
                rows={3}
                value={unitForm.description}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, description: e.target.value }))}
                className={modalInputClass}
              />
            </Field>

            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm text-white disabled:opacity-60">
              {saving ? "Сохранение..." : editingUnit ? "Сохранить лот" : "Создать лот"}
            </button>
          </form>
        </Modal>
      )}

      {leadModalOpen && (
        <Modal title={editingLead ? "Редактировать лида" : "Новый лид"} subtitle={selectedBlock?.label || project?.name || ""} onClose={closeLeadModal}>
          <form onSubmit={saveLead} className="space-y-3">
            <Field label="Имя">
              <input value={leadForm.full_name} onChange={(e) => setLeadForm((prev) => ({ ...prev, full_name: e.target.value }))} className={modalInputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Телефон">
                <input value={leadForm.phone} onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Email">
                <input value={leadForm.email} onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))} className={modalInputClass} />
              </Field>
            </div>
            <Field label="ИНН">
                      <input
                        value={leadForm.inn}
                        onChange={(e) => setLeadForm((prev) => ({ ...prev, inn: normalizeInnInput(e.target.value) }))}
                        inputMode="numeric"
                        maxLength={14}
                        className={modalInputClass}
                      />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Статус">
                <select value={leadForm.status_id} onChange={(e) => setLeadForm((prev) => ({ ...prev, status_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Выберите статус</option>
                  {leadStatuses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Источник">
                <select value={leadForm.source_id} onChange={(e) => setLeadForm((prev) => ({ ...prev, source_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбран</option>
                  {leadSources.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Комнат">
                <input value={leadForm.interest_rooms} onChange={(e) => setLeadForm((prev) => ({ ...prev, interest_rooms: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Бюджет от">
                <input value={leadForm.interest_budget_from} onChange={(e) => setLeadForm((prev) => ({ ...prev, interest_budget_from: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Бюджет до">
                <input value={leadForm.interest_budget_to} onChange={(e) => setLeadForm((prev) => ({ ...prev, interest_budget_to: e.target.value }))} className={modalInputClass} />
              </Field>
            </div>
            <Field label="Комментарий">
              <textarea rows={3} value={leadForm.comment} onChange={(e) => setLeadForm((prev) => ({ ...prev, comment: e.target.value }))} className={modalInputClass} />
            </Field>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm text-white disabled:opacity-60">
              {saving ? "Сохранение..." : editingLead ? "Сохранить лид" : "Создать лид"}
            </button>
          </form>
        </Modal>
      )}

      {clientModalOpen && (
        <Modal title={editingClient ? "Редактировать клиента" : "Новый клиент"} subtitle={project?.name || ""} onClose={closeClientModal}>
          <form onSubmit={saveClient} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Фамилия">
                <input value={clientForm.last_name} onChange={(e) => setClientForm((prev) => ({ ...prev, last_name: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Имя">
                <input value={clientForm.first_name} onChange={(e) => setClientForm((prev) => ({ ...prev, first_name: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Отчество">
                <input value={clientForm.middle_name} onChange={(e) => setClientForm((prev) => ({ ...prev, middle_name: e.target.value }))} className={modalInputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Телефон">
                <input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Доп. телефон">
                <input value={clientForm.phone_extra} onChange={(e) => setClientForm((prev) => ({ ...prev, phone_extra: e.target.value }))} className={modalInputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className={modalInputClass} />
              </Field>
              <Field label="Паспорт">
                <input value={clientForm.passport_number} onChange={(e) => setClientForm((prev) => ({ ...prev, passport_number: e.target.value }))} className={modalInputClass} />
              </Field>
            </div>
            <Field label="ПИН">
              <input value={clientForm.pin} onChange={(e) => setClientForm((prev) => ({ ...prev, pin: e.target.value }))} className={modalInputClass} />
            </Field>
            <Field label="Адрес">
              <input value={clientForm.address} onChange={(e) => setClientForm((prev) => ({ ...prev, address: e.target.value }))} className={modalInputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Блок">
                <select value={clientForm.block_id} onChange={(e) => updateClientBlock(e.target.value)} className={modalInputClass}>
                  <option value="">Не выбран</option>
                  {projectBlocks.map((block) => (
                    <option key={block.id} value={block.id}>{block.label || block.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Этаж">
                <select
                  value={clientForm.floor_id}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, floor_id: e.target.value, unit_id: "" }))}
                  className={modalInputClass}
                  disabled={!clientForm.block_id || clientFloorsLoading}
                >
                  <option value="">{clientFloorsLoading ? "Загрузка..." : "Не выбран"}</option>
                  {clientFloors.map((floor) => (
                    <option key={floor.id} value={floor.id}>{getFloorLabel(floor)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Квартира">
              <select value={clientForm.unit_id} onChange={(e) => setClientForm((prev) => ({ ...prev, unit_id: e.target.value }))} className={modalInputClass} disabled={!clientForm.floor_id}>
                <option value="">Не выбрана</option>
                {clientUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{getUnitOptionLabel(unit)}</option>
                ))}
              </select>
            </Field>
            <Field label="Комментарий">
              <textarea rows={3} value={clientForm.comment} onChange={(e) => setClientForm((prev) => ({ ...prev, comment: e.target.value }))} className={modalInputClass} />
            </Field>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm text-white disabled:opacity-60">
              {saving ? "Сохранение..." : editingClient ? "Сохранить клиента" : "Создать клиента"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
