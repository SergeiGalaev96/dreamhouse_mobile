import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  Warehouse
} from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
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
  { value: "", label: "Все комн." },
  { value: "0", label: "Студия" },
  { value: "1", label: "1 комн." },
  { value: "2", label: "2 комн." },
  { value: "3", label: "3 комн." },
  { value: "4", label: "4+ комн." }
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
  const currencyCode = typeof currency === "object" ? currency?.code : currency;
  return `${formatNumber(num)} ${currencyCode || "KGS"}`;
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
  }).replace(",", "");
};

const getPhoneDigits = (phone) => String(phone || "").replace(/\D/g, "");
const getLotTypeMeta = (type) => LOT_TYPES.find((item) => item.value === type) || LOT_TYPES[0];
const getCreatedTime = (item) => {
  const time = new Date(item?.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const formatKyrgyzPhone = (digits) => {
  const local = String(digits || "").replace(/\D/g, "").replace(/^996/, "").slice(0, 9);
  const parts = [];

  if (local.slice(0, 3)) parts.push(local.slice(0, 3));
  if (local.slice(3, 5)) parts.push(local.slice(3, 5));
  if (local.slice(5, 7)) parts.push(local.slice(5, 7));
  if (local.slice(7, 9)) parts.push(local.slice(7, 9));

  if (!parts.length) return "+996 ";
  return `+996 ${parts[0]}${parts[1] ? ` ${parts[1]}` : ""}${parts[2] ? `-${parts[2]}` : ""}${parts[3] ? `-${parts[3]}` : ""}`;
};

const formatLeadPhoneInput = (value, previousValue = "") => {
  const raw = String(value || "");
  const trimmed = raw.trim();

  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "").slice(0, 15);
    if (!digits) return "+";
    if (digits.startsWith("996")) return formatKyrgyzPhone(digits);
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, "").slice(0, 15);
  if (!digits) return "";

  if (digits.startsWith("996") || previousValue.startsWith("+996")) {
    return formatKyrgyzPhone(digits.startsWith("996") ? digits : `996${digits}`);
  }

  return `+${digits}`;
};

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
  id: "",
  name: "",
  color: "#3b82f6"
};

const EMPTY_CONVERT_FORM = {
  project_id: "",
  block_id: "",
  floor_id: "",
  unit_id: ""
};

const STATUS_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#64748b"];

