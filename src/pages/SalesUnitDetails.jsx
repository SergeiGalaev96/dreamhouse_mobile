import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Download, FileText, Pencil, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { AuthContext } from "../auth/AuthContext";
import PullToRefresh from "../components/PullToRefresh";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { normalizeDecimalInput, toNullableNumber } from "../utils/numberInput";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const EMPTY_ASSET_GROUPS = { "2d": [], "3d": [] };
const EMPTY_UNIT_FORM = {
  unit_number: "",
  lot_type: "apartment",
  rooms: "",
  area_total: "",
  price_total: "",
  currency: "",
  status_id: "",
  description: ""
};

const EMPTY_RESERVATION_FORM = {
  client_id: "",
  lead_id: "",
  start_at: "",
  expires_at: "",
  reservation_amount: "",
  currency: "",
  comment: "",
  status: "active",
  cancel_reason: ""
};

const EMPTY_DEAL_FORM = {
  client_id: "",
  lead_id: "",
  reservation_id: "",
  deal_type_id: "",
  status: "draft",
  deal_number: "",
  contract_number: "",
  contract_date: "",
  payment_type: "installment",
  total_amount: "",
  discount_amount: "",
  final_amount: "",
  currency: "",
  note: "",
  canceled_reason: ""
};

const EMPTY_PAYMENT_FORM = {
  deal_id: "",
  amount: "",
  currency: "",
  planned_date: "",
  paid_date: "",
  title: ""
};

const LOT_TYPE_LABELS = {
  apartment: "Квартира",
  parking: "Паркинг",
  storage: "Кладовая",
  commercial: "Коммерция"
};

const RESERVATION_STATUS_LABELS = {
  active: "Активная",
  closed: "Закрыта",
  canceled: "Отменена"
};

const DEAL_STATUS_LABELS = {
  draft: "Черновик",
  active: "Подписан",
  signed: "Подписан",
  closed: "Подписан",
  canceled: "Отменен"
};

