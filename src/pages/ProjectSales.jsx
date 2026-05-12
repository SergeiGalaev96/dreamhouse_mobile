import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Grid3X3, Phone, Pencil, Plus, Search, UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";
import { getRequest, postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import { formatDateTime } from "../utils/date";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const EMPTY_FLOOR_FORM = {
  floor_number: "",
  sort_order: ""
};

const EMPTY_UNIT_FORM = {
  floor_id: "",
  unit_number: "",
  lot_type: "apartment",
  rooms: "",
  area_total: "",
  price_total: "",
  currency: "KGS",
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
  comment: ""
};

const normalizeInnInput = (value) => String(value || "").replace(/\D/g, "").slice(0, 14);

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
                    <div className="text-base font-semibold">{floor.floor_number} этаж</div>
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

export default function ProjectSales() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("units");
  const [project, setProject] = useState(null);
  const [overview, setOverview] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [leadSources, setLeadSources] = useState([]);

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);

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

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);

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
    () => floors.find((item) => Number(item.id) === Number(selectedFloorId)) || floors[0] || null,
    [floors, selectedFloorId]
  );
  const selectedUnits = selectedFloor?.units || [];

  const summary = useMemo(() => {
    const counters = { total: 0, free: 0, reserved: 0, sold: 0, offmarket: 0 };
    for (const floor of floors) {
      for (const unit of floor.units || []) {
        counters.total += 1;
        const code = unitStatuses.find((item) => Number(item.id) === Number(unit.status_id))?.code;
        if (code && counters[code] !== undefined) {
          counters[code] += 1;
        }
      }
    }
    return counters;
  }, [floors, unitStatuses]);

  useEffect(() => {
    loadInitial();
  }, [projectId]);

  useEffect(() => {
    if (!selectedBlockId) {
      setOverview(null);
      setSelectedFloorId(null);
      return;
    }
    loadOverview(selectedBlockId);
  }, [selectedBlockId]);

  useEffect(() => {
    if (activeTab === "leads") {
      loadLeads();
    }
  }, [activeTab, leadPage, leadSearch, leadStatusFilter, selectedBlockId]);

  useEffect(() => {
    if (activeTab === "clients") {
      loadClients();
    }
  }, [activeTab, clientPage, clientSearch, selectedBlockId]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [projectRes, unitStatusesRes, leadStatusesRes, leadSourcesRes, dicts] = await Promise.all([
        getRequest(`/projects/getById/${projectId}`),
        getRequest("/sales/unit-statuses"),
        getRequest("/sales/lead-statuses"),
        getRequest("/sales/lead-sources"),
        loadDictionaries(["users", "projectBlocks"])
      ]);

      if (projectRes?.success) {
        setProject(projectRes.data || null);
      }

      const nextDicts = dicts || {};
      const blocks = (nextDicts.projectBlocks || []).filter((item) => Number(item.project_id) === Number(projectId));

      setUnitStatuses(unitStatusesRes?.success ? unitStatusesRes.data || [] : []);
      const nextLeadStatuses = leadStatusesRes?.success ? leadStatusesRes.data || [] : [];
      setLeadStatuses(nextLeadStatuses);
      setLeadSources(leadSourcesRes?.success ? leadSourcesRes.data || [] : []);
      setDictionaries(nextDicts);
      setSelectedBlockId((prev) => prev || blocks[0]?.id || null);
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
        return nextFloors.some((item) => Number(item.id) === Number(prev)) ? prev : nextFloors[0]?.id || null;
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
      await loadOverview(selectedBlockId);
    }
    if (activeTab === "leads") {
      await loadLeads();
    }
    if (activeTab === "clients") {
      await loadClients();
    }
  };

  const formatMoney = (value, currency = "KGS") => {
    if (value === null || value === undefined || value === "") return "—";
    return `${Number(value).toLocaleString("ru-RU")} ${currency}`;
  };

  const getUserName = (userId) =>
    dictionaries.users?.find((item) => Number(item.id) === Number(userId))?.label || "—";

  const getLeadStatus = (statusId) => leadStatuses.find((item) => Number(item.id) === Number(statusId));
  const getLeadSource = (sourceId) => leadSources.find((item) => Number(item.id) === Number(sourceId));
  const defaultLeadStatusId = leadStatuses[0]?.id ? String(leadStatuses[0].id) : "";
  const getUnitStatus = (statusId) => unitStatuses.find((item) => Number(item.id) === Number(statusId));

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
      status_id: unitStatuses[0]?.id ? String(unitStatuses[0].id) : ""
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
      area_total: unit.area_total ?? "",
      price_total: unit.price_total ?? "",
      currency: unit.currency || "KGS",
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

  const openCreateClient = () => {
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientModalOpen(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      last_name: client.last_name || "",
      first_name: client.first_name || "",
      middle_name: client.middle_name || "",
      phone: client.phone || "",
      phone_extra: client.phone_extra || "",
      email: client.email || "",
      passport_number: client.passport_number || "",
      pin: client.pin || "",
      address: client.address || "",
      comment: client.comment || ""
    });
    setClientModalOpen(true);
  };

  const closeClientModal = () => {
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientModalOpen(false);
  };

  const saveFloor = async (e) => {
    e.preventDefault();
    if (!selectedBlockId) return toast.error("Сначала выберите блок");
    if (floorForm.floor_number === "") return toast.error("Введите номер этажа");

    try {
      setSaving(true);
      const payload = {
        project_id: Number(projectId),
        block_id: Number(selectedBlockId),
        floor_number: Number(floorForm.floor_number),
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
      await loadOverview(selectedBlockId);
    } catch (error) {
      console.error("ProjectSales floor save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения этажа");
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
        area_total: unitForm.area_total === "" ? null : Number(unitForm.area_total),
        price_total: unitForm.price_total === "" ? null : Number(unitForm.price_total),
        currency: unitForm.currency.trim() || "KGS",
        status_id: unitForm.status_id ? Number(unitForm.status_id) : null,
        plan_code: unitForm.plan_code.trim() || null,
        external_code: unitForm.external_code.trim() || null,
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
      await loadOverview(selectedBlockId);
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
    if (!clientForm.first_name.trim() && !clientForm.last_name.trim()) {
      return toast.error("Введите имя клиента");
    }

    try {
      setSaving(true);
      const payload = {
        last_name: clientForm.last_name.trim() || null,
        first_name: clientForm.first_name.trim() || null,
        middle_name: clientForm.middle_name.trim() || null,
        phone: clientForm.phone.trim() || null,
        phone_extra: clientForm.phone_extra.trim() || null,
        email: clientForm.email.trim() || null,
        passport_number: clientForm.passport_number.trim() || null,
        pin: clientForm.pin.trim() || null,
        address: clientForm.address.trim() || null,
        comment: clientForm.comment.trim() || null
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

  const convertLeadToClient = async (leadId) => {
    try {
      const res = await postRequest(`/sales/leads/convert-to-client/${leadId}`, {});
      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать клиента из лида");
        return;
      }
      toast.success(res.message || "Клиент создан из лида");
      await Promise.all([loadLeads(), loadClients()]);
    } catch (error) {
      console.error("ProjectSales convert lead error", error);
      toast.error(error?.response?.data?.message || "Ошибка создания клиента из лида");
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
          <div className="grid grid-cols-3 gap-2">
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

          <select
            value={selectedBlockId || ""}
            onChange={(e) => {
              const nextBlockId = e.target.value ? Number(e.target.value) : null;
              setSelectedBlockId(nextBlockId);
              setLeadPage(1);
              setClientPage(1);
            }}
            className={modalInputClass}
          >
            <option value="">Выберите блок</option>
            {projectBlocks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {activeTab === "units" && (
          <>
            {floors.length > 0 && (
              <div className="mb-4">
                <FacadeBoard
                  floors={floors}
                  selectedFloorId={selectedFloorId}
                  getFloorCounters={getFloorCounters}
                  onOpenFloor={openFloorPlan}
                />
              </div>
            )}

            <div className={`${panelClass} mb-4`}>
              <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                <div className={`${cardClass} p-2`}>
                  <div className={`text-xs ${mutedTextClass}`}>Этажей</div>
                  <div className="mt-1 text-sm font-semibold">{floors.length}</div>
                </div>
                <div className={`${cardClass} p-2`}>
                  <div className={`text-xs ${mutedTextClass}`}>Лотов</div>
                  <div className="mt-1 text-sm font-semibold">{summary.total}</div>
                </div>
                <div className={`${cardClass} p-2`}>
                  <div className={`text-xs ${mutedTextClass}`}>Свободно</div>
                  <div className="mt-1 text-sm font-semibold text-green-400">{summary.free}</div>
                </div>
                <div className={`${cardClass} p-2`}>
                  <div className={`text-xs ${mutedTextClass}`}>Бронь / Продано</div>
                  <div className="mt-1 text-sm font-semibold text-yellow-300">
                    {summary.reserved} / <span className="text-red-400">{summary.sold}</span>
                  </div>
                </div>
              </div>
            </div>

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
                    {floor.floor_number} этаж
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
                    <div className="text-base font-semibold">Выбран этаж {selectedFloor.floor_number}</div>
                    <div className={`text-xs ${secondaryTextClass}`}>Лотов на этаже: {selectedUnits.length}</div>
                  </div>
                  <div className="flex gap-2">
                    {canManageCatalog && (
                      <button onClick={() => openEditFloor(selectedFloor)} className={actionTileClass}>
                        <Pencil size={14} />
                      </button>
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
                        {!isLockedByOther && (
                          <button onClick={() => openEditLead(lead)} className={actionTileClass}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {!lead.client_id && (
                          <button onClick={() => convertLeadToClient(lead.id)} className="rounded bg-emerald-600 px-3 py-2 text-xs text-white">
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
                        <div className={`mt-1 text-[11px] ${mutedTextClass}`}>{formatDateTime(client.created_at)}</div>
                      </div>

                      <div className="flex flex-col gap-2">
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

      {floorModalOpen && (
        <Modal title={editingFloor ? "Редактировать этаж" : "Новый этаж"} subtitle={selectedBlock?.label || ""} onClose={closeFloorModal}>
          <form onSubmit={saveFloor} className="space-y-3">
            <Field label="Номер этажа">
              <input
                value={floorForm.floor_number}
                onChange={(e) => setFloorForm((prev) => ({ ...prev, floor_number: e.target.value }))}
                className={modalInputClass}
              />
            </Field>
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
                      {floor.floor_number} этаж
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
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, area_total: e.target.value }))}
                  className={modalInputClass}
                />
              </Field>
              <Field label="Валюта">
                <input
                  value={unitForm.currency}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className={modalInputClass}
                />
              </Field>
            </div>

            <Field label="Цена">
              <input
                value={unitForm.price_total}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, price_total: e.target.value }))}
                className={modalInputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Код плана">
                <input
                  value={unitForm.plan_code}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, plan_code: e.target.value }))}
                  className={modalInputClass}
                />
              </Field>
              <Field label="Внешний код">
                <input
                  value={unitForm.external_code}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, external_code: e.target.value }))}
                  className={modalInputClass}
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