export default function SalesManagement() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("objects");
  const [overviewProjects, setOverviewProjects] = useState([]);
  const [overviewBlocks, setOverviewBlocks] = useState([]);
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [dictionaries, setDictionaries] = useState({ users: [] });
  const [leadColumns, setLeadColumns] = useState({});
  const [leadPagination, setLeadPagination] = useState({});
  const [clients, setClients] = useState([]);
  const [clientPage, setClientPage] = useState(1);
  const [clientsPagination, setClientsPagination] = useState({ page: 1, pages: 1, hasNext: false, hasPrev: false, total: 0 });
  const [loading, setLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM);
  const [leadSaving, setLeadSaving] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState(EMPTY_STATUS_FORM);
  const [statusSaving, setStatusSaving] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(null);
  const [convertForm, setConvertForm] = useState(EMPTY_CONVERT_FORM);
  const [convertFloors, setConvertFloors] = useState([]);
  const [convertLoading, setConvertLoading] = useState(false);

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
  const inactiveTabClass = isDark
    ? "bg-gray-800 text-white hover:bg-gray-700"
    : "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200";
  const softTileClass = isDark
    ? "bg-gray-800/70 text-white"
    : "border border-slate-200 bg-slate-50 text-slate-900";
  const softActionClass = isDark
    ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100";
  const chipClass = isDark
    ? "border-gray-700 text-gray-200"
    : "border-slate-300 bg-white text-slate-700";
  const borderedBoxClass = isDark
    ? "border-gray-800"
    : "border-slate-300 bg-white";
  const modalPanelClass = isDark
    ? "border-slate-700 bg-slate-900 text-white"
    : "border-slate-200 bg-white text-slate-950";
  const labelClass = isDark ? "text-slate-400" : "text-slate-600";
  const emptyBoxClass = isDark
    ? "border-slate-700 text-slate-400"
    : "border-slate-300 bg-slate-50 text-slate-500";
  const getStatusBadgeClass = (code) => {
    if (isDark) return statusClasses[code] || "border-gray-700 text-gray-300";
    const light = {
      free: "border-emerald-500/40 bg-emerald-50 text-emerald-700",
      reserved: "border-yellow-500/50 bg-yellow-50 text-yellow-700",
      sold: "border-red-500/40 bg-red-50 text-red-700",
      offmarket: "border-slate-400 bg-slate-100 text-slate-700"
    };
    return light[code] || "border-slate-300 bg-white text-slate-700";
  };

  const sortedProjects = useMemo(() => {
    return [...overviewProjects].sort((a, b) => {
      const byCreatedAt = getCreatedTime(b) - getCreatedTime(a);
      if (byCreatedAt !== 0) return byCreatedAt;
      const byId = Number(b.id || 0) - Number(a.id || 0);
      if (byId !== 0) return byId;
      return String(a.name || "").localeCompare(String(b.name || ""), "ru");
    });
  }, [overviewProjects]);

  const blocksByProject = useMemo(() => {
    const rows = filters.project_id
      ? overviewBlocks.filter((block) => Number(block.project_id) === Number(filters.project_id))
      : overviewBlocks;
    return [...rows].sort((a, b) => {
      const byCreatedAt = getCreatedTime(a) - getCreatedTime(b);
      if (byCreatedAt !== 0) return byCreatedAt;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }, [filters.project_id, overviewBlocks]);

  const leadFormBlocks = useMemo(() => {
    if (!leadForm.project_id) return [];
    return overviewBlocks.filter((block) => Number(block.project_id) === Number(leadForm.project_id));
  }, [leadForm.project_id, overviewBlocks]);

  const convertBlocks = useMemo(() => {
    if (!convertForm.project_id) return [];
    return overviewBlocks.filter((block) => Number(block.project_id) === Number(convertForm.project_id));
  }, [convertForm.project_id, overviewBlocks]);

  const convertUnits = useMemo(() => {
    const floor = convertFloors.find((item) => Number(item.id) === Number(convertForm.floor_id));
    return floor?.units || [];
  }, [convertFloors, convertForm.floor_id]);

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

  const getUserName = (userId) => {
    const manager = dictionaries.users?.find((item) => Number(item.id) === Number(userId));
    return manager?.label || manager?.username || `ID: ${userId}`;
  };

  const getUnitOptionLabel = (unit) => {
    const type = getLotTypeMeta(unit?.lot_type);
    return `${type.short} №${unit?.unit_number || unit?.id} · ${formatArea(unit?.area_total)} · ${formatMoney(unit?.price_total, unit?.currency_info || unit?.currency)}`;
  };

  const getNextLeadStatus = (statusId) => {
    const index = leadStatuses.findIndex((item) => Number(item.id) === Number(statusId));
    if (index < 0 || index >= leadStatuses.length - 1) return null;
    return leadStatuses[index + 1];
  };

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, statusesRes, leadStatusesRes, leadSourcesRes, dicts] = await Promise.all([
        getRequest("/sales/objects/overview"),
        getRequest("/sales/unit-statuses"),
        getRequest("/sales/lead-statuses"),
        getRequest("/sales/lead-sources"),
        loadDictionaries(["users"])
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
      setDictionaries({ users: dicts?.users || [] });
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
            exclude_converted: true,
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

  const loadClients = async (nextPage = clientPage, nextFilters = filters) => {
    try {
      setClientsLoading(true);
      const res = await postRequest("/sales/clients/search", {
        project_id: nextFilters.project_id ? Number(nextFilters.project_id) : undefined,
        block_id: nextFilters.block_id ? Number(nextFilters.block_id) : undefined,
        search: nextFilters.search || undefined,
        page: nextPage,
        size: 12
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить клиентов");
        return;
      }

      setClients(res.data || []);
      setClientsPagination(res.pagination || { page: nextPage, pages: 1, hasNext: false, hasPrev: false, total: 0 });
    } catch (error) {
      console.error("Sales clients load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки клиентов");
    } finally {
      setClientsLoading(false);
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

  useEffect(() => {
    if (activeTab !== "clients") return;
    loadClients(clientPage, filters);
  }, [activeTab, clientPage, filters.project_id, filters.block_id, filters.search]);

  const handleRefresh = async () => {
    await loadOverview();
    if (activeTab === "units") {
      await loadUnits(unitPage, filters);
    }
    if (activeTab === "funnel") {
      await loadLeadFunnel();
    }
    if (activeTab === "clients") {
      await loadClients(clientPage, filters);
    }
  };

  const updateFilters = (patch) => {
    setUnitPage(1);
    setClientPage(1);
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
    setClientPage(1);
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
      await Promise.all([loadOverview(), loadLeadFunnel(), loadClients(clientPage, filters)]);
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

  const openEditStatus = (status) => {
    setStatusForm({
      id: status.id,
      name: status.name || "",
      color: status.color || "#3b82f6"
    });
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
      const payload = {
        name,
        color: statusForm.color
      };
      const res = statusForm.id
        ? await putRequest(`/sales/lead-statuses/update/${statusForm.id}`, payload)
        : await postRequest("/sales/lead-statuses/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить статус");
        return;
      }

      toast.success(statusForm.id ? "Статус обновлен" : "Статус создан");
      closeStatusModal();
      await Promise.all([loadOverview(), loadLeadFunnel()]);
    } catch (error) {
      console.error("Sales lead status save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения статуса");
    } finally {
      setStatusSaving(false);
    }
  };

  const deleteStatus = async (status) => {
    const total = leadPagination[Number(status.id)]?.total ?? (leadColumns[Number(status.id)] || []).length;
    if (total > 0) {
      toast.error("Нельзя удалить статус, пока в нем есть лиды");
      return;
    }

    if (!window.confirm(`Удалить статус "${status.name}"?`)) return;

    try {
      const res = await deleteRequest(`/sales/lead-statuses/delete/${status.id}`);
      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить статус");
        return;
      }

      toast.success("Статус удален");
      await Promise.all([loadOverview(), loadLeadFunnel()]);
    } catch (error) {
      console.error("Sales lead status delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления статуса");
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
      console.error("Sales convert floors load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки квартир блока");
      setConvertFloors([]);
      setConvertForm((prev) => ({ ...prev, floor_id: "", unit_id: "" }));
    } finally {
      setConvertLoading(false);
    }
  };

  const openConvertLeadModal = (lead) => {
    const defaultProjectId = lead.project_id || filters.project_id || sortedProjects[0]?.id || "";
    const projectBlocks = defaultProjectId
      ? overviewBlocks.filter((block) => Number(block.project_id) === Number(defaultProjectId))
      : [];
    const defaultBlockId = lead.block_id || filters.block_id || projectBlocks[0]?.id || "";

    setConvertingLead(lead);
    setConvertForm({
      project_id: defaultProjectId ? String(defaultProjectId) : "",
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

  const updateConvertProject = (projectId) => {
    const nextBlocks = projectId
      ? overviewBlocks.filter((block) => Number(block.project_id) === Number(projectId))
      : [];
    const nextBlockId = nextBlocks[0]?.id ? String(nextBlocks[0].id) : "";
    setConvertForm({
      project_id: projectId,
      block_id: nextBlockId,
      floor_id: "",
      unit_id: ""
    });
    setConvertFloors([]);
    if (nextBlockId) {
      loadConvertFloors(nextBlockId);
    }
  };

  const updateConvertBlock = (blockId) => {
    setConvertForm((prev) => ({
      ...prev,
      block_id: blockId,
      floor_id: "",
      unit_id: ""
    }));
    setConvertFloors([]);
    if (blockId) {
      loadConvertFloors(blockId);
    }
  };

  const convertLeadToClient = async () => {
    if (!convertingLead) return;
    if (!convertForm.unit_id) {
      toast.error("Выберите квартиру");
      return;
    }

    try {
      setSavingLeadId(convertingLead.id);
      const res = await postRequest(`/sales/leads/convert-to-client/${convertingLead.id}`, {
        unit_id: Number(convertForm.unit_id)
      });
      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать клиента из лида");
        return;
      }
      toast.success(res.message || "Клиент создан из лида");
      closeConvertLeadModal();
      await Promise.all([loadOverview(), loadLeadFunnel(), loadClients(clientPage, filters)]);
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

    const blocks = overviewBlocks
      .filter((block) => Number(block.project_id) === Number(project.id))
      .sort((a, b) => {
        const byCreatedAt = getCreatedTime(a) - getCreatedTime(b);
        if (byCreatedAt !== 0) return byCreatedAt;
        return Number(a.id || 0) - Number(b.id || 0);
      });

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
          <div className={`rounded-lg p-2 ${softTileClass}`}>
            <div className="text-base font-semibold">{project.total_units || 0}</div>
            <div className={`text-[10px] ${mutedTextClass}`}>Лотов</div>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
            <div className="text-base font-semibold">{project.free_units || 0}</div>
            <div className="text-[10px]">Своб.</div>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? "bg-yellow-500/10 text-yellow-300" : "bg-yellow-50 text-yellow-700"}`}>
            <div className="text-base font-semibold">{project.reserved_units || 0}</div>
            <div className="text-[10px]">Бронь</div>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? "bg-red-500/10 text-red-300" : "bg-red-50 text-red-700"}`}>
            <div className="text-base font-semibold">{project.sold_units || 0}</div>
            <div className="text-[10px]">Продано</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className={`rounded-lg border p-2 ${borderedBoxClass}`}>
            <div className={mutedTextClass}>Свободный фонд</div>
            <div className="mt-1 font-semibold">{formatMoney(project.free_price)}</div>
          </div>
          <div className={`rounded-lg border p-2 ${borderedBoxClass}`}>
            <div className={mutedTextClass}>Продажи</div>
            <div className="mt-1 font-semibold">{soldPercent}%</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full border px-2 py-1 ${chipClass}`}>Квартиры: {project.apartments || 0}</span>
          <span className={`rounded-full border px-2 py-1 ${chipClass}`}>Помещения: {project.commercial_units || 0}</span>
          <span className={`rounded-full border px-2 py-1 ${chipClass}`}>Паркинг: {project.parking_units || 0}</span>
          <span className={`rounded-full border px-2 py-1 ${chipClass}`}>Лиды: {project.leads_count || 0}</span>
          <span className={`rounded-full border px-2 py-1 ${chipClass}`}>Клиенты: {project.clients_count || 0}</span>
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
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${softActionClass}`}
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
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getStatusBadgeClass(status.code)}`}>
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
          <div className={`rounded-lg p-2 ${softTileClass}`}>
            <div className={`text-[10px] ${mutedTextClass}`}>Площадь</div>
            <div className="font-semibold">{formatArea(unit.area_total)}</div>
          </div>
          <div className={`rounded-lg p-2 ${softTileClass}`}>
            <div className={`text-[10px] ${mutedTextClass}`}>Комнат</div>
            <div className="font-semibold">{unit.rooms ?? "-"}</div>
          </div>
          <div className={`rounded-lg p-2 ${softTileClass}`}>
            <div className={`text-[10px] ${mutedTextClass}`}>Цена</div>
            <div className="truncate font-semibold">{formatMoney(unit.price_total, unit.currency_info || unit.currency)}</div>
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
    const source = getLeadSource(lead.source_id);
    const phoneDigits = getPhoneDigits(lead.phone);
    const leadTitle = lead.full_name || lead.phone || `Лид №${lead.id}`;
    const disabled = savingLeadId === lead.id;

    return (
      <div key={lead.id} className={`${cardClass} p-3 shadow-sm`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${titleClass}`}>{leadTitle}</div>
            <div className={`mt-1 text-[11px] ${secondaryTextClass}`}>{formatDateTime(lead.created_at)}</div>
          </div>
          {lead.client_id ? (
            <span className={`rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
              Клиент
            </span>
          ) : (
            <span className={`rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold ${isDark ? "text-blue-300" : "text-blue-700"}`}>
              Лид
            </span>
          )}
        </div>

        <div className={`mt-3 space-y-1 text-xs ${secondaryTextClass}`}>
          <div className="flex items-center gap-2">
            <Phone size={13} className={`shrink-0 ${isDark ? "text-blue-300" : "text-blue-600"}`} />
            <span className="truncate">{lead.phone || "Телефон не указан"}</span>
          </div>
          <div className="truncate">{getProjectName(lead.project_id)} · {lead.block_id ? getBlockName(lead.block_id) : "Все блоки"}</div>
          {source && <div className="truncate">Источник: {source.name}</div>}
          {lead.manager_user_id && <div className="truncate">Менеджер: {getUserName(lead.manager_user_id)}</div>}
          {(lead.interest_budget_from || lead.interest_budget_to) && (
            <div className="truncate">
              Бюджет: {formatMoney(lead.interest_budget_from)} - {formatMoney(lead.interest_budget_to)}
            </div>
          )}
        </div>

        {lead.comment && (
          <div className={`mt-3 line-clamp-2 rounded-lg px-3 py-2 text-xs ${isDark ? "bg-slate-800/70 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
            {lead.comment}
          </div>
        )}

        <div className="mt-3 grid grid-cols-4 gap-2">
          <a
            href={phoneDigits ? `tel:${phoneDigits}` : undefined}
            onClick={(event) => {
              if (!phoneDigits) event.preventDefault();
            }}
            className={`flex h-9 items-center justify-center rounded-lg ${softActionClass}`}
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
            onClick={() => openConvertLeadModal(lead)}
            className={`flex h-9 items-center justify-center rounded-lg disabled:opacity-50 ${softActionClass}`}
            title="Создать клиента"
          >
            <UserPlus size={15} />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={lead.status_id || ""}
            disabled={disabled}
            onChange={(event) => {
              const nextStatusId = event.target.value;
              if (nextStatusId && Number(nextStatusId) !== Number(lead.status_id)) {
                moveLeadToStatus(lead, nextStatusId);
              }
            }}
            className="h-9 rounded-lg border border-yellow-500/40 bg-yellow-500 px-2 text-xs font-semibold text-slate-950 outline-none hover:bg-yellow-400 disabled:opacity-50"
          >
            {leadStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => navigate(lead.project_id ? `/projects/${lead.project_id}/sales` : "/sales")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${softActionClass}`}
          >
            Открыть
          </button>
        </div>
      </div>
    );
  };

  const renderClientCard = (client) => {
    const phoneDigits = getPhoneDigits(client.phone);
    const clientTitle = client.full_name || client.phone || `Клиент №${client.id}`;
    const clientUnit = client.sales_unit;
    const clientProject = client.sales_project;
    const clientBlock = client.sales_block;
    const clientFloor = client.sales_floor || clientUnit?.floor;
    const unitType = clientUnit ? getLotTypeMeta(clientUnit.lot_type) : null;

    return (
      <div key={client.id} className={`${cardClass} p-4`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{clientTitle}</div>
            <div className={`mt-1 text-xs ${secondaryTextClass}`}>{formatDateTime(client.created_at)}</div>
          </div>
          <span className={`rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
            Клиент
          </span>
        </div>

        <div className={`space-y-1 text-xs ${secondaryTextClass}`}>
          <div className="flex items-center gap-2">
            <Phone size={13} className={`shrink-0 ${isDark ? "text-blue-300" : "text-blue-600"}`} />
            <span className="truncate">{client.phone || "Телефон не указан"}</span>
          </div>
          {client.email && <div className="truncate">Email: {client.email}</div>}
          {client.passport_number && <div className="truncate">Паспорт: {client.passport_number}</div>}
          {client.pin && <div className="truncate">ПИН: {client.pin}</div>}
          {client.manager_user_id && <div className="truncate">Менеджер: {getUserName(client.manager_user_id)}</div>}
        </div>

        {(clientUnit || clientProject || clientBlock) && (
          <button
            type="button"
            onClick={() => {
              if (clientUnit?.project_id && clientUnit?.block_id && clientUnit?.floor_id) {
                navigate(`/projects/${clientUnit.project_id}/sales/blocks/${clientUnit.block_id}/floors/${clientUnit.floor_id}/units/${clientUnit.id}`);
              }
            }}
            className={`mt-3 w-full rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-left text-xs ${isDark ? "text-slate-200" : "text-slate-800"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">
                {clientUnit ? `${unitType?.short || "Лот"} №${clientUnit.unit_number}` : "Интерес к объекту"}
              </span>
              {clientUnit?.status && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${isDark ? "bg-slate-900/70 text-slate-300" : "bg-white/80 text-slate-700"}`}>
                  {clientUnit.status.name}
                </span>
              )}
            </div>
            <div className={`mt-1 flex flex-wrap gap-x-2 gap-y-1 ${secondaryTextClass}`}>
              {clientProject?.name && <span>{clientProject.name}</span>}
              {clientBlock?.name && <span>{clientBlock.name}</span>}
              {clientFloor?.floor_number && <span>{clientFloor.floor_number} этаж</span>}
              {clientUnit?.rooms !== null && clientUnit?.rooms !== undefined && <span>{clientUnit.rooms} ком</span>}
              {clientUnit?.area_total && <span>{formatArea(clientUnit.area_total)}</span>}
              {clientUnit?.price_total && <span>{formatMoney(clientUnit.price_total, clientUnit.currency_info || clientUnit.currency)}</span>}
            </div>
          </button>
        )}

        {client.comment && (
          <div className={`mt-3 line-clamp-2 rounded-lg px-3 py-2 text-xs ${isDark ? "bg-slate-800/70 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
            {client.comment}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={phoneDigits ? `tel:${phoneDigits}` : undefined}
            onClick={(event) => {
              if (!phoneDigits) event.preventDefault();
            }}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${softActionClass}`}
          >
            <Phone size={15} />
            Позвонить
          </a>
          <a
            href={phoneDigits ? `https://wa.me/${phoneDigits}` : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!phoneDigits) event.preventDefault();
            }}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600/90 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <MessageCircle size={15} />
            WhatsApp
          </a>
        </div>
      </div>
    );
  };

  const renderClients = () => (
    <div className="space-y-2">
      <div className={`flex items-center justify-between text-xs ${secondaryTextClass}`}>
        <span className="flex items-center gap-1"><UserCheck size={14} /> Клиентов: {clientsPagination.total || 0}</span>
        <span className="flex items-center gap-1"><ListChecks size={14} /> {clientPage} / {clientsPagination.pages || 1}</span>
      </div>

      {clientsLoading ? (
        <div className={`${cardClass} p-6 text-center ${secondaryTextClass}`}>Загрузка клиентов...</div>
      ) : clients.length ? (
        clients.map(renderClientCard)
      ) : (
        <div className={`${cardClass} p-6 text-center ${secondaryTextClass}`}>Клиенты пока не найдены</div>
      )}

      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          disabled={!clientsPagination.hasPrev}
          onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))}
          className={subtleButtonClass}
        >
          Назад
        </button>
        <span className="text-sm">{clientPage} / {clientsPagination.pages || 1}</span>
        <button
          disabled={!clientsPagination.hasNext}
          onClick={() => setClientPage((prev) => prev + 1)}
          className={subtleButtonClass}
        >
          Далее
        </button>
      </div>
    </div>
  );

  const renderFunnel = () => (
    <div className="space-y-3">
      <div className={`flex items-center justify-between text-xs ${secondaryTextClass}`}>
        <span className="flex items-center gap-1"><Filter size={14} /> Воронка по статусам лидов</span>
        <div className="flex gap-2">
          <button
            onClick={openCreateStatus}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${softActionClass}`}
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
            const canDeleteStatus = Number(total) === 0;
            const statusColor = status.color || "#3b82f6";
            return (
              <div
                key={status.id}
                className={`w-[285px] shrink-0 overflow-hidden rounded-2xl border ${isDark ? "bg-slate-900/70" : "bg-white"}`}
                style={{
                  borderColor: `${statusColor}66`,
                  boxShadow: `inset 0 1px 0 ${statusColor}33`
                }}
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: statusColor }} />
                <div className="p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
                        <div className={`truncate text-sm font-semibold ${titleClass}`}>{status.name}</div>
                      </div>
                      <div className={`mt-1 text-[11px] ${mutedTextClass}`}>Показано {leads.length} из {total}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openCreateLead(status.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${softActionClass}`}
                        title="Создать лид в этом статусе"
                      >
                        <UserPlus size={15} />
                      </button>
                      <button
                        onClick={() => openEditStatus(status)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${softActionClass}`}
                        title="Редактировать статус"
                      >
                        <Pencil size={14} />
                      </button>
                      {canDeleteStatus && (
                        <button
                          onClick={() => deleteStatus(status)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-red-500/15 text-red-300 hover:bg-red-500/25" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
                          title="Удалить пустой статус"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {leadsLoading ? (
                      <div className={`rounded-xl border border-dashed p-4 text-center text-xs ${emptyBoxClass}`}>
                        Загрузка...
                      </div>
                    ) : leads.length ? (
                      leads.map(renderLeadCard)
                    ) : (
                      <div className={`rounded-xl border border-dashed p-4 text-center text-xs ${emptyBoxClass}`}>
                        Лидов пока нет
                      </div>
                    )}
                  </div>
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
          <button onClick={handleRefresh} className={subtleButtonClass} disabled={loading || unitsLoading || leadsLoading || clientsLoading}>
            <RefreshCw size={16} className={loading || unitsLoading || leadsLoading || clientsLoading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className={`${panelClass} p-3`}>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setActiveTab("objects")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "objects" ? "bg-blue-600 text-white" : inactiveTabClass}`}
            >
              Объекты
            </button>
            <button
              onClick={() => setActiveTab("units")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "units" ? "bg-blue-600 text-white" : inactiveTabClass}`}
            >
              Лоты
            </button>
            <button
              onClick={() => setActiveTab("funnel")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "funnel" ? "bg-blue-600 text-white" : inactiveTabClass}`}
            >
              Лиды
            </button>
            <button
              onClick={() => setActiveTab("clients")}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${activeTab === "clients" ? "bg-blue-600 text-white" : inactiveTabClass}`}
            >
              Клиенты
            </button>

          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className={`${cardClass} p-3`}>
            <div className={`text-[11px] ${mutedTextClass}`}>Всего</div>
            <div className="text-lg font-semibold">{totals.total_units}</div>
          </div>
          <div className={`${cardClass} p-3 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
            <div className="text-[11px]">Своб.</div>
            <div className="text-lg font-semibold">{totals.free_units}</div>
          </div>
          <div className={`${cardClass} p-3 ${isDark ? "text-yellow-300" : "text-yellow-700"}`}>
            <div className="text-[11px]">Бронь</div>
            <div className="text-lg font-semibold">{totals.reserved_units}</div>
          </div>
          <div className={`${cardClass} p-3 ${isDark ? "text-red-300" : "text-red-700"}`}>
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
                placeholder={activeTab === "funnel" ? "Поиск лида, телефона..." : activeTab === "clients" ? "Поиск клиента, телефона..." : "Поиск лота, кода..."}
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

          {activeTab === "units" && (
            <>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {LOT_TYPES.map(({ value, short, icon: Icon }) => (
                  <button
                    key={value || "all"}
                    onClick={() => {
                      updateFilters({ lot_type: value });
                      setActiveTab("units");
                    }}
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ${filters.lot_type === value ? "bg-blue-600 text-white" : inactiveTabClass
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
                    <option key={room.value || "all"} value={room.value}>{room.label}</option>
                  ))}
                </select>
                <input value={filters.area_from} onChange={(e) => updateFilters({ area_from: e.target.value })} className={inputClass} inputMode="decimal" placeholder="Площадь от" />
                <input value={filters.area_to} onChange={(e) => updateFilters({ area_to: e.target.value })} className={inputClass} inputMode="decimal" placeholder="Площадь до" />
                <input value={filters.price_from} onChange={(e) => updateFilters({ price_from: e.target.value })} className={inputClass} inputMode="numeric" placeholder="Цена от" />
                <input value={filters.price_to} onChange={(e) => updateFilters({ price_to: e.target.value })} className={inputClass} inputMode="numeric" placeholder="Цена до" />
                <select value={filters.sort} onChange={(e) => updateFilters({ sort: e.target.value })} className={`${inputClass} col-span-2`}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {activeTab === "funnel" ? renderFunnel() : activeTab === "clients" ? renderClients() : activeTab === "objects" ? (
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

        {leadModalOpen && createPortal((
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3">
            <div className={`max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border p-4 shadow-2xl ${modalPanelClass}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className={`text-xl font-semibold ${titleClass}`}>Новый лид</h2>
                  <div className={`mt-1 text-sm ${secondaryTextClass}`}>Карточка для воронки продаж</div>
                </div>
                <button onClick={closeLeadModal} className={subtleButtonClass}>
                  Закрыть
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={`col-span-2 text-xs ${labelClass}`}>
                  Объект
                  <select value={leadForm.project_id} onChange={(e) => updateLeadForm({ project_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Выберите объект</option>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>

                <label className={`col-span-2 text-xs ${labelClass}`}>
                  Блок
                  <select value={leadForm.block_id} onChange={(e) => updateLeadForm({ block_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Все блоки</option>
                    {leadFormBlocks.map((block) => (
                      <option key={block.id} value={block.id}>{block.name}</option>
                    ))}
                  </select>
                </label>

                <label className={`text-xs ${labelClass}`}>
                  Статус
                  <select value={leadForm.status_id} onChange={(e) => updateLeadForm({ status_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Выберите статус</option>
                    {leadStatuses.map((status) => (
                      <option key={status.id} value={status.id}>{status.name}</option>
                    ))}
                  </select>
                </label>

                <label className={`text-xs ${labelClass}`}>
                  Источник
                  <select value={leadForm.source_id} onChange={(e) => updateLeadForm({ source_id: e.target.value })} className={`${inputClass} mt-1`}>
                    <option value="">Не выбран</option>
                    {leadSources.map((source) => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </select>
                </label>

                <label className={`col-span-2 text-xs ${labelClass}`}>
                  Имя клиента
                  <input
                    value={leadForm.full_name}
                    onChange={(e) => updateLeadForm({ full_name: e.target.value })}
                    className={`${inputClass} mt-1`}
                    placeholder="ФИО или название"
                  />
                </label>

                <label className={`text-xs ${labelClass}`}>
                  Телефон
                  <input
                    value={leadForm.phone}
                    onFocus={() => {
                      if (!leadForm.phone) updateLeadForm({ phone: "+996 " });
                    }}
                    onChange={(e) => updateLeadForm({ phone: formatLeadPhoneInput(e.target.value, leadForm.phone) })}
                    className={`${inputClass} mt-1`}
                    inputMode="tel"
                    maxLength={22}
                    placeholder="+996..."
                  />
                </label>

                <label className={`text-xs ${labelClass}`}>
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

                <label className={`col-span-2 text-xs ${labelClass}`}>
                  Email
                  <input
                    value={leadForm.email}
                    onChange={(e) => updateLeadForm({ email: e.target.value })}
                    className={`${inputClass} mt-1`}
                    inputMode="email"
                    placeholder="email@example.com"
                  />
                </label>

                <label className={`text-xs ${labelClass}`}>
                  Комнат
                  <input
                    value={leadForm.interest_rooms}
                    onChange={(e) => updateLeadForm({ interest_rooms: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    className={`${inputClass} mt-1`}
                    inputMode="numeric"
                  />
                </label>

                <label className={`text-xs ${labelClass}`}>
                  Бюджет от
                  <input
                    value={leadForm.interest_budget_from}
                    onChange={(e) => updateLeadForm({ interest_budget_from: e.target.value.replace(/[^\d.]/g, "") })}
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                  />
                </label>

                <label className={`col-span-2 text-xs ${labelClass}`}>
                  Бюджет до
                  <input
                    value={leadForm.interest_budget_to}
                    onChange={(e) => updateLeadForm({ interest_budget_to: e.target.value.replace(/[^\d.]/g, "") })}
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                  />
                </label>

                <label className={`col-span-2 text-xs ${labelClass}`}>
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
        ), document.body)}

        {convertModalOpen && createPortal((
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3">
            <div className={`max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border p-4 shadow-2xl ${modalPanelClass}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Создать клиента</h2>
                  <div className={`mt-1 text-sm ${secondaryTextClass}`}>
                    {convertingLead?.full_name || convertingLead?.phone || "Лид"} · выберите квартиру
                  </div>
                </div>
                <button onClick={closeConvertLeadModal} className={subtleButtonClass}>
                  Закрыть
                </button>
              </div>

              <div className="space-y-3">
                <label className={`block text-xs ${labelClass}`}>
                  Объект
                  <select value={convertForm.project_id} onChange={(e) => updateConvertProject(e.target.value)} className={`${inputClass} mt-1`}>
                    <option value="">Выберите объект</option>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>

                <label className={`block text-xs ${labelClass}`}>
                  Блок
                  <select value={convertForm.block_id} onChange={(e) => updateConvertBlock(e.target.value)} className={`${inputClass} mt-1`} disabled={!convertForm.project_id}>
                    <option value="">Выберите блок</option>
                    {convertBlocks.map((block) => (
                      <option key={block.id} value={block.id}>{block.name}</option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className={`block text-xs ${labelClass}`}>
                    Этаж
                    <select
                      value={convertForm.floor_id}
                      onChange={(e) => setConvertForm((prev) => ({ ...prev, floor_id: e.target.value, unit_id: "" }))}
                      className={`${inputClass} mt-1`}
                      disabled={!convertForm.block_id || convertLoading}
                    >
                      <option value="">{convertLoading ? "Загрузка..." : "Выберите этаж"}</option>
                      {convertFloors.map((floor) => (
                        <option key={floor.id} value={floor.id}>{floor.floor_number} этаж</option>
                      ))}
                    </select>
                  </label>

                  <label className={`block text-xs ${labelClass}`}>
                    Квартира
                    <select
                      value={convertForm.unit_id}
                      onChange={(e) => setConvertForm((prev) => ({ ...prev, unit_id: e.target.value }))}
                      className={`${inputClass} mt-1`}
                      disabled={!convertForm.floor_id}
                    >
                      <option value="">Выберите квартиру</option>
                      {convertUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>{getUnitOptionLabel(unit)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  onClick={convertLeadToClient}
                  disabled={savingLeadId === convertingLead?.id || convertLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  <UserCheck size={17} />
                  {savingLeadId === convertingLead?.id ? "Создаем..." : "Создать клиента и привязать"}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}

        {statusModalOpen && createPortal((
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3">
            <div className={`max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-2xl border p-4 shadow-2xl ${modalPanelClass}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className={`text-xl font-semibold ${titleClass}`}>
                    {statusForm.id ? "Редактировать статус" : "Новый статус"}
                  </h2>
                  <div className={`mt-1 text-sm ${secondaryTextClass}`}>
                    {statusForm.id ? "Настройки колонки воронки лидов" : "Новая колонка воронки лидов"}
                  </div>
                </div>
                <button onClick={closeStatusModal} className={subtleButtonClass}>
                  Закрыть
                </button>
              </div>

              <label className={`text-xs ${labelClass}`}>
                Название
                <input
                  value={statusForm.name}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={`${inputClass} mt-1`}
                  placeholder="Например: Нет WhatsApp"
                />
              </label>

              <div className="mt-4">
                <div className={`mb-2 text-xs ${labelClass}`}>Цвет</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setStatusForm((prev) => ({ ...prev, color }))}
                      className={`h-9 w-9 rounded-full border-2 ${statusForm.color === color ? (isDark ? "border-white" : "border-slate-900") : "border-transparent"}`}
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
                {statusSaving ? "Сохраняем..." : (statusForm.id ? "Сохранить статус" : "Создать статус")}
              </button>
            </div>
          </div>
        ), document.body)}
      </div>
    </PullToRefresh>
  );
}