const DEAL_PAYMENT_TYPE_LABELS = {
  full: "Полная оплата",
  installment: "Рассрочка",
  ddu: "ДДУ"
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
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-gray-400">{subtitle}</div> : null}
          </div>
          <button onClick={onClose} className="rounded bg-gray-800 px-3 py-1 text-white hover:bg-gray-700">
            Закрыть
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

export default function SalesUnitDetails() {
  const { projectId, blockId, floorId, unitId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [project, setProject] = useState(null);
  const [overview, setOverview] = useState(null);
  const [unitStatuses, setUnitStatuses] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [filesSaving, setFilesSaving] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [unitFiles, setUnitFiles] = useState([]);
  const [passport, setPassport] = useState(null);
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [dealTypes, setDealTypes] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [paymentArticles, setPaymentArticles] = useState([]);
  const [paymentCounterpartyTypes, setPaymentCounterpartyTypes] = useState([]);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [reservationForm, setReservationForm] = useState(EMPTY_RESERVATION_FORM);
  const [dealForm, setDealForm] = useState(EMPTY_DEAL_FORM);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [genericFilesContext, setGenericFilesContext] = useState(null);
  const [genericDocumentId, setGenericDocumentId] = useState(null);
  const [genericFiles, setGenericFiles] = useState([]);
  const [activeTab, setActiveTab] = useState("2d");
  const [planVisible, setPlanVisible] = useState(false);
  const [activeIndexByKind, setActiveIndexByKind] = useState({ "2d": 0, "3d": 0 });
  const [assetGroups, setAssetGroups] = useState(EMPTY_ASSET_GROUPS);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
  const [expandedClientKeys, setExpandedClientKeys] = useState([]);
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
  const reservations = passport?.reservations || [];
  const deals = passport?.deals || [];
  const payments = passport?.payments || [];
  const activeReservation = reservations.find((item) => item.status === "active") || null;
  const activeDeal = deals.find((item) => ["active", "signed", "closed"].includes(item.status)) || deals[0] || null;
  const incomePaymentType = paymentTypes.find((item) => item.code === "income") || paymentTypes[0] || null;
  const salePaymentArticle = paymentArticles.find((item) => item.code === "sale_apartment_income")
    || paymentArticles.find((item) => Number(item.payment_type) === Number(incomePaymentType?.id))
    || paymentArticles[0]
    || null;
  const clientCounterpartyType = paymentCounterpartyTypes.find((item) => item.code === "client") || null;
  const getCounterpartyTypeCode = (value) => (
    paymentCounterpartyTypes.find((item) => Number(item.id) === Number(value))?.code || ""
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

  const normalizeEntityType = (value) => String(value || "").toLowerCase();
  const canManageReservation = (reservation) => {
    if (!reservation) return false;
    if (Number(user?.role_id) === 1) return true;

    const currentUserId = Number(user?.id);
    return Boolean(
      currentUserId &&
      (
        Number(reservation.reserved_by_user_id) === currentUserId ||
        Number(reservation.created_by) === currentUserId
      )
    );
  };

  const clientHistory = useMemo(() => {
    const groups = new Map();

    const ensureGroup = (clientId, client = null) => {
      const key = clientId ? `client-${clientId}` : "client-empty";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          client_id: clientId || null,
          client,
          reservations: [],
          deals: [],
          payments: [],
          latestDate: null
        });
      }

      const group = groups.get(key);
      if (!group.client && client) group.client = client;
      return group;
    };

    const touchDate = (group, value) => {
      if (!value) return;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return;
      if (!group.latestDate || date > group.latestDate) group.latestDate = date;
    };

    reservations.forEach((reservation) => {
      const clientId = reservation.client_id ? Number(reservation.client_id) : null;
      const group = ensureGroup(clientId, reservation.client || null);
      group.reservations.push(reservation);
      touchDate(group, reservation.updated_at || reservation.created_at || reservation.start_at);
    });

    deals.forEach((deal) => {
      const clientId = deal.client_id ? Number(deal.client_id) : null;
      const group = ensureGroup(clientId, deal.client || null);
      group.deals.push(deal);
      touchDate(group, deal.updated_at || deal.created_at || deal.contract_date);
    });

    const dealToGroup = new Map();
    const reservationToGroup = new Map();
    groups.forEach((group) => {
      group.deals.forEach((deal) => dealToGroup.set(Number(deal.id), group.key));
      group.reservations.forEach((reservation) => reservationToGroup.set(Number(reservation.id), group.key));
    });

    payments.forEach((payment) => {
      const entityType = normalizeEntityType(payment.entity_type);
      let groupKey = null;

      if (entityType === "salesdeal") {
        groupKey = dealToGroup.get(Number(payment.entity_id));
      } else if (entityType === "salesreservation") {
        groupKey = reservationToGroup.get(Number(payment.entity_id));
      }

      if (!groupKey && getCounterpartyTypeCode(payment.counterparty_type) === "client" && payment.counterparty_id) {
        groupKey = `client-${Number(payment.counterparty_id)}`;
      }

      if (!groupKey) return;

      const group = groups.get(groupKey) || ensureGroup(Number(payment.counterparty_id) || null, null);
      group.payments.push(payment);
      touchDate(group, payment.paid_date || payment.planned_date || payment.created_at);
    });

    const statusPriority = { buyout: 1, reservation: 2, history: 3 };
    return Array.from(groups.values())
      .map((group) => {
        const hasBuyout = group.deals.some((deal) => ["active", "signed", "closed"].includes(deal.status));
        const hasReservation = group.reservations.some((reservation) => reservation.status === "active");
        const status = hasBuyout ? "buyout" : hasReservation ? "reservation" : "history";
        return {
          ...group,
          status,
          statusLabel: hasBuyout ? "Выкуп" : hasReservation ? "Бронь" : "История"
        };
      })
      .sort((a, b) => {
        const priorityDiff = (statusPriority[a.status] || 9) - (statusPriority[b.status] || 9);
        if (priorityDiff) return priorityDiff;
        return (b.latestDate?.getTime() || 0) - (a.latestDate?.getTime() || 0);
      });
  }, [reservations, deals, payments, paymentCounterpartyTypes]);

  const currentAssets = assetGroups[activeTab] || [];
  const currentIndex = Math.min(activeIndexByKind[activeTab] || 0, Math.max(currentAssets.length - 1, 0));
  const currentAsset = currentAssets[currentIndex] || null;
  const currentTabLabel = activeTab === "3d" ? "3D план" : "2D план";

  const revokeAssetUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  };

  useEffect(() => () => revokeAssetUrls(), []);

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
    return `${Number(value).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    })} м²`;
  };

  const unitTitleParts = [
    `Квартира №${unit?.unit_number || "—"}`,
    unit?.rooms ? `${unit.rooms} ком` : null,
    unit?.area_total ? formatArea(unit.area_total) : null
  ].filter(Boolean);

  const formatDateShort = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("ru-RU");
  };

  const formatDateTimeShort = (value) => {
    return formatDateShort(value);
  };

  const toDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const getClientName = (clientId, fallback = "Клиент") => {
    const client = clients.find((item) => Number(item.id) === Number(clientId));
    return client?.full_name || client?.label || fallback;
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
      const results = await Promise.allSettled([
        getRequest(`/projects/getById/${projectId}`),
        getRequest(`/sales/blocks/${blockId}/overview`),
        getRequest("/sales/unit-statuses"),
        getRequest(`/sales/units/${unitId}/passport`),
        postRequest("/sales/clients/search", { project_id: Number(projectId), block_id: Number(blockId), page: 1, size: 200 }),
        postRequest("/sales/leads/search", { project_id: Number(projectId), block_id: Number(blockId), exclude_converted: true, page: 1, size: 200 }),
        getRequest("/sales/deal-types"),
        getRequest("/payments/types"),
        getRequest("/payments/articles"),
        getRequest("/payments/counterparty-types"),
        loadDictionaries(["currencies"])
      ]);

      const [
        projectResult,
        overviewResult,
        statusesResult,
        passportResult,
        clientsResult,
        leadsResult,
        dealTypesResult,
        paymentTypesResult,
        paymentArticlesResult,
        paymentCounterpartyTypesResult,
        dictsResult
      ] = results;

      const projectRes = projectResult.status === "fulfilled" ? projectResult.value : null;
      const overviewRes = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      const statusesRes = statusesResult.status === "fulfilled" ? statusesResult.value : null;
      const passportRes = passportResult.status === "fulfilled" ? passportResult.value : null;
      const clientsRes = clientsResult.status === "fulfilled" ? clientsResult.value : null;
      const leadsRes = leadsResult.status === "fulfilled" ? leadsResult.value : null;
      const dealTypesRes = dealTypesResult.status === "fulfilled" ? dealTypesResult.value : null;
      const paymentTypesRes = paymentTypesResult.status === "fulfilled" ? paymentTypesResult.value : null;
      const paymentArticlesRes = paymentArticlesResult.status === "fulfilled" ? paymentArticlesResult.value : null;
      const paymentCounterpartyTypesRes = paymentCounterpartyTypesResult.status === "fulfilled" ? paymentCounterpartyTypesResult.value : null;
      const dicts = dictsResult.status === "fulfilled" ? dictsResult.value : {};

      if (passportResult.status === "rejected") {
        console.error("SalesUnitDetails passport load error", passportResult.reason);
        setPassport({ reservations: [], deals: [], payments: [] });
      }

      if (projectRes?.success) setProject(projectRes.data || null);
      if (overviewRes?.success) setOverview(overviewRes.data || null);
      if (statusesRes?.success) setUnitStatuses(statusesRes.data || []);
      if (passportRes?.success) setPassport(passportRes.data || null);
      if (clientsRes?.success) setClients(clientsRes.data || []);
      if (leadsRes?.success) setLeads(leadsRes.data || []);
      if (dealTypesRes?.success) setDealTypes(dealTypesRes.data || []);
      if (paymentTypesRes?.success) setPaymentTypes(paymentTypesRes.data || []);
      if (paymentArticlesRes?.success) setPaymentArticles(paymentArticlesRes.data || []);
      if (paymentCounterpartyTypesRes?.success) setPaymentCounterpartyTypes(paymentCounterpartyTypesRes.data || []);
      setCurrencies(dicts?.currencies || []);
    } catch (error) {
      console.error("SalesUnitDetails load error", error);
      toast.error(error?.response?.data?.message || "Не удалось загрузить квартиру");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [projectId, blockId, unitId]);

  const handleRefresh = async () => {
    await loadPage();
    if (planVisible) await loadAssets();
  };

  const openPlanTab = async (kind) => {
    setActiveTab(kind);
    setPlanVisible(true);
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
      currency: unit?.currency ? String(unit.currency) : (defaultCurrencyId ? String(defaultCurrencyId) : ""),
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
        area_total: toNullableNumber(unitForm.area_total),
        price_total: toNullableNumber(unitForm.price_total),
        currency: unitForm.currency ? Number(unitForm.currency) : null,
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
      if (planVisible) {
        await loadAssets();
      }
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
      if (planVisible) {
        await loadAssets();
      }
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

  const openReservationModal = (reservation = null) => {
    if (!reservation && activeReservation) {
      toast.error("По этой квартире уже есть активная бронь");
      return;
    }

    if (reservation && !canManageReservation(reservation)) {
      toast.error("Редактировать бронь может только ее менеджер или админ");
      return;
    }

    setEditingReservation(reservation);
    setReservationForm(reservation ? {
      client_id: reservation.client_id ? String(reservation.client_id) : "",
      start_at: toDateInput(reservation.start_at),
      expires_at: toDateInput(reservation.expires_at),
      reservation_amount: formatEditableNumber(reservation.reservation_amount),
      currency: reservation.currency ? String(reservation.currency) : (defaultCurrencyId ? String(defaultCurrencyId) : ""),
      comment: reservation.comment || "",
      status: reservation.status || "active",
      cancel_reason: reservation.cancel_reason || ""
    } : {
      ...EMPTY_RESERVATION_FORM,
      start_at: toDateInput(new Date()),
      status: "active",
      currency: defaultCurrencyId ? String(defaultCurrencyId) : ""
    });
    setReservationModalOpen(true);
  };

  const openDealModal = (deal = null, defaults = {}) => {
    setEditingDeal(deal);
    setDealForm(deal ? {
      client_id: deal.client_id ? String(deal.client_id) : "",
      lead_id: deal.lead_id ? String(deal.lead_id) : "",
      reservation_id: deal.reservation_id ? String(deal.reservation_id) : "",
      deal_type_id: deal.deal_type_id ? String(deal.deal_type_id) : "",
      status: deal.status || "draft",
      deal_number: deal.deal_number || "",
      contract_number: deal.contract_number || "",
      contract_date: deal.contract_date || "",
      payment_type: deal.payment_type || "installment",
      total_amount: formatEditableNumber(deal.total_amount),
      discount_amount: formatEditableNumber(deal.discount_amount),
      final_amount: formatEditableNumber(deal.final_amount),
      currency: deal.currency ? String(deal.currency) : (defaultCurrencyId ? String(defaultCurrencyId) : ""),
      note: deal.note || "",
      canceled_reason: deal.canceled_reason || ""
    } : {
      ...EMPTY_DEAL_FORM,
      client_id: defaults.client_id ? String(defaults.client_id) : (activeReservation?.client_id ? String(activeReservation.client_id) : ""),
      lead_id: "",
      reservation_id: defaults.reservation_id ? String(defaults.reservation_id) : (activeReservation?.id ? String(activeReservation.id) : ""),
      deal_type_id: defaults.deal_type_id ? String(defaults.deal_type_id) : "",
      status: defaults.status || "draft",
      contract_date: defaults.contract_date || "",
      payment_type: defaults.payment_type || "installment",
      total_amount: formatEditableNumber(unit?.price_total),
      final_amount: formatEditableNumber(unit?.price_total),
      currency: unit?.currency ? String(unit.currency) : (defaultCurrencyId ? String(defaultCurrencyId) : ""),
      note: defaults.note || ""
    });
    setDealModalOpen(true);
  };

  const getPreferredDealTypeId = () => {
    const preferredNames = ["выкуп", "обычный", "продажа"];
    const preferredCodes = ["buyout", "sale", "regular"];
    const match = dealTypes.find((type) => {
      const code = String(type.code || "").toLowerCase();
      const name = String(type.name || "").toLowerCase();
      return preferredCodes.includes(code) || preferredNames.some((part) => name.includes(part));
    });
    return match?.id || "";
  };

  const openBuyoutModal = (defaults = {}) => {
    openDealModal(null, {
      deal_type_id: getPreferredDealTypeId(),
      status: "draft",
      contract_date: toDateInput(new Date()),
      payment_type: "full",
      note: "Выкуп квартиры",
      ...defaults
    });
  };

  const openPaymentModal = (deal = null) => {
    const paymentDeal = deal || activeDeal;
    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      deal_id: paymentDeal?.id ? String(paymentDeal.id) : "",
      currency: unit?.currency ? String(unit.currency) : (defaultCurrencyId ? String(defaultCurrencyId) : ""),
      title: paymentDeal?.id
        ? `Платеж по договору №${paymentDeal.contract_number || paymentDeal.id}`
        : `Платеж по квартире №${unit?.unit_number || unitId}`
    });
    setPaymentModalOpen(true);
  };

  const toggleClientHistory = (key) => {
    setExpandedClientKeys((prev) => (
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    ));
  };

  const saveReservation = async (event) => {
    event.preventDefault();
    try {
      setFilesSaving(true);
      if (!editingReservation && activeReservation) {
        throw new Error("По этой квартире уже есть активная бронь");
      }

      if (editingReservation && !canManageReservation(editingReservation)) {
        throw new Error("Редактировать бронь может только ее менеджер или админ");
      }

      if (!reservationForm.client_id) {
        throw new Error("Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р° РґР»СЏ Р±СЂРѕРЅРё");
      }

      const payload = {
        unit_id: Number(unitId),
        client_id: reservationForm.client_id ? Number(reservationForm.client_id) : null,
        lead_id: null,
        start_at: reservationForm.start_at || null,
        expires_at: reservationForm.expires_at || null,
        reservation_amount: reservationForm.reservation_amount || null,
        currency: reservationForm.currency ? Number(reservationForm.currency) : null,
        comment: reservationForm.comment || null,
        status: editingReservation ? reservationForm.status : "active",
        cancel_reason: reservationForm.cancel_reason || null
      };

      const res = editingReservation
        ? await putRequest(`/sales/reservations/update/${editingReservation.id}`, payload)
        : await postRequest("/sales/reservations/create", payload);

      if (!res?.success) throw new Error(res?.message || "Не удалось сохранить бронь");
      toast.success(editingReservation ? "Бронь обновлена" : "Бронь создана");
      setReservationModalOpen(false);
      await handleRefresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Ошибка сохранения брони");
    } finally {
      setFilesSaving(false);
    }
  };

  const cancelReservation = async (reservation) => {
    if (!reservation?.id) return;
    if (!canManageReservation(reservation)) {
      toast.error("Снять бронь может только ее менеджер или админ");
      return;
    }

    try {
      setFilesSaving(true);
      const res = await putRequest(`/sales/reservations/update/${reservation.id}`, {
        status: "canceled",
        cancel_reason: "Бронь снята менеджером"
      });

      if (!res?.success) throw new Error(res?.message || "Не удалось снять бронь");
      toast.success("Бронь снята");
      await handleRefresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Ошибка снятия брони");
    } finally {
      setFilesSaving(false);
    }
  };

  const updateDealStatus = async (deal, status) => {
    if (!deal?.id) return;

    try {
      setFilesSaving(true);
      const res = await putRequest(`/sales/deals/update/${deal.id}`, { status });
      if (!res?.success) throw new Error(res?.message || "Не удалось обновить статус договора");
      toast.success(status === "signed" ? "Договор подписан" : "Договор отменен");
      await handleRefresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Ошибка обновления статуса договора");
    } finally {
      setFilesSaving(false);
    }
  };

  const saveDeal = async (event) => {
    event.preventDefault();
    try {
      setFilesSaving(true);
      const payload = {
        unit_id: Number(unitId),
        client_id: dealForm.client_id ? Number(dealForm.client_id) : null,
        lead_id: dealForm.lead_id ? Number(dealForm.lead_id) : null,
        reservation_id: dealForm.reservation_id ? Number(dealForm.reservation_id) : null,
        deal_type_id: dealForm.deal_type_id ? Number(dealForm.deal_type_id) : null,
        status: dealForm.status,
        deal_number: dealForm.deal_number || null,
        contract_number: dealForm.contract_number || null,
        contract_date: dealForm.contract_date || null,
        payment_type: dealForm.payment_type || null,
        total_amount: toNullableNumber(dealForm.total_amount),
        discount_amount: toNullableNumber(dealForm.discount_amount),
        final_amount: toNullableNumber(dealForm.final_amount),
        currency: dealForm.currency ? Number(dealForm.currency) : null,
        note: dealForm.note || null,
        canceled_reason: dealForm.canceled_reason || null
      };

      const res = editingDeal
        ? await putRequest(`/sales/deals/update/${editingDeal.id}`, payload)
        : await postRequest("/sales/deals/create", payload);

      if (!res?.success) throw new Error(res?.message || "Не удалось сохранить договор");
      toast.success(editingDeal ? "Договор обновлен" : "Договор создан");
      setDealModalOpen(false);
      await handleRefresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Ошибка сохранения договора");
    } finally {
      setFilesSaving(false);
    }
  };

  const createUnitPayment = async (event) => {
    event.preventDefault();
    try {
      setFilesSaving(true);
      const selectedDeal = deals.find((item) => Number(item.id) === Number(paymentForm.deal_id));
      const clientId = selectedDeal?.client_id || activeReservation?.client_id || null;
      const payload = {
        project_id: Number(projectId),
        block_id: Number(blockId),
        payment_type: incomePaymentType?.id ? Number(incomePaymentType.id) : null,
        article_id: salePaymentArticle?.id ? Number(salePaymentArticle.id) : null,
        entity_type: selectedDeal ? "salesDeal" : "salesUnit",
        entity_id: selectedDeal ? Number(selectedDeal.id) : Number(unitId),
        title: paymentForm.title || `Платеж по квартире №${unit?.unit_number || unitId}`,
        amount: paymentForm.amount,
        currency: paymentForm.currency ? Number(paymentForm.currency) : null,
        planned_date: paymentForm.planned_date || null,
        paid_date: paymentForm.paid_date || null,
        counterparty_type: clientId && clientCounterpartyType?.id ? Number(clientCounterpartyType.id) : null,
        counterparty_id: clientId,
        counterparty_name: clientId ? getClientName(clientId, selectedDeal?.client?.full_name || "") : null,
        is_manual: false
      };

      const res = await postRequest("/payments/create", payload);
      if (!res?.success) throw new Error(res?.message || "Не удалось создать платеж");
      toast.success("Платеж создан");
      setPaymentModalOpen(false);
      await handleRefresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Ошибка создания платежа");
    } finally {
      setFilesSaving(false);
    }
  };

  const openGenericFiles = async ({ entityType, entityId, title, description }) => {
    try {
      setFilesSaving(true);
      setGenericFilesContext({ entityType, entityId, title, description });

      const docsRes = await postRequest("/documents/search", {
        entity_type: entityType,
        entity_id: Number(entityId),
        page: 1,
        size: 20
      });

      let doc = docsRes?.success && Array.isArray(docsRes.data) ? docsRes.data[0] || null : null;

      if (!doc) {
        const createRes = await postRequest("/documents/create", {
          entity_type: entityType,
          entity_id: Number(entityId),
          name: title,
          description,
          status: 1
        });
        if (!createRes?.success) throw new Error(createRes?.message || "Не удалось создать папку файлов");
        doc = createRes.data;
      }

      setGenericDocumentId(doc.id);
      const filesRes = await getRequest(`/documentFiles/files/${doc.id}`);
      setGenericFiles(filesRes?.success ? filesRes.data || [] : []);
    } catch (error) {
      toast.error(error?.message || "Не удалось открыть файлы");
      setGenericFilesContext(null);
    } finally {
      setFilesSaving(false);
    }
  };

  const uploadGenericFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !genericDocumentId) return;

    try {
      setFilesSaving(true);
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const res = await api.post(`/documentFiles/upload/${genericDocumentId}`, formData);
      if (!res.data?.success) throw new Error(res.data?.message || "Не удалось загрузить файлы");
      const filesRes = await getRequest(`/documentFiles/files/${genericDocumentId}`);
      setGenericFiles(filesRes?.success ? filesRes.data || [] : []);
      toast.success("Файлы загружены");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки файлов");
    } finally {
      setFilesSaving(false);
      event.target.value = null;
    }
  };

  const deleteGenericFile = async (fileId) => {
    if (!window.confirm("Удалить файл?")) return;
    const res = await deleteRequest(`/documentFiles/${fileId}`);
    if (res?.success) {
      setGenericFiles((prev) => prev.filter((item) => Number(item.id) !== Number(fileId)));
      toast.success("Файл удален");
    } else {
      toast.error(res?.message || "Не удалось удалить файл");
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
            <h1 className={`text-xl font-semibold ${titleClass}`}>{unitTitleParts.join(", ")}</h1>
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
              {formatMoney(unit?.price_total, unit?.currency, unit?.currency_info)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openPlanTab("2d")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm sm:flex-none ${planVisible && activeTab === "2d" ? "bg-amber-400 text-slate-900" : "bg-gray-800 text-white"}`}
            >
              2D План
            </button>
            <button
              type="button"
              onClick={() => openPlanTab("3d")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm sm:flex-none ${planVisible && activeTab === "3d" ? "bg-amber-400 text-slate-900" : "bg-gray-800 text-white"}`}
            >
              3D План
            </button>
            <button type="button" onClick={openAssetsManager} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white sm:flex-none">
              Файлы
            </button>
          </div>
        </div>

        {planVisible ? (
        <div className="space-y-4">
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
        </div>
        ) : null}

        <section className={`${panelClass} mt-4 space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className={`font-semibold ${titleClass}`}>Клиенты квартиры</div>
              <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                История броней, договоров и платежей по каждому клиенту
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => openBuyoutModal()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
                <Plus size={14} className="inline" /> Выкуп
              </button>
              {!activeReservation ? (
                <button onClick={() => openReservationModal()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
                  <Plus size={14} className="inline" /> Бронь
                </button>
              ) : null}
            </div>
          </div>

          {clientHistory.length ? (
            <div className="space-y-2">
              {clientHistory.map((group) => {
                const isExpanded = expandedClientKeys.includes(group.key);
                const statusClass = group.status === "buyout"
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                  : group.status === "reservation"
                    ? "border-yellow-400 bg-yellow-500/15 text-yellow-300"
                    : "border-slate-500 bg-slate-500/10 text-slate-300";
                const activeGroupReservation = group.reservations.find((item) => item.status === "active") || group.reservations[0] || null;
                return (
                  <div key={group.key} className={`${cardClass} p-0`}>
                    <button
                      type="button"
                      onClick={() => toggleClientHistory(group.key)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {group.client?.full_name || group.client?.phone || "Клиент не выбран"}
                        </div>
                        <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                          Договоров: {group.deals.length} · Платежей: {group.payments.length}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass}`}>
                          {group.statusLabel}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-slate-700/70 px-3 py-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <CalendarClock size={16} className="text-amber-400" />
                            Брони
                          </div>
                          {group.reservations.length ? group.reservations.map((reservation) => (
                            <div key={reservation.id} className="rounded-xl border border-slate-700/80 bg-slate-950/25 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold">{RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}</div>
                                {canManageReservation(reservation) ? (
                                  <div className="flex shrink-0 gap-2">
                                    {reservation.status === "active" ? (
                                      <button
                                        type="button"
                                        disabled={filesSaving}
                                        onClick={() => cancelReservation(reservation)}
                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
                                      >
                                        Снять бронь
                                      </button>
                                    ) : null}
                                    <button onClick={() => openReservationModal(reservation)} className={themeControl.actionTilePadded(isDark)}>
                                      <Pencil size={14} />
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                              <div className={`mt-2 grid grid-cols-2 gap-2 text-xs ${secondaryTextClass}`}>
                                <div>С: <span className={titleClass}>{formatDateShort(reservation.start_at)}</span></div>
                                <div>До: <span className={titleClass}>{formatDateShort(reservation.expires_at)}</span></div>
                                <div>Менеджер: <span className={titleClass}>{reservation.reserved_by_user?.username || "—"}</span></div>
                                <div>Сумма: <span className={titleClass}>{formatMoney(reservation.reservation_amount, reservation.currency, reservation.currency_info)}</span></div>
                              </div>
                            </div>
                          )) : (
                            <div className={`rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs ${secondaryTextClass}`}>
                              Броней по этому клиенту нет
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <FileText size={16} className="text-blue-400" />
                              Договоры
                            </div>
                            {group.client_id ? (
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => openBuyoutModal({
                                    client_id: group.client_id,
                                    reservation_id: activeGroupReservation?.id
                                  })}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                                >
                                  <Plus size={14} className="inline" /> Выкуп
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDealModal(null, {
                                    client_id: group.client_id,
                                    reservation_id: activeGroupReservation?.id
                                  })}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
                                >
                                  <Plus size={14} className="inline" /> Договор
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {group.deals.length ? group.deals.map((deal) => {
                            const dealPayments = group.payments.filter((payment) => (
                              normalizeEntityType(payment.entity_type) === "salesdeal"
                              && Number(payment.entity_id) === Number(deal.id)
                            ));

                            return (
                              <div key={deal.id} className="rounded-xl border border-slate-700/80 bg-slate-950/25 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold">№{deal.contract_number || deal.deal_number || deal.id}</div>
                                    <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                                      {DEAL_STATUS_LABELS[deal.status] || deal.status}
                                    </div>
                                  </div>
                                  <button onClick={() => openDealModal(deal)} className={themeControl.actionTilePadded(isDark)}>
                                    <Pencil size={14} />
                                  </button>
                                </div>
                                <div className={`mt-3 grid grid-cols-2 gap-2 text-xs ${secondaryTextClass}`}>
                                  <div>Дата: <span className={titleClass}>{formatDateShort(deal.contract_date)}</span></div>
                                  <div>Тип: <span className={titleClass}>{deal.deal_type?.name || DEAL_PAYMENT_TYPE_LABELS[deal.payment_type] || "—"}</span></div>
                                  <div className="col-span-2">Сумма: <span className={titleClass}>{formatMoney(deal.final_amount || deal.total_amount, deal.currency, deal.currency_info)}</span></div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openGenericFiles({
                                      entityType: "salesDeal",
                                      entityId: deal.id,
                                      title: `Файлы договора №${deal.contract_number || deal.id}`,
                                      description: `Договор, чеки и документы по квартире №${unit?.unit_number || unitId}`
                                    })}
                                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
                                  >
                                    <FileText size={14} className="inline" /> Файлы
                                  </button>
                                  {deal.status === "draft" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={filesSaving}
                                        onClick={() => updateDealStatus(deal, "signed")}
                                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                                      >
                                        Подписать
                                      </button>
                                      <button
                                        type="button"
                                        disabled={filesSaving}
                                        onClick={() => updateDealStatus(deal, "canceled")}
                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
                                      >
                                        Отменить
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                                <div className="mt-3 space-y-1.5">
                                  <div className={`text-xs font-semibold ${secondaryTextClass}`}>Платежи по договору</div>
                                  {dealPayments.length ? dealPayments.map((payment) => (
                                    <div key={payment.id} className="rounded-lg border border-slate-700/70 bg-slate-900/50 px-3 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="truncate text-xs font-semibold">{payment.title}</div>
                                          <div className={`mt-0.5 text-[11px] ${secondaryTextClass}`}>
                                            {payment.status_ref?.name || "Статус"} · {formatDateShort(payment.paid_date || payment.planned_date)}
                                          </div>
                                        </div>
                                        <div className="shrink-0 text-right text-xs font-semibold">
                                          {formatMoney(payment.amount, payment.currency, payment.currency_ref)}
                                        </div>
                                      </div>
                                    </div>
                                  )) : (
                                    <div className={`rounded-lg border border-dashed border-slate-700 px-3 py-3 text-center text-xs ${secondaryTextClass}`}>
                                      Платежей по договору пока нет
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }) : (
                            <div className={`rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs ${secondaryTextClass}`}>
                              Договоров по этому клиенту нет
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Wallet size={16} className="text-emerald-400" />
                              Платежи
                            </div>
                            {group.deals.length ? (
                              <button
                                type="button"
                                onClick={() => openPaymentModal(group.deals[0])}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                              >
                                <Plus size={14} className="inline" /> Платеж
                              </button>
                            ) : null}
                          </div>
                          {group.payments.length ? group.payments.map((payment) => (
                            <div key={payment.id} className="rounded-xl border border-slate-700/80 bg-slate-950/25 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold">{payment.title}</div>
                                  <div className={`mt-1 text-xs ${secondaryTextClass}`}>
                                    {payment.status_ref?.name || "Статус"} · {payment.article?.name || "Статья"}
                                  </div>
                                </div>
                                <div className="text-right text-sm font-semibold">
                                  {formatMoney(payment.amount, payment.currency, payment.currency_ref)}
                                </div>
                              </div>
                              <div className={`mt-2 grid grid-cols-2 gap-2 text-xs ${secondaryTextClass}`}>
                                <div>План: <span className={titleClass}>{formatDateShort(payment.planned_date)}</span></div>
                                <div>Факт: <span className={titleClass}>{formatDateShort(payment.paid_date)}</span></div>
                              </div>
                            </div>
                          )) : (
                            <div className={`rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs ${secondaryTextClass}`}>
                              Платежей по этому клиенту нет
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${cardClass} p-4 text-center text-sm ${secondaryTextClass}`}>
              По квартире пока нет клиентов. Создайте бронь на клиента, затем договор и платежи.
            </div>
          )}
        </section>
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

      {reservationModalOpen ? (
        <Modal
          title={editingReservation ? "Редактировать бронь" : "Новая бронь"}
          subtitle={`Квартира №${unit?.unit_number || "—"}`}
          onClose={() => setReservationModalOpen(false)}
        >
          <form onSubmit={saveReservation} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 [&>label:nth-child(n+2)]:hidden">
              <label>
                <div className="mb-1 text-xs text-gray-400">Клиент</div>
                <select required value={reservationForm.client_id} onChange={(e) => setReservationForm((prev) => ({ ...prev, client_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбран</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.full_name || client.phone || `Клиент #${client.id}`}</option>
                  ))}
                </select>
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Лид</div>
                <select value={reservationForm.lead_id} onChange={(e) => setReservationForm((prev) => ({ ...prev, lead_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбран</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>{lead.full_name || lead.phone || `Лид #${lead.id}`}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Начало</div>
                <input type="date" value={reservationForm.start_at} onChange={(e) => setReservationForm((prev) => ({ ...prev, start_at: e.target.value }))} className={modalInputClass} />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Окончание</div>
                <input type="date" value={reservationForm.expires_at} onChange={(e) => setReservationForm((prev) => ({ ...prev, expires_at: e.target.value }))} className={modalInputClass} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Сумма брони</div>
                <input value={reservationForm.reservation_amount} onChange={(e) => setReservationForm((prev) => ({ ...prev, reservation_amount: e.target.value }))} className={modalInputClass} inputMode="decimal" />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Валюта</div>
                <select value={reservationForm.currency} onChange={(e) => setReservationForm((prev) => ({ ...prev, currency: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбрана</option>
                  {currencies.map((item) => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}
                </select>
              </label>
            </div>
            {editingReservation ? (
              <label>
                <div className="mb-1 text-xs text-gray-400">Статус</div>
                <select value={reservationForm.status} onChange={(e) => setReservationForm((prev) => ({ ...prev, status: e.target.value }))} className={modalInputClass}>
                  {Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            ) : (
              <div>
                <div className="mb-1 text-xs text-gray-400">Статус</div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
                  Активная
                </div>
              </div>
            )}
            {reservationForm.status === "canceled" ? (
              <label>
                <div className="mb-1 text-xs text-gray-400">Причина отмены</div>
                <input value={reservationForm.cancel_reason} onChange={(e) => setReservationForm((prev) => ({ ...prev, cancel_reason: e.target.value }))} className={modalInputClass} />
              </label>
            ) : null}
            <label>
              <div className="mb-1 text-xs text-gray-400">Комментарий</div>
              <textarea value={reservationForm.comment} onChange={(e) => setReservationForm((prev) => ({ ...prev, comment: e.target.value }))} className={`${modalInputClass} min-h-[80px] resize-y`} />
            </label>
            <button type="submit" disabled={filesSaving} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-60">
              {filesSaving ? "Сохраняем..." : "Сохранить бронь"}
            </button>
          </form>
        </Modal>
      ) : null}

      {dealModalOpen ? (
        <Modal
          title={editingDeal ? "Редактировать договор" : "Новый договор"}
          subtitle={`Квартира №${unit?.unit_number || "—"}`}
          onClose={() => setDealModalOpen(false)}
        >
          <form onSubmit={saveDeal} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Клиент</div>
                <select value={dealForm.client_id} onChange={(e) => setDealForm((prev) => ({ ...prev, client_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Выберите клиента</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.full_name || client.phone || `Клиент #${client.id}`}</option>
                  ))}
                </select>
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Бронь</div>
                <select value={dealForm.reservation_id} onChange={(e) => setDealForm((prev) => ({ ...prev, reservation_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Без брони</option>
                  {reservations.map((item) => (
                    <option key={item.id} value={item.id}>Бронь #{item.id} · {RESERVATION_STATUS_LABELS[item.status] || item.status}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Тип сделки</div>
                <select value={dealForm.deal_type_id} onChange={(e) => setDealForm((prev) => ({ ...prev, deal_type_id: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбран</option>
                  {dealTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Статус</div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
                  {DEAL_STATUS_LABELS[dealForm.status] || "Черновик"}
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">№ договора</div>
                <input value={dealForm.contract_number} onChange={(e) => setDealForm((prev) => ({ ...prev, contract_number: e.target.value }))} className={modalInputClass} />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Дата договора</div>
                <input type="date" value={dealForm.contract_date} onChange={(e) => setDealForm((prev) => ({ ...prev, contract_date: e.target.value }))} className={modalInputClass} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Оплата</div>
                <select value={dealForm.payment_type} onChange={(e) => setDealForm((prev) => ({ ...prev, payment_type: e.target.value }))} className={modalInputClass}>
                  {Object.entries(DEAL_PAYMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Валюта</div>
                <select value={dealForm.currency} onChange={(e) => setDealForm((prev) => ({ ...prev, currency: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбрана</option>
                  {currencies.map((item) => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Сумма</div>
                <input value={dealForm.total_amount} onChange={(e) => setDealForm((prev) => ({ ...prev, total_amount: normalizeDecimalInput(e.target.value) }))} className={modalInputClass} inputMode="decimal" />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Скидка</div>
                <input value={dealForm.discount_amount} onChange={(e) => setDealForm((prev) => ({ ...prev, discount_amount: normalizeDecimalInput(e.target.value) }))} className={modalInputClass} inputMode="decimal" />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Итого</div>
                <input value={dealForm.final_amount} onChange={(e) => setDealForm((prev) => ({ ...prev, final_amount: normalizeDecimalInput(e.target.value) }))} className={modalInputClass} inputMode="decimal" />
              </label>
            </div>
            <label>
              <div className="mb-1 text-xs text-gray-400">Заметка</div>
              <textarea value={dealForm.note} onChange={(e) => setDealForm((prev) => ({ ...prev, note: e.target.value }))} className={`${modalInputClass} min-h-[80px] resize-y`} />
            </label>
            <button type="submit" disabled={filesSaving} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-60">
              {filesSaving ? "Сохраняем..." : "Сохранить договор"}
            </button>
          </form>
        </Modal>
      ) : null}

      {paymentModalOpen ? (
        <Modal title="Платеж по квартире" subtitle={`Квартира №${unit?.unit_number || "—"}`} onClose={() => setPaymentModalOpen(false)}>
          <form onSubmit={createUnitPayment} className="space-y-3">
            <label>
              <div className="mb-1 text-xs text-gray-400">Договор</div>
              <select value={paymentForm.deal_id} onChange={(e) => setPaymentForm((prev) => ({ ...prev, deal_id: e.target.value }))} className={modalInputClass}>
                <option value="">Привязать к квартире</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>Договор №{deal.contract_number || deal.id}</option>
                ))}
              </select>
            </label>
            <label>
              <div className="mb-1 text-xs text-gray-400">Название</div>
              <input value={paymentForm.title} onChange={(e) => setPaymentForm((prev) => ({ ...prev, title: e.target.value }))} className={modalInputClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Сумма</div>
                <input value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))} className={modalInputClass} inputMode="decimal" />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Валюта</div>
                <select value={paymentForm.currency} onChange={(e) => setPaymentForm((prev) => ({ ...prev, currency: e.target.value }))} className={modalInputClass}>
                  <option value="">Не выбрана</option>
                  {currencies.map((item) => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <div className="mb-1 text-xs text-gray-400">Плановая дата</div>
                <input type="date" value={paymentForm.planned_date} onChange={(e) => setPaymentForm((prev) => ({ ...prev, planned_date: e.target.value }))} className={modalInputClass} />
              </label>
              <label>
                <div className="mb-1 text-xs text-gray-400">Фактическая дата</div>
                <input type="date" value={paymentForm.paid_date} onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_date: e.target.value }))} className={modalInputClass} />
              </label>
            </div>
            <button type="submit" disabled={filesSaving} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-60">
              {filesSaving ? "Создаем..." : "Создать платеж"}
            </button>
          </form>
        </Modal>
      ) : null}

      {genericFilesContext ? (
        <Modal title={genericFilesContext.title} subtitle={genericFilesContext.description} onClose={() => setGenericFilesContext(null)}>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500">
              <Upload size={16} />
              {filesSaving ? "Загрузка..." : "Добавить файлы"}
              <input type="file" multiple className="hidden" onChange={uploadGenericFiles} />
            </label>
            {genericFiles.length ? genericFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                <div className="min-w-0 truncate text-sm">{file.name || `Файл #${file.id}`}</div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => handleDownloadAsset(file)} className="rounded-lg bg-gray-800 p-2 text-white hover:bg-gray-700">
                    <Download size={14} />
                  </button>
                  <button type="button" onClick={() => deleteGenericFile(file.id)} className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-gray-700 px-4 py-6 text-center text-sm text-gray-400">
                Файлы пока не прикреплены
              </div>
            )}
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
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, area_total: normalizeDecimalInput(e.target.value) }))}
                  className={modalInputClass}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-gray-400">Цена</div>
                <input
                  value={unitForm.price_total}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, price_total: normalizeDecimalInput(e.target.value) }))}
                  className={modalInputClass}
                  inputMode="decimal"
                />
              </label>
            </div>

            <label className="block">
              <div className="mb-1 text-xs text-gray-400">Валюта</div>
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
