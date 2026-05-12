import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Grid3X3, Pencil, Phone, Plus, Search, UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";
import { getRequest, postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import { formatDateTime } from "../utils/date";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

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

export default function SalesBlock() {
  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("units");
  const [overview, setOverview] = useState(null);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [selectedFloorId, setSelectedFloorId] = useState(null);

  const [leadSearch, setLeadSearch] = useState("");
  const [leadInputSearch, setLeadInputSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("");
  const [leads, setLeads] = useState([]);
  const [leadsPagination, setLeadsPagination] = useState(null);
  const [leadPage, setLeadPage] = useState(1);

  const [clientSearch, setClientSearch] = useState("");
  const [clientInputSearch, setClientInputSearch] = useState("");
  const [clients, setClients] = useState([]);
  const [clientsPagination, setClientsPagination] = useState(null);
  const [clientPage, setClientPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [saving, setSaving] = useState(false);

  const titleClass = themeText.title(isDark);
  const pageClass = themeText.page(isDark);
  const secondaryTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const cardClass = `${themeSurface.card(isDark)} p-3`;
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const chipButtonClass = themeControl.chipButton(isDark);
  const actionTileClass = themeControl.actionTile(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);

  const isAdmin = Number(user?.role_id) === 1;

  useEffect(() => {
    loadInitial();
  }, [blockId]);

  useEffect(() => {
    if (activeTab === "leads") {
      loadLeads();
    }
  }, [activeTab, leadPage, leadSearch, leadStatusFilter]);

  useEffect(() => {
    if (activeTab === "clients") {
      loadClients();
    }
  }, [activeTab, clientPage, clientSearch]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [overviewRes, unitStatusesRes, leadStatusesRes, leadSourcesRes, dicts] = await Promise.all([
        getRequest(`/sales/blocks/${blockId}/overview`),
        getRequest("/sales/unit-statuses"),
        getRequest("/sales/lead-statuses"),
        getRequest("/sales/lead-sources"),
        loadDictionaries(["users"])
      ]);

      if (overviewRes?.success) {
        setOverview(overviewRes.data);
        const floors = overviewRes.data?.floors || [];
        setSelectedFloorId((prev) => prev || floors[0]?.id || null);
      }

      setUnitStatuses(unitStatusesRes?.success ? unitStatusesRes.data || [] : []);
      const nextLeadStatuses = leadStatusesRes?.success ? leadStatusesRes.data || [] : [];
      setLeadStatuses(nextLeadStatuses);
      setLeadSources(leadSourcesRes?.success ? leadSourcesRes.data || [] : []);
      setDictionaries(dicts || {});
      setLeadStatusFilter((prev) => prev || (nextLeadStatuses[0]?.id ? String(nextLeadStatuses[0].id) : ""));
    } catch (error) {
      console.error("SalesBlock init error", error);
      toast.error("Ошибка загрузки продаж блока");
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      setLoading(true);
      const res = await postRequest("/sales/leads/search", {
        project_id: Number(projectId),
        block_id: Number(blockId),
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
      console.error("SalesBlock leads load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки лидов");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      setLoading(true);
      const res = await postRequest("/sales/clients/search", {
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
      console.error("SalesBlock clients load error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки клиентов");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadInitial();
    if (activeTab === "leads") {
      await loadLeads();
    }
    if (activeTab === "clients") {
      await loadClients();
    }
  };

  const getUserName = (userId) =>
    dictionaries.users?.find((item) => Number(item.id) === Number(userId))?.label || "—";

  const getLeadStatus = (statusId) => leadStatuses.find((item) => Number(item.id) === Number(statusId));
  const getLeadSource = (sourceId) => leadSources.find((item) => Number(item.id) === Number(sourceId));
  const getUnitStatus = (statusId) => unitStatuses.find((item) => Number(item.id) === Number(statusId));

  const floorOptions = overview?.floors || [];
  const selectedFloor = useMemo(
    () => floorOptions.find((item) => Number(item.id) === Number(selectedFloorId)) || floorOptions[0] || null,
    [floorOptions, selectedFloorId]
  );
  const selectedUnits = selectedFloor?.units || [];

  const unitStatusPills = {
    free: "bg-green-600/15 text-green-400 border border-green-500/40",
    reserved: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/40",
    sold: "bg-red-500/15 text-red-400 border border-red-500/40",
    offmarket: "bg-slate-500/15 text-slate-300 border border-slate-500/40"
  };

  const openCreateLead = () => {
    setEditingLead(null);
    setLeadForm({
      ...EMPTY_LEAD_FORM,
      status_id: leadStatuses[0]?.id ? String(leadStatuses[0].id) : ""
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

  const closeLeadModal = () => {
    setLeadModalOpen(false);
    setEditingLead(null);
    setLeadForm(EMPTY_LEAD_FORM);
  };

  const closeClientModal = () => {
    setClientModalOpen(false);
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT_FORM);
  };

  const saveLead = async (e) => {
    e.preventDefault();

    if (!leadForm.full_name.trim()) return toast.error("Введите имя лида");
    if (!leadForm.status_id) return toast.error("Выберите статус лида");

    try {
      setSaving(true);
      const payload = {
        project_id: Number(projectId),
        block_id: Number(blockId),
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
      console.error("SalesBlock lead save error", error);
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
      console.error("SalesBlock client save error", error);
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
      toast.success(res.message || "Лид закреплен");
      await loadLeads();
    } catch (error) {
      console.error("SalesBlock claim lead error", error);
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
      console.error("SalesBlock convert lead error", error);
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
      toast.success(res.message || "Клиент закреплен");
      await loadClients();
    } catch (error) {
      console.error("SalesBlock claim client error", error);
      toast.error(error?.response?.data?.message || "Ошибка закрепления клиента");
    }
  };

  const tabs = [
    { id: "units", label: "Шахматка", icon: Grid3X3 },
    { id: "leads", label: "Лиды", icon: UserPlus },
    { id: "clients", label: "Клиенты", icon: Users }
  ];

  return (
    <div className={`min-h-full ${pageClass}`}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-semibold ${titleClass}`}>
              Продажи: {overview?.block?.name || `Блок ${blockId}`}
            </h1>
            <div className={`text-sm ${secondaryTextClass}`}>
              {overview?.project?.name || "Объект"}
            </div>
          </div>

          <button onClick={() => navigate(`/projects/${projectId}`)} className={subtleButtonClass}>
            Назад
          </button>
        </div>

        <div className={`${panelClass} mb-4`}>
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
        </div>

        {activeTab === "units" && (
          <>
            <div className={`${panelClass} mb-4`}>
              <div className={`mb-2 text-xs uppercase tracking-wide ${mutedTextClass}`}>Этажи</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {floorOptions.map((floor) => (
                  <button
                    key={floor.id}
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={Number(selectedFloorId) === Number(floor.id) ? "rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" : chipButtonClass}
                  >
                    {floor.floor_number} этаж
                  </button>
                ))}
              </div>
            </div>

            <div className={`${panelClass} mb-4`}>
              <div className="mb-1 flex items-center gap-2">
                <Building2 size={16} className="text-blue-400" />
                <div className="text-sm font-medium">План этажа</div>
              </div>
              <div className={`text-sm ${secondaryTextClass}`}>
                Здесь будет SVG-план этажа и hover по квартирам. Привязку позже подключим через
                ` documents / document_files ` по `entity_type`.
              </div>
            </div>

            {selectedFloor && (
              <div className={`${panelClass} mb-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold">Этаж {selectedFloor.floor_number}</div>
                    <div className={`text-xs ${secondaryTextClass}`}>
                      Квартир: {selectedUnits.length}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedUnits.map((unit) => {
                    const status = getUnitStatus(unit.status_id);
                    const statusClass = unitStatusPills[status?.code] || "bg-slate-500/15 text-slate-200 border border-slate-500/40";

                    return (
                      <div key={unit.id} className={cardClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold">№{unit.unit_number}</div>
                            <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                              {unit.lot_type || "apartment"} {unit.rooms ? `• ${unit.rooms} комн.` : ""} {unit.area_total ? `• ${unit.area_total} м²` : ""}
                            </div>
                            <div className={`mt-1 text-xs ${mutedTextClass}`}>
                              Код: {unit.plan_code || unit.external_code || "—"}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`inline-flex rounded-full px-2 py-1 text-[11px] ${statusClass}`}>
                              {status?.name || "Без статуса"}
                            </div>
                            <div className="mt-2 text-sm font-semibold">
                              {unit.price_total ? Number(unit.price_total).toLocaleString("ru-RU") : "—"} {unit.currency || "KGS"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!selectedUnits.length && !loading && (
                    <div className={`text-center text-sm ${secondaryTextClass}`}>
                      На этом этаже пока нет лотов
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "leads" && (
          <>
            <div className={`${panelClass} mb-4`}>
              <div className="mb-3 flex gap-2">
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
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <button onClick={openCreateLead} className="rounded-lg bg-green-600 px-4 text-sm text-white">
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
                          {status?.name || "Без статуса"} {getLeadSource(lead.source_id)?.name ? `• ${getLeadSource(lead.source_id).name}` : ""}
                        </div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>ИНН: {lead.inn || "—"}</div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>
                          Менеджер: {lead.manager_user_id ? getUserName(lead.manager_user_id) : "не закреплен"}
                        </div>
                        <div className={`mt-1 text-[11px] ${mutedTextClass}`}>
                          {formatDateTime(lead.created_at)}
                        </div>
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
                        {isLockedByOther && isAdmin && (
                          <button onClick={() => claimLead(lead.id)} className="rounded bg-orange-600 px-3 py-2 text-xs text-white">
                            Взять
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!leads.length && !loading && (
                <div className={`py-8 text-center text-sm ${secondaryTextClass}`}>Лидов пока нет</div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setLeadPage((prev) => Math.max(prev - 1, 1))}
                disabled={!leadsPagination?.hasPrev}
                className={subtleButtonClass}
              >
                Назад
              </button>
              <div className={`text-sm ${secondaryTextClass}`}>
                {leadsPagination?.page || 1} / {leadsPagination?.pages || 1}
              </div>
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
            <div className={`${panelClass} mb-4`}>
              <div className="mb-3 flex gap-2">
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

              <button onClick={openCreateClient} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white">
                <div className="flex items-center justify-center gap-2">
                  <Plus size={16} />
                  <span>Клиент</span>
                </div>
              </button>
            </div>

            <div className="space-y-[2px]">
              {clients.map((client) => {
                const isMine = Number(client.manager_user_id) === Number(user?.id);
                const isLockedByOther = client.manager_user_id && !isMine && Boolean(client.is_locked);

                return (
                  <div key={client.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">
                          {client.full_name || [client.last_name, client.first_name, client.middle_name].filter(Boolean).join(" ") || "Без имени"}
                        </div>
                        <div className={`mt-1 text-xs ${secondaryTextClass}`}>{client.phone || "—"}</div>
                        <div className={`mt-1 text-xs ${mutedTextClass}`}>Менеджер: {client.manager_user_id ? getUserName(client.manager_user_id) : "не закреплен"}</div>
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
                        {isLockedByOther && isAdmin && (
                          <button onClick={() => claimClient(client.id)} className="rounded bg-orange-600 px-3 py-2 text-xs text-white">
                            Взять
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!clients.length && !loading && (
                <div className={`py-8 text-center text-sm ${secondaryTextClass}`}>Клиентов пока нет</div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))}
                disabled={!clientsPagination?.hasPrev}
                className={subtleButtonClass}
              >
                Назад
              </button>
              <div className={`text-sm ${secondaryTextClass}`}>
                {clientsPagination?.page || 1} / {clientsPagination?.pages || 1}
              </div>
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

      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveLead} className={`${themeSurface.panel(isDark)} max-h-[92vh] w-full max-w-md overflow-y-auto p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>{editingLead ? "Редактировать лида" : "Новый лид"}</div>
                <div className={`text-xs ${secondaryTextClass}`}>Продажи блока</div>
              </div>
              <button type="button" onClick={closeLeadModal} className={subtleButtonClass}>Закрыть</button>
            </div>

            <div className="space-y-3">
              <input value={leadForm.full_name} onChange={(e) => setLeadForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="ФИО" className={modalInputClass} />
              <input value={leadForm.phone} onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" className={modalInputClass} />
              <input value={leadForm.email} onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className={modalInputClass} />
              <input
                value={leadForm.inn}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, inn: normalizeInnInput(e.target.value) }))}
                inputMode="numeric"
                maxLength={14}
                placeholder="ИНН"
                className={modalInputClass}
              />
              <select value={leadForm.status_id} onChange={(e) => setLeadForm((prev) => ({ ...prev, status_id: e.target.value }))} className={modalInputClass}>
                <option value="">Статус лида</option>
                {leadStatuses.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select value={leadForm.source_id} onChange={(e) => setLeadForm((prev) => ({ ...prev, source_id: e.target.value }))} className={modalInputClass}>
                <option value="">Источник</option>
                {leadSources.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>

              <div className="grid grid-cols-3 gap-2">
                <input value={leadForm.interest_rooms} onChange={(e) => setLeadForm((prev) => ({ ...prev, interest_rooms: e.target.value }))} placeholder="Комнат" className={modalInputClass} />
                <input value={leadForm.interest_budget_from} onChange={(e) => setLeadForm((prev) => ({ ...prev, interest_budget_from: e.target.value }))} placeholder="Бюджет от" className={modalInputClass} />
                <input value={leadForm.interest_budget_to} onChange={(e) => setLeadForm((prev) => ({ ...prev, interest_budget_to: e.target.value }))} placeholder="Бюджет до" className={modalInputClass} />
              </div>

              <textarea value={leadForm.comment} onChange={(e) => setLeadForm((prev) => ({ ...prev, comment: e.target.value }))} placeholder="Комментарий" className={`${modalInputClass} min-h-[96px]`} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeLeadModal} className={subtleButtonClass}>Отмена</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">
                {saving ? "Сохранение..." : editingLead ? "Сохранить" : "Создать"}
              </button>
            </div>
          </form>
        </div>
      )}

      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveClient} className={`${themeSurface.panel(isDark)} max-h-[92vh] w-full max-w-md overflow-y-auto p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${titleClass}`}>{editingClient ? "Редактировать клиента" : "Новый клиент"}</div>
                <div className={`text-xs ${secondaryTextClass}`}>Продажи блока</div>
              </div>
              <button type="button" onClick={closeClientModal} className={subtleButtonClass}>Закрыть</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input value={clientForm.last_name} onChange={(e) => setClientForm((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="Фамилия" className={modalInputClass} />
                <input value={clientForm.first_name} onChange={(e) => setClientForm((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="Имя" className={modalInputClass} />
                <input value={clientForm.middle_name} onChange={(e) => setClientForm((prev) => ({ ...prev, middle_name: e.target.value }))} placeholder="Отчество" className={modalInputClass} />
              </div>
              <input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" className={modalInputClass} />
              <input value={clientForm.phone_extra} onChange={(e) => setClientForm((prev) => ({ ...prev, phone_extra: e.target.value }))} placeholder="Доп. телефон" className={modalInputClass} />
              <input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className={modalInputClass} />
              <input value={clientForm.passport_number} onChange={(e) => setClientForm((prev) => ({ ...prev, passport_number: e.target.value }))} placeholder="Паспорт" className={modalInputClass} />
              <input value={clientForm.pin} onChange={(e) => setClientForm((prev) => ({ ...prev, pin: e.target.value }))} placeholder="ПИН" className={modalInputClass} />
              <textarea value={clientForm.address} onChange={(e) => setClientForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="Адрес" className={`${modalInputClass} min-h-[72px]`} />
              <textarea value={clientForm.comment} onChange={(e) => setClientForm((prev) => ({ ...prev, comment: e.target.value }))} placeholder="Комментарий" className={`${modalInputClass} min-h-[96px]`} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeClientModal} className={subtleButtonClass}>Отмена</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">
                {saving ? "Сохранение..." : editingClient ? "Сохранить" : "Создать"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
