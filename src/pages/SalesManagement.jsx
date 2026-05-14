import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Filter,
  Grid3X3,
  Home,
  Layers,
  ListChecks,
  MessageCircle,
  ParkingCircle,
  Phone,
  RefreshCw,
  Search,
  Store,
  UserCheck,
  UserPlus,
  Warehouse
} from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { getRequest, postRequest, putRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const LOT_TYPES = [
  { value: "", label: "Все типы", short: "Все", icon: Grid3X3 },
  { value: "apartment", label: "Квартиры", short: "Квартиры", icon: Home },
  { value: "commercial", label: "Помещения", short: "Помещения", icon: Store },
  { value: "parking", label: "Паркинги", short: "Паркинги", icon: ParkingCircle },
  { value: "storage", label: "Кладовые", short: "Кладовые", icon: Warehouse }
];

const SORT_OPTIONS = [
  { value: "created_desc", label: "Новые" },
  { value: "price_asc", label: "Цена ↑" },
  { value: "price_desc", label: "Цена ↓" },
  { value: "area_asc", label: "Площадь ↑" },
  { value: "area_desc", label: "Площадь ↓" },
  { value: "floor_asc", label: "Этаж ↑" },
  { value: "floor_desc", label: "Этаж ↓" }
];

const ROOM_FILTERS = [
  { value: "", label: "Все" },
  { value: "0", label: "Студ." },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4+" }
];

const statusClasses = {
  free: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  reserved: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  sold: "border-red-500/40 bg-red-500/10 text-red-300",
  offmarket: "border-slate-500/40 bg-slate-500/10 text-slate-300"
};

const formatNumber = (value, digits = 0) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
};

const formatArea = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${formatNumber(num, Number.isInteger(num) ? 0 : 1)} м²`;
};

const formatMoney = (value, currency = "KGS") => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${formatNumber(num)} ${currency || "KGS"}`;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const getPhoneDigits = (phone) => String(phone || "").replace(/\D/g, "");
const getLotTypeMeta = (type) => LOT_TYPES.find((item) => item.value === type) || LOT_TYPES[0];

const EMPTY_LEAD_FORM = {
  project_id: "",
  block_id: "",
  status_id: "",
  source_id: "",
  full_name: "",
  phone: "",
  email: "",
  inn: "",
  comment: "",
  interest_rooms: "",
  interest_budget_from: "",
  interest_budget_to: ""
};

const EMPTY_STATUS_FORM = {
  name: "",
  color: "#3b82f6"
};

const STATUS_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#64748b"];

export default function SalesManagement() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("funnel");
  const [overviewProjects, setOverviewProjects] = useState([]);
  const [overviewBlocks, setOverviewBlocks] = useState([]);
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [leadColumns, setLeadColumns] = useState({});
  const [leadPagination, setLeadPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM);
  const [leadSaving, setLeadSaving] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState(EMPTY_STATUS_FORM);
  const [statusSaving, setStatusSaving] = useState(false);

  const [unitPage, setUnitPage] = useState(1);
  const [units, setUnits] = useState([]);
  const [unitsPagination, setUnitsPagination] = useState({ page: 1, pages: 1, hasNext: false, hasPrev: false, total: 0 });

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    project_id: "",
    block_id: "",
    lot_type: "",
    status_id: "",
    rooms: "",
    area_from: "",
    area_to: "",
    price_from: "",
    price_to: "",
    sort: "created_desc"
  });

  const pageClass = `space-y-4 ${themeText.page(isDark)}`;
  const cardClass = themeSurface.card(isDark);
  const panelClass = themeSurface.panel(isDark);
  const titleClass = themeText.title(isDark);
  const secondaryTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const inputClass = themeControl.modalInput(isDark);
  const searchInputClass = themeControl.input(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);

  const sortedProjects = useMemo(() => {
    return [...overviewProjects].sort((a, b) => {
      const byId = Number(a.id || 0) - Number(b.id || 0);
      if (byId !== 0) return byId;
      return String(a.name || "").localeCompare(String(b.name || ""), "ru");
    });
  }, [overviewProjects]);

  const blocksByProject = useMemo(() => {
    if (!filters.project_id) return overviewBlocks;
    return overviewBlocks.filter((block) => Number(block.project_id) === Number(filters.project_id));
  }, [filters.project_id, overviewBlocks]);

  const leadFormBlocks = useMemo(() => {
    if (!leadForm.project_id) return [];
    return overviewBlocks.filter((block) => Number(block.project_id) === Number(leadForm.project_id));
  }, [leadForm.project_id, overviewBlocks]);

  const totals = useMemo(() => {
    return overviewProjects.reduce((acc, project) => {
      acc.total_units += Number(project.total_units || 0);
      acc.free_units += Number(project.free_units || 0);
      acc.reserved_units += Number(project.reserved_units || 0);
      acc.sold_units += Number(project.sold_units || 0);
      acc.total_price += Number(project.total_price || 0);
      acc.free_price += Number(project.free_price || 0);
      acc.leads_count += Number(project.leads_count || 0);
      acc.clients_count += Number(project.clients_count || 0);
      return acc;
    }, {
      total_units: 0,
      free_units: 0,
      reserved_units: 0,
      sold_units: 0,
      total_price: 0,
      free_price: 0,
      leads_count: 0,
      clients_count: 0
    });
  }, [overviewProjects]);

  const getProjectName = (projectId) =>
    overviewProjects.find((item) => Number(item.id) === Number(projectId))?.name || "Объект";

  const getBlockName = (blockId) =>
    overviewBlocks.find((item) => Number(item.id) === Number(blockId))?.name || "Блок";

  const getLeadStatus = (statusId) =>
    leadStatuses.find((item) => Number(item.id) === Number(statusId));

  const getLeadSource = (sourceId) =>
    leadSources.find((item) => Number(item.id) === Number(sourceId));

  const getNextLeadStatus = (statusId) => {
    const index = leadStatuses.findIndex((item) => Number(item.id) === Number(statusId));
    if (index < 0 || index >= leadStatuses.length - 1) return null;
    return leadStatuses[index + 1];
  };

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, statusesRes, leadStatusesRes, leadSourcesRes] = await Promise.all([
        getRequest("/sales/objects/overview"),
        getRequest("/sales/unit-statuses"),
        getRequest("/sales/lead-statuses"),
        getRequest("/sales/lead-sources")
      ]);

      if (!overviewRes?.success) {
        toast.error(overviewRes?.message || "Не удалось загрузить отдел продаж");
        return;
      }

      setOverviewProjects(overviewRes.data?.projects || []);
      setOverviewBlocks(overviewRes.data?.blocks || []);
      setUnitStatuses(statusesRes?.success ? statusesRes.data || [] : []);
      setLeadStatuses(leadStatusesRes?.success ? leadStatusesRes.data || [] : []);
      setLeadSources(leadSourcesRes?.success ? leadSourcesRes.data || [] : []);
    } catch (error) {
      console.error("Sales overview load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки отдела продаж");
    } finally {
      setLoading(false);
    }
  };

  const loadLeadFunnel = async () => {
    if (!leadStatuses.length) {
      setLeadColumns({});
      setLeadPagination({});
      return;
    }

    try {
      setLeadsLoading(true);
      const responses = await Promise.all(
        leadStatuses.map((status) =>
          postRequest("/sales/leads/search", {
            project_id: filters.project_id ? Number(filters.project_id) : undefined,
            block_id: filters.block_id ? Number(filters.block_id) : undefined,
            status_id: Number(status.id),
            search: filters.search || undefined,
            page: 1,
            size: 30
          })
        )
      );

      const nextColumns = {};
      const nextPagination = {};
      responses.forEach((res, index) => {
        const statusId = Number(leadStatuses[index].id);
        nextColumns[statusId] = res?.success ? res.data || [] : [];
        nextPagination[statusId] = res?.pagination || { total: 0 };
      });
      setLeadColumns(nextColumns);
      setLeadPagination(nextPagination);
    } catch (error) {
      console.error("Sales lead funnel load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки воронки лидов");
    } finally {
      setLeadsLoading(false);
    }
  };

  const loadUnits = async (nextPage = unitPage, nextFilters = filters) => {
    try {
      setUnitsLoading(true);
      const roomValue = nextFilters.rooms === "4" ? [4, 5, 6, 7, 8, 9, 10] : nextFilters.rooms;
      const res = await postRequest("/sales/units/search", {
        project_id: nextFilters.project_id ? Number(nextFilters.project_id) : undefined,
        block_id: nextFilters.block_id ? Number(nextFilters.block_id) : undefined,
        lot_type: nextFilters.lot_type || undefined,
        status_id: nextFilters.status_id ? Number(nextFilters.status_id) : undefined,
        rooms: roomValue || undefined,
        area_from: nextFilters.area_from || undefined,
        area_to: nextFilters.area_to || undefined,
        price_from: nextFilters.price_from || undefined,
        price_to: nextFilters.price_to || undefined,
        search: nextFilters.search || undefined,
        sort: nextFilters.sort,
        page: nextPage,
        size: 12
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить лоты");
        return;
      }

      setUnits(res.data || []);
      setUnitsPagination(res.pagination || { page: nextPage, pages: 1, hasNext: false, hasPrev: false, total: 0 });
    } catch (error) {
      console.error("Sales units load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки лотов");
    } finally {
      setUnitsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab !== "units") return;
    loadUnits(unitPage, filters);
  }, [activeTab, unitPage, filters]);

  useEffect(() => {
    if (activeTab !== "funnel") return;
    loadLeadFunnel();
  }, [activeTab, leadStatuses, filters.project_id, filters.block_id, filters.search]);

  const handleRefresh = async () => {
    await loadOverview();
    if (activeTab === "units") {
      await loadUnits(unitPage, filters);
    }
    if (activeTab === "funnel") {
      await loadLeadFunnel();
    }
  };

  const updateFilters = (patch) => {
    setUnitPage(1);
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.project_id !== undefined) {
        next.block_id = "";
      }
      return next;
    });
  };

  const applySearch = () => {
    updateFilters({ search: searchInput.trim() });
  };

  const resetFilters = () => {
    setSearchInput("");
    setUnitPage(1);
    setFilters({
      search: "",
      project_id: "",
      block_id: "",
      lot_type: "",
      status_id: "",
      rooms: "",
      area_from: "",
      area_to: "",
      price_from: "",
      price_to: "",
      sort: "created_desc"
    });
  };

  const openCreateLead = (statusId = "") => {
    const defaultProjectId = filters.project_id || sortedProjects[0]?.id || "";
    const defaultStatusId = statusId || leadStatuses[0]?.id || "";
    const projectBlocks = defaultProjectId
      ? overviewBlocks.filter((block) => Number(block.project_id) === Number(defaultProjectId))
      : [];

    setLeadForm({
      ...EMPTY_LEAD_FORM,
      project_id: defaultProjectId ? String(defaultProjectId) : "",
      block_id: filters.block_id ? String(filters.block_id) : (projectBlocks[0]?.id ? String(projectBlocks[0].id) : ""),
      status_id: defaultStatusId ? String(defaultStatusId) : "",
      source_id: leadSources[0]?.id ? String(leadSources[0].id) : ""
    });
    setLeadModalOpen(true);
  };

  const closeLeadModal = () => {
    setLeadModalOpen(false);
    setLeadForm(EMPTY_LEAD_FORM);
  };

  const updateLeadForm = (patch) => {
    setLeadForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.project_id !== undefined) {
        const nextBlocks = patch.project_id
          ? overviewBlocks.filter((block) => Number(block.project_id) === Number(patch.project_id))
          : [];
        next.block_id = nextBlocks[0]?.id ? String(nextBlocks[0].id) : "";
      }
      return next;
    });
  };

  const saveLead = async () => {
    const fullName = leadForm.full_name.trim();
    const phone = leadForm.phone.trim();
    if (!leadForm.project_id) return toast.error("Выберите объект");
    if (!leadForm.status_id) return toast.error("Выберите статус");
    if (!fullName && !phone) return toast.error("Укажите имя или телефон лида");

    try {
      setLeadSaving(true);
      const res = await postRequest("/sales/leads/create", {
        project_id: Number(leadForm.project_id),
        block_id: leadForm.block_id ? Number(leadForm.block_id) : null,
        status_id: Number(leadForm.status_id),
        source_id: leadForm.source_id ? Number(leadForm.source_id) : null,
        full_name: fullName || null,
        phone: phone || null,
        email: leadForm.email.trim() || null,
        inn: leadForm.inn.trim() || null,
        comment: leadForm.comment.trim() || null,
        interest_rooms: leadForm.interest_rooms === "" ? null : Number(leadForm.interest_rooms),
        interest_budget_from: leadForm.interest_budget_from === "" ? null : Number(leadForm.interest_budget_from),
        interest_budget_to: leadForm.interest_budget_to === "" ? null : Number(leadForm.interest_budget_to)
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать лида");
        return;
      }

      toast.success("Лид создан");
      closeLeadModal();
      await Promise.all([loadOverview(), loadLeadFunnel()]);
    } catch (error) {
      console.error("Sales lead create error", error);
      toast.error(error?.response?.data?.message || "Ошибка создания лида");
    } finally {
      setLeadSaving(false);
    }
  };

  const openCreateStatus = () => {
    setStatusForm(EMPTY_STATUS_FORM);
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setStatusForm(EMPTY_STATUS_FORM);
  };

  const saveStatus = async () => {
    const name = statusForm.name.trim();
    if (!name) return toast.error("Укажите название статуса");

    try {
      setStatusSaving(true);
      const res = await postRequest("/sales/lead-statuses/create", {
        name,
        color: statusForm.color
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать статус");
        return;
      }

      toast.success("Статус создан");
      closeStatusModal();
      await loadOverview();
    } catch (error) {
      console.error("Sales lead status create error", error);
      toast.error(error?.response?.data?.message || "Ошибка создания статуса");
    } finally {
      setStatusSaving(false);
    }
  };

  const moveLeadToStatus = async (lead, statusId) => {
    try {
      setSavingLeadId(lead.id);
      const res = await putRequest(`/sales/leads/update/${lead.id}`, {
        status_id: Number(statusId)
      });
      if (!res?.success) {
        toast.error(res?.message || "Не удалось изменить статус лида");
        return;
      }
      toast.success("Статус лида обновлен");
      await loadLeadFunnel();
    } catch (error) {
      console.error("Sales lead status update error", error);
      toast.error(error?.response?.data?.message || "Ошибка изменения статуса лида");
    } finally {
      setSavingLeadId(null);
    }
  };

  const claimLead = async (lead) => {
    try {
      setSavingLeadId(lead.id);
      const res = await postRequest(`/sales/leads/claim/${lead.id}`, {});
      if (!res?.success) {
        toast.error(res?.message || "Не удалось закрепить лида");
        return;
      }
      toast.success(res.message || "Лид закреплен за вами");
      await loadLeadFunnel();
    } catch (error) {
      console.error("Sales lead claim error", error);
      toast.error(error?.response?.data?.message || "Ошибка закрепления лида");
    } finally {
      setSavingLeadId(null);
    }
  };

  const convertLeadToClient = async (lead) => {
    try {
      setSavingLeadId(lead.id);
      const res = await postRequest(`/sales/leads/convert-to-client/${lead.id}`, {});
      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать клиента из лида");
        return;
      }
      toast.success(res.message || "Клиент создан из лида");
      await Promise.all([loadOverview(), loadLeadFunnel()]);
    } catch (error) {
      console.error("Sales lead convert error", error);
      toast.error(error?.response?.data?.message || "Ошибка создания клиента из лида");
    } finally {
      setSavingLeadId(null);
    }
  };

  const getStatusMeta = (unit) => {
    const status = unit.status || unitStatuses.find((item) => Number(item.id) === Number(unit.status_id));
    return {
      label: status?.name || "Без статуса",
      code: status?.code || "",
      color: status?.color || null
    };
  };

  const openUnit = (unit) => {
    if (!unit.floor_id) {
      toast.error("У лота не указан этаж");
      return;
    }

    navigate(`/projects/${unit.project_id}/sales/blocks/${unit.block_id}/floors/${unit.floor_id}/units/${unit.id}`);
  };

  const renderProjectCard = (project) => {
    const soldPercent = Number(project.total_units || 0)
      ? Math.round((Number(project.sold_units || 0) / Number(project.total_units || 0)) * 100)
      : 0;

    const blocks = overviewBlocks.filter((block) => Number(block.project_id) === Number(project.id));

    return (
      <div key={project.id} className={`${cardClass} p-4`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{project.name}</div>
            <div className={`mt-1 text-xs ${secondaryTextClass}`}>{project.address || "Адрес не указан"}</div>
          </div>
          <button
            onClick={() => navigate(`/projects/${project.id}/sales`)}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Открыть
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-gray-800/70 p-2">
            <div className="text-base font-semibold">{project.total_units || 0}</div>
            <div className={`text-[10px] ${mutedTextClass}`}>Лотов</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
            <div className="text-base font-semibold">{project.free_units || 0}</div>
            <div className="text-[10px]">Своб.</div>
          </div>
          <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-300">
            <div className="text-base font-semibold">{project.reserved_units || 0}</div>
            <div className="text-[10px]">Бронь</div>
          </div>
          <div className="rounded-lg bg-red-500/10 p-2 text-red-300">
            <div className="text-base font-semibold">{project.sold_units || 0}</div>
            <div className="text-[10px]">Продано</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-gray-800 p-2">
            <div className={mutedTextClass}>Свободный фонд</div>
            <div className="mt-1 font-semibold">{formatMoney(project.free_price)}</div>
          </div>
          <div className="rounded-lg border border-gray-800 p-2">
            <div className={mutedTextClass}>Продажи</div>
            <div className="mt-1 font-semibold">{soldPercent}%</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-gray-700 px-2 py-1">Квартиры: {project.apartments || 0}</span>
          <span className="rounded-full border border-gray-700 px-2 py-1">Помещения: {project.commercial_units || 0}</span>
          <span className="rounded-full border border-gray-700 px-2 py-1">Паркинг: {project.parking_units || 0}</span>
          <span className="rounded-full border border-gray-700 px-2 py-1">Лиды: {project.leads_count || 0}</span>
          <span className="rounded-full border border-gray-700 px-2 py-1">Клиенты: {project.clients_count || 0}</span>
        </div>

        {blocks.length > 0 && (
          <div className="mt-3 space-y-1">
            {blocks.slice(0, 3).map((block) => (
              <button
                key={block.id}
                onClick={() => {
                  updateFilters({ project_id: String(project.id), block_id: String(block.id) });
                  setActiveTab("units");
                }}
                className="flex w-full items-center justify-between rounded-lg bg-gray-800/60 px-3 py-2 text-left text-xs hover:bg-gray-800"
              >
                <span>{block.name}</span>
                <span className={secondaryTextClass}>{block.free_units || 0} свободно из {block.total_units || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderUnitCard = (unit) => {
    const status = getStatusMeta(unit);
    const lotType = getLotTypeMeta(unit.lot_type);
    const floorNumber = unit.floor?.floor_number || "-";

    return (
      <button
        key={unit.id}
        onClick={() => openUnit(unit)}
        className={`${cardClass} w-full p-4 text-left transition hover:border-blue-500`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{lotType.short} №{unit.unit_number}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClasses[status.code] || "border-gray-700 text-gray-300"}`}>
                {status.label}
              </span>
            </div>
            <div className={`mt-1 text-xs ${secondaryTextClass}`}>
              {getProjectName(unit.project_id)} · {getBlockName(unit.block_id)} · {floorNumber} этаж
            </div>
          </div>
          <ArrowRight size={17} className="mt-1 shrink-0 text-blue-400" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-gray-800/70 p-2">
            <div className={`text-[10px] ${mutedTextClass}`}>Площадь</div>
            <div className="font-semibold">{formatArea(unit.area_total)}</div>
          </div>
          <div className="rounded-lg bg-gray-800/70 p-2">
            <div className={`text-[10px] ${mutedTextClass}`}>Комнат</div>
            <div className="font-semibold">{unit.rooms ?? "-"}</div>
          </div>
          <div className="rounded-lg bg-gray-800/70 p-2">
            <div className={`text-[10px] ${mutedTextClass}`}>Цена</div>
            <div className="truncate font-semibold">{formatMoney(unit.price_total, unit.currency)}</div>
          </div>
        </div>

        <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${mutedTextClass}`}>
          <span>Код: {unit.plan_code || "-"}</span>
          <span>Внешний: {unit.external_code || "-"}</span>
        </div>
      </button>
    );
  };

  const renderLeadCard = (lead) => {
    const nextStatus = getNextLeadStatus(lead.status_id);
    const source = getLeadSource(lead.source_id);
    const phoneDigits = getPhoneDigits(lead.phone);
    const leadTitle = lead.full_name || lead.phone || `Лид №${lead.id}`;
    const disabled = savingLeadId === lead.id;

    return (
      <div key={lead.id} className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{leadTitle}</div>
            <div className={`mt-1 text-[11px] ${secondaryTextClass}`}>{formatDateTime(lead.created_at)}</div>
          </div>
          {lead.client_id ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              Клиент
            </span>
          ) : (
            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300">
              Лид
            </span>
          )}
        </div>

        <div className={`mt-3 space-y-1 text-xs ${secondaryTextClass}`}>
          <div className="flex items-center gap-2">
            <Phone size={13} className="shrink-0 text-blue-300" />
            <span className="truncate">{lead.phone || "Телефон не указан"}</span>
          </div>
          <div className="truncate">{getProjectName(lead.project_id)} · {lead.block_id ? getBlockName(lead.block_id) : "Все блоки"}</div>
          {source && <div className="truncate">Источник: {source.name}</div>}
          {lead.manager_user_id && <div className="truncate">Менеджер ID: {lead.manager_user_id}</div>}
          {(lead.interest_budget_from || lead.interest_budget_to) && (
            <div className="truncate">
              Бюджет: {formatMoney(lead.interest_budget_from)} - {formatMoney(lead.interest_budget_to)}
            </div>
          )}
        </div>

        {lead.comment && (
          <div className="mt-3 line-clamp-2 rounded-lg bg-slate-800/70 px-3 py-2 text-xs text-slate-300">
            {lead.comment}
          </div>
        )}

        <div className="mt-3 grid grid-cols-4 gap-2">
          <a
            href={phoneDigits ? `tel:${phoneDigits}` : undefined}
            onClick={(event) => {
              if (!phoneDigits) event.preventDefault();
            }}
            className="flex h-9 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700"
            title="Позвонить"
          >
            <Phone size={15} />
          </a>
          <a
            href={phoneDigits ? `https://wa.me/${phoneDigits}` : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!phoneDigits) event.preventDefault();
            }}
            className="flex h-9 items-center justify-center rounded-lg bg-emerald-600/90 text-white hover:bg-emerald-500"
            title="WhatsApp"
          >
            <MessageCircle size={15} />
          </a>
          <button
            disabled={disabled}
            onClick={() => claimLead(lead)}
            className="flex h-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            title="Забрать лида"
          >
            <UserCheck size={15} />
          </button>
          <button
            disabled={disabled || Boolean(lead.client_id)}
            onClick={() => convertLeadToClient(lead)}
            className="flex h-9 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-50"
            title="Создать клиента"
          >
            <UserPlus size={15} />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {nextStatus ? (
            <button
              disabled={disabled}
              onClick={() => moveLeadToStatus(lead, nextStatus.id)}
              className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-yellow-400 disabled:opacity-50"
            >
              → {nextStatus.name}
            </button>
          ) : (
            <button disabled className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-500">
              Финальный
            </button>
          )}
          <button
            onClick={() => navigate(lead.project_id ? `/projects/${lead.project_id}/sales` : "/sales")}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"
          >
            Открыть
          </button>
        </div>
      </div>
    );
  };

  const renderFunnel = () => (
    <div className="space-y-3">
      <div className={`flex items-center justify-between text-xs ${secondaryTextClass}`}>
        <span className="flex items-center gap-1"><Filter size={14} /> Воронка по статусам лидов</span>
        <div className="flex gap-2">
          <button
            onClick={openCreateStatus}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <Layers size={14} />
            Статус
          </button>
          <button
            onClick={() => openCreateLead()}
            className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
          >
            <UserPlus size={14} />
            Лид
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {leadStatuses.map((status) => {
            const leads = leadColumns[Number(status.id)] || [];
            const total = leadPagination[Number(status.id)]?.total ?? leads.length;
            return (
              <div key={status.id} className="w-[285px] shrink-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{status.name}</div>
                    <div className={`mt-1 text-[11px] ${mutedTextClass}`}>Показано {leads.length} из {total}</div>
                  </div>
                  <button
                    onClick={() => openCreateLead(status.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700"
                    title="Создать лид в этом статусе"
                  >
                    <UserPlus size={15} />
                  </button>
                </div>

                <div className="space-y-2">
                  {leadsLoading ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-400">
                      Загрузка...
                    </div>
                  ) : leads.length ? (
                    leads.map(renderLeadCard)
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-400">
                      Лидов пока нет
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className={pageClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={19} className="text-blue-500" />
              <h1 className={`text-lg font-semibold ${titleClass}`}>Отдел продаж</h1>
            </div>
            <div className={`mt-1 text-sm ${secondaryTextClass}`}>Объекты, лоты, лиды и клиенты в одном рабочем месте</div>
          </div>
          <button onClick={handleRefresh} className={subtleButtonClass} disabled={loading || unitsLoading || leadsLoading}>
            <RefreshCw size={16} className={loading || unitsLoading || leadsLoading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className={`${panelClass} p-3`}>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setActiveTab("funnel")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "funnel" ? "bg-blue-600 text-white" : "bg-gray-800 text-white"}`}
            >
              Воронка
            </button>
            <button
              onClick={() => setActiveTab("objects")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "objects" ? "bg-blue-600 text-white" : "bg-gray-800 text-white"}`}
            >
              Объекты
            </button>
            <button
              onClick={() => setActiveTab("units")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "units" ? "bg-blue-600 text-white" : "bg-gray-800 text-white"}`}
            >
              Лоты
            </button>
            <button
              onClick={resetFilters}
              className="rounded-lg bg-gray-800 px-2 py-2 text-sm font-medium text-white"
            >
              Сброс
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className={`${cardClass} p-3`}>
            <div className={`text-[11px] ${mutedTextClass}`}>Всего</div>
            <div className="text-lg font-semibold">{totals.total_units}</div>
          </div>
          <div className={`${cardClass} p-3 text-emerald-300`}>
            <div className="text-[11px]">Своб.</div>
            <div className="text-lg font-semibold">{totals.free_units}</div>
          </div>
          <div className={`${cardClass} p-3 text-yellow-300`}>
            <div className="text-[11px]">Бронь</div>
            <div className="text-lg font-semibold">{totals.reserved_units}</div>
          </div>
          <div className={`${cardClass} p-3 text-red-300`}>
            <div className="text-[11px]">Продано</div>
            <div className="text-lg font-semibold">{totals.sold_units}</div>
          </div>
        </div>

        <div className={`${panelClass} p-3`}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder={activeTab === "funnel" ? "Поиск лида, телефона..." : "Поиск лота, кода..."}
                className={searchInputClass}
              />
            </div>
            <button onClick={applySearch} className="h-11 min-w-[56px] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500">
              Go
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={filters.project_id} onChange={(e) => updateFilters({ project_id: e.target.value })} className={inputClass}>
              <option value="">Все объекты</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <select value={filters.block_id} onChange={(e) => updateFilters({ block_id: e.target.value })} className={inputClass}>
              <option value="">Все блоки</option>
              {blocksByProject.map((block) => (
                <option key={block.id} value={block.id}>{block.name}</option>
              ))}
            </select>
          </div>

          {activeTab !== "funnel" && (
            <>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {LOT_TYPES.map(({ value, short, icon: Icon }) => (
                  <button
                    key={value || "all"}
                    onClick={() => {
                      updateFilters({ lot_type: value });
                      setActiveTab("units");
                    }}
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ${
                      filters.lot_type === value ? "bg-blue-600 text-white" : "bg-gray-800 text-white"
                    }`}
                  >
                    <Icon size={14} />
                    {short}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <select value={filters.status_id} onChange={(e) => updateFilters({ status_id: e.target.value })} className={inputClass}>
                  <option value="">Все статусы</option>
                  {unitStatuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
                <select value={filters.rooms} onChange={(e) => updateFilters({ rooms: e.target.value })} className={inputClass}>
                  {ROOM_FILTERS.map((room) => (
                    <option key={room.value || "all"} value={room.value}>{room.label} комн.</option>
                  ))}
                </select>
                <input value={filters.area_from} onChange={(e) => updateFilters({ area_from: e.target.value })} className={inputClass} inputMode="decimal" placeholder="Площадь от" />
                <input value={filters.area_to} onChange={(e) => updateFilters({ area_to: e.target.value })} className={inputClass} inputMode="decimal" placeholder="Площадь до" />
                <input value={filters.price_from} onChange={(e) => updateFilters({ price_from: e.target.value })} className={inputClass} inputMode="numeric" placeholder="Цена от" />
                <input value={filters.price_to} onChange={(e) => updateFilters({ price_to: e.target.value })} className={inputClass} inputMode="numeric" placeholder="Цена до" />
                <select value={filters.sort} onChange={(e) => updateFilters({ sort: e.target.value })} className="col-span-2 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {activeTab === "funnel" ? renderFunnel() : activeTab === "objects" ? (
          <div className="space-y-2">
            {sortedProjects.length ? sortedProjects.map(renderProjectCard) : (
              <div className={`${cardClass} p-6 text-center ${secondaryTextClass}`}>
                {loading ? "Загрузка объектов..." : "Объекты продаж пока не найдены"}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className={`flex items-center justify-between text-xs ${secondaryTextClass}`}>
              <span className="flex items-center gap-1"><Filter size={14} /> Найдено: {unitsPagination.total || 0}</span>
              <span className="flex items-center gap-1"><ListChecks size={14} /> {unitPage} / {unitsPagination.pages || 1}</span>
            </div>

            {unitsLoading ? (
              <div className={`${cardClass} p-6 text-center ${secondaryTextClass}`}>Загрузка лотов...</div>
            ) : units.length ? (
              units.map(renderUnitCard)
            ) : (
              <div className={`${cardClass} p-6 text-center ${secondaryTextClass}`}>По этим фильтрам лоты не найдены</div>
            )}

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                disabled={!unitsPagination.hasPrev}
                onClick={() => setUnitPage((prev) => Math.max(prev - 1, 1))}
                className={subtleButtonClass}
              >
                Назад
              </button>
              <span className="text-sm">{unitPage} / {unitsPagination.pages || 1}</span>
              <button
                disabled={!unitsPagination.hasNext}
                onClick={() => setUnitPage((prev) => prev + 1)}
                className={subtleButtonClass}
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {leadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 py-4 sm:items-center">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Новый лид</h2>
                  <div className={`mt-1 text-sm ${secondaryTextClass}`}>Карточка для воронки продаж</div>
                </div>
                <button onClick={closeLeadModal} className={subtleButtonClass}>
                  Закрыть
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-slate-400">
                  Объект
                  <select value={leadForm.project_id} onChange={(e) => updateLeadForm({ project_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Выберите объект</option>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>

                <label className="col-span-2 text-xs text-slate-400">
                  Блок
                  <select value={leadForm.block_id} onChange={(e) => updateLeadForm({ block_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Все блоки</option>
                    {leadFormBlocks.map((block) => (
                      <option key={block.id} value={block.id}>{block.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-slate-400">
                  Статус
                  <select value={leadForm.status_id} onChange={(e) => updateLeadForm({ status_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Выберите статус</option>
                    {leadStatuses.map((status) => (
                      <option key={status.id} value={status.id}>{status.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-slate-400">
                  Источник
                  <select value={leadForm.source_id} onChange={(e) => updateLeadForm({ source_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Не выбран</option>
                    {leadSources.map((source) => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </select>
                </label>

                <label className="col-span-2 text-xs text-slate-400">
                  Имя клиента
                  <input
                    value={leadForm.full_name}
                    onChange={(e) => updateLeadForm({ full_name: e.target.value })}
                    className={`${inputClass} mt-1`}
                    placeholder="ФИО или название"
                  />
                </label>

                <label className="text-xs text-slate-400">
                  Телефон
                  <input
                    value={leadForm.phone}
                    onChange={(e) => updateLeadForm({ phone: e.target.value })}
                    className={`${inputClass} mt-1`}
                    inputMode="tel"
                    placeholder="+996..."
                  />
                </label>

                <label className="text-xs text-slate-400">
                  ИНН
                  <input
                    value={leadForm.inn}
                    onChange={(e) => updateLeadForm({ inn: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                    className={`${inputClass} mt-1`}
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="14 цифр"
                  />
                </label>

                <label className="col-span-2 text-xs text-slate-400">
                  Email
                  <input
                    value={leadForm.email}
                    onChange={(e) => updateLeadForm({ email: e.target.value })}
                    className={`${inputClass} mt-1`}
                    inputMode="email"
                    placeholder="email@example.com"
                  />
                </label>

                <label className="text-xs text-slate-400">
                  Комнат
                  <input
                    value={leadForm.interest_rooms}
                    onChange={(e) => updateLeadForm({ interest_rooms: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    className={`${inputClass} mt-1`}
                    inputMode="numeric"
                  />
                </label>

                <label className="text-xs text-slate-400">
                  Бюджет от
                  <input
                    value={leadForm.interest_budget_from}
                    onChange={(e) => updateLeadForm({ interest_budget_from: e.target.value.replace(/[^\d.]/g, "") })}
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                  />
                </label>

                <label className="col-span-2 text-xs text-slate-400">
                  Бюджет до
                  <input
                    value={leadForm.interest_budget_to}
                    onChange={(e) => updateLeadForm({ interest_budget_to: e.target.value.replace(/[^\d.]/g, "") })}
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                  />
                </label>

                <label className="col-span-2 text-xs text-slate-400">
                  Комментарий
                  <textarea
                    value={leadForm.comment}
                    onChange={(e) => updateLeadForm({ comment: e.target.value })}
                    className={`${inputClass} mt-1 min-h-24 resize-none`}
                    placeholder="Что интересует, когда перезвонить..."
                  />
                </label>
              </div>

              <button
                onClick={saveLead}
                disabled={leadSaving}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                <UserPlus size={17} />
                {leadSaving ? "Создаем..." : "Создать карточку"}
              </button>
            </div>
          </div>
        )}

        {statusModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 py-4 sm:items-center">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Новый статус</h2>
                  <div className={`mt-1 text-sm ${secondaryTextClass}`}>Новая колонка воронки лидов</div>
                </div>
                <button onClick={closeStatusModal} className={subtleButtonClass}>
                  Закрыть
                </button>
              </div>

              <label className="text-xs text-slate-400">
                Название
                <input
                  value={statusForm.name}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={`${inputClass} mt-1`}
                  placeholder="Например: Нет WhatsApp"
                />
              </label>

              <div className="mt-4">
                <div className="mb-2 text-xs text-slate-400">Цвет</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setStatusForm((prev) => ({ ...prev, color }))}
                      className={`h-9 w-9 rounded-full border-2 ${statusForm.color === color ? "border-white" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={saveStatus}
                disabled={statusSaving}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                <Layers size={17} />
                {statusSaving ? "Создаем..." : "Создать статус"}
              </button>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
