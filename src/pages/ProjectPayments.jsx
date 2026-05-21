import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Download, FileText, Image as ImageIcon, Pencil, Plus, Search, Trash2, Upload, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { FileIcon, defaultStyles } from "react-file-icon";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { baseURL, reportsFallbackURLs } from "../api/axios";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { AuthContext } from "../auth/AuthContext";
import PullToRefresh from "../components/PullToRefresh";
import { useTheme } from "../context/ThemeContext";
import { getAuthToken } from "../utils/authStorage";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDate, formatDateReverse, formatDateTime } from "../utils/date";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const ADMIN_ROLE_ID = 1;
const ACCOUNTANT_ROLE_ID = 14;
const STATUS_CONTROL_ROLE_IDS = [ADMIN_ROLE_ID, ACCOUNTANT_ROLE_ID];

const EMPTY_PAYMENT_FORM = {
  block_id: "",
  payment_type: "",
  article_id: "",
  entity_type: "manual",
  entity_id: "",
  title: "",
  amount: "",
  currency: "",
  currency_rate: "1",
  planned_date: "",
  paid_date: "",
  counterparty_type: "",
  counterparty_id: "",
  counterparty_name: "",
  counterparty_inn: "",
  payment_method: "",
  account_type: "",
  document_number: "",
  external_number: "",
  description: "",
  comment: ""
};

const QUICK_FILTERS = [
  { key: "expense", label: "Расход" },
  { key: "income", label: "Доход" },
  { key: "all", label: "Все" }
];

const ENTITY_OPTIONS = [
  { value: "manual", label: "Ручной" },
  { value: "purchaseOrder", label: "Закуп" },
  { value: "workPerformed", label: "АВР" }
];

const COUNTERPARTY_TYPE_OPTIONS = [
  { value: "", label: "Не выбран" },
  { value: "client", label: "Клиент" },
  { value: "supplier", label: "Поставщик" },
  { value: "contractor", label: "Подрядчик" },
  { value: "employee", label: "Сотрудник" },
  { value: "other", label: "Другое" }
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "", label: "Не выбран" },
  { value: "cashbox", label: "Касса" },
  { value: "bank_account", label: "Банк. счет" }
];

const normalizeInnInput = (value) => String(value || "").replace(/\D/g, "").slice(0, 20);

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const isSomCurrency = (currency) => ["KGS", "СОМ", "SOM"].includes(String(currency || "").trim().toUpperCase());
const isSomCurrencyValue = (currency, currencies = []) => {
  const currencyItem = currencies.find(
    (item) => Number(item.id) === Number(currency) || String(item.code || item.label) === String(currency)
  );
  const value = String(currencyItem?.code || currencyItem?.label || currency || "").trim().toUpperCase();
  return ["KGS", "СОМ", "SOM"].includes(value);
};
const isImageFile = (file) => file?.mime_type?.startsWith("image");

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getWorkPerformedAmount = (act) =>
  (act?.items || []).reduce((acc, item) => {
    const currencyRate = Number(item.currency) === 1 ? 1 : toNumber(item.currency_rate) || 1;
    return acc + toNumber(item.quantity) * toNumber(item.price) * currencyRate;
  }, 0);

const getPurchaseOrderAmount = (order) =>
  (order?.items || []).reduce((acc, item) => {
    const itemSum = item.summ !== undefined && item.summ !== null
      ? toNumber(item.summ)
      : toNumber(item.quantity) * toNumber(item.price) * (Number(item.currency) === 1 ? 1 : toNumber(item.currency_rate) || 1);
    return acc + itemSum;
  }, 0);

const getPurchaseOrderSupplierIds = (order) => [
  ...new Set((order?.items || []).map((item) => Number(item.supplier_id)).filter(Boolean))
];

const getPurchaseOrderSupplierAmount = (order, supplierId) =>
  (order?.items || [])
    .filter((item) => Number(item.supplier_id) === Number(supplierId))
    .reduce((acc, item) => {
      const itemSum = item.summ !== undefined && item.summ !== null
        ? toNumber(item.summ)
        : toNumber(item.quantity) * toNumber(item.price) * (Number(item.currency) === 1 ? 1 : toNumber(item.currency_rate) || 1);
      return acc + itemSum;
    }, 0);

const getSourceOptionLabel = (entityType, item) => {
  if (!item) return "";

  if (entityType === "purchaseOrder") {
    const amount = getPurchaseOrderAmount(item);
    const title = item.id ? `Закуп №${item.id}` : "Закуп";
    const blockPart = item.block?.name ? ` • ${item.block.name}` : "";
    const amountPart = amount > 0 ? ` • ${formatMoney(amount)} KGS` : "";
    return `${title}${blockPart}${amountPart}`;
  }

  if (entityType === "workPerformed") {
    const amount = getWorkPerformedAmount(item);
    const title = item.code ? `АВР ${item.code}` : item.id ? `АВР №${item.id}` : "АВР";
    const amountPart = amount > 0 ? ` • ${formatMoney(amount)} KGS` : "";
    return `${title}${amountPart}`;
  }

  return item.label || `#${item.id}`;
};

const getStatusButtonPayload = (statusCode) => {
  if (statusCode === "paid") {
    return {
      paid_date: formatDateReverse(new Date()).replaceAll(".", "-")
    };
  }

  return {
    paid_date: null
  };
};

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-4 text-white shadow-2xl">
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

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-gray-400">{label}</div>
      {children}
    </label>
  );
}

export default function ProjectPayments() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [project, setProject] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [rates, setRates] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [paymentStatuses, setPaymentStatuses] = useState([]);
  const [paymentArticles, setPaymentArticles] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentCounterpartyTypes, setPaymentCounterpartyTypes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("expense");
  const [statusFilter, setStatusFilter] = useState("");
  const [articleFilter, setArticleFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [filesModalPayment, setFilesModalPayment] = useState(null);
  const [paymentDocumentId, setPaymentDocumentId] = useState(null);
  const [paymentFiles, setPaymentFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const swipeBackRef = useRef({ x: 0, y: 0, active: false });

  const pageClass = `space-y-3 pb-24 ${themeText.page(isDark)}`;
  const titleClass = themeText.title(isDark);
  const secondaryTextClass = themeText.secondary(isDark);
  const mutedTextClass = themeText.muted(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const cardClass = themeSurface.card(isDark);
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const inactiveTabClass = isDark ? "bg-gray-800 text-white" : "border border-slate-300 bg-white text-black";
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const actionTileClass = themeControl.actionTilePadded(isDark);
  const canControlStatus = STATUS_CONTROL_ROLE_IDS.includes(Number(user?.role_id));

  const getCounterpartyTypeCode = useCallback((value) => (
    paymentCounterpartyTypes.find((item) => Number(item.id) === Number(value))?.code || ""
  ), [paymentCounterpartyTypes]);

  const getCounterpartyTypeId = useCallback((code) => {
    const row = paymentCounterpartyTypes.find((item) => item.code === code);
    return row?.id ? String(row.id) : "";
  }, [paymentCounterpartyTypes]);

  const projectBlocks = useMemo(
    () => (dictionaries.projectBlocks || []).filter((item) => Number(item.project_id) === Number(projectId)),
    [dictionaries.projectBlocks, projectId]
  );

  const currencies = dictionaries.currencies || [];

  const defaultCurrency = useMemo(
    () => currencies.find((item) => ["KGS", "СОМ", "SOM"].includes(String(item.code || item.label || "").toUpperCase())) || currencies[0] || null,
    [currencies]
  );

  const getCurrencyMeta = useCallback((currencyValue) => (
    currencies.find(
      (item) => Number(item.id) === Number(currencyValue) || String(item.code || item.label) === String(currencyValue)
    ) || null
  ), [currencies]);

  const getCurrencyLabel = useCallback((currencyValue, currencyRef = null) => {
    const currency = currencyRef || getCurrencyMeta(currencyValue);
    return currency?.code || currency?.label || currency?.name || "KGS";
  }, [getCurrencyMeta]);

  const incomeType = useMemo(
    () => paymentTypes.find((item) => item.code === "income") || null,
    [paymentTypes]
  );

  const expenseType = useMemo(
    () => paymentTypes.find((item) => item.code === "expense") || null,
    [paymentTypes]
  );

  const currentCounterpartyOptions = useMemo(() => {
    const counterpartyTypeCode = getCounterpartyTypeCode(paymentForm.counterparty_type);

    if (counterpartyTypeCode === "supplier") {
      if (paymentForm.entity_type === "purchaseOrder" && paymentForm.entity_id) {
        const source = sourceOptions.find((item) => String(item.id) === String(paymentForm.entity_id));
        const supplierIds = getPurchaseOrderSupplierIds(source);
        return supplierIds.map((supplierId) => {
          const supplier = (dictionaries.suppliers || []).find((item) => Number(item.id) === supplierId);
          return supplier || { id: supplierId, label: `Поставщик #${supplierId}` };
        });
      }

      return dictionaries.suppliers || [];
    }
    if (counterpartyTypeCode === "contractor") return dictionaries.contractors || [];
    return [];
  }, [
    dictionaries.contractors,
    dictionaries.suppliers,
    getCounterpartyTypeCode,
    paymentForm.counterparty_type,
    paymentForm.entity_id,
    paymentForm.entity_type,
    sourceOptions
  ]);

  const filteredArticles = useMemo(() => {
    const selectedType =
      quickFilter === "income"
        ? incomeType?.id
        : quickFilter === "expense"
          ? expenseType?.id
          : null;

    if (!selectedType) return paymentArticles;
    return paymentArticles.filter((item) => Number(item.payment_type) === Number(selectedType));
  }, [paymentArticles, quickFilter, incomeType, expenseType]);

  const formArticles = useMemo(() => {
    const selectedType = Number(paymentForm.payment_type);
    if (!selectedType) return paymentArticles;
    return paymentArticles.filter((item) => Number(item.payment_type) === selectedType);
  }, [paymentArticles, paymentForm.payment_type]);

  const statusByCode = useMemo(() => {
    const map = {};
    for (const item of paymentStatuses) {
      map[item.code] = item;
    }
    return map;
  }, [paymentStatuses]);

  const getCurrencyRateById = useCallback((currencyId) => {
    if (!currencyId || isSomCurrencyValue(currencyId, currencies)) return "1";
    const currency = getCurrencyMeta(currencyId);
    if (!currency) return "";

    const rateRow = rates.find((item) => Number(item.currency_id) === Number(currency.id));
    return rateRow?.rate ? String(rateRow.rate) : "";
  }, [currencies, getCurrencyMeta, rates]);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        getRequest(`/projects/getById/${projectId}`),
        getRequest("/payments/types"),
        getRequest("/payments/statuses"),
        getRequest("/payments/articles"),
        getRequest("/payments/methods"),
        getRequest("/payments/counterparty-types"),
        loadDictionaries(["projectBlocks", "currencies", "suppliers", "contractors"]),
        getRequest(`/currencyRates/getByDate/${formatDateReverse(new Date())}`)
      ]);

      const [projectResult, typesResult, statusesResult, articlesResult, methodsResult, counterpartyTypesResult, dictionariesResult, ratesResult] = results;

      const projectRes = projectResult.status === "fulfilled" ? projectResult.value : null;
      const typesRes = typesResult.status === "fulfilled" ? typesResult.value : null;
      const statusesRes = statusesResult.status === "fulfilled" ? statusesResult.value : null;
      const articlesRes = articlesResult.status === "fulfilled" ? articlesResult.value : null;
      const methodsRes = methodsResult.status === "fulfilled" ? methodsResult.value : null;
      const counterpartyTypesRes = counterpartyTypesResult.status === "fulfilled" ? counterpartyTypesResult.value : null;
      const dicts = dictionariesResult.status === "fulfilled" ? dictionariesResult.value : {};
      const ratesRes = ratesResult.status === "fulfilled" ? ratesResult.value : null;

      if (projectResult.status === "rejected") console.error("ProjectPayments project load error", projectResult.reason);
      if (typesResult.status === "rejected") console.error("ProjectPayments types load error", typesResult.reason);
      if (statusesResult.status === "rejected") console.error("ProjectPayments statuses load error", statusesResult.reason);
      if (articlesResult.status === "rejected") console.error("ProjectPayments articles load error", articlesResult.reason);
      if (methodsResult.status === "rejected") console.error("ProjectPayments methods load error", methodsResult.reason);
      if (counterpartyTypesResult.status === "rejected") console.error("ProjectPayments counterparty types load error", counterpartyTypesResult.reason);
      if (dictionariesResult.status === "rejected") console.error("ProjectPayments dictionaries load error", dictionariesResult.reason);
      if (ratesResult.status === "rejected") console.error("ProjectPayments rates load error", ratesResult.reason);

      const nextProject = projectRes?.success ? projectRes.data || null : null;
      const nextTypes = typesRes?.success ? typesRes.data || [] : [];
      const nextStatuses = statusesRes?.success ? statusesRes.data || [] : [];
      const nextArticles = articlesRes?.success ? articlesRes.data || [] : [];
      const nextMethods = methodsRes?.success ? methodsRes.data || [] : [];
      const nextCounterpartyTypes = counterpartyTypesRes?.success ? counterpartyTypesRes.data || [] : [];
      const nextDicts = dicts || {};
      const nextRates = ratesRes?.success ? ratesRes.data || [] : [];
      const nextCurrencyItem = nextDicts.currencies?.find((item) => ["KGS", "СОМ", "SOM"].includes(String(item.code || item.label || "").toUpperCase()))
        || nextDicts.currencies?.[0]
        || null;
      const nextCurrency = nextCurrencyItem?.id ? String(nextCurrencyItem.id) : "";
      const nextDefaultType = nextTypes.find((item) => item.code === "expense")?.id || nextTypes[0]?.id || "";
      const nextRate =
        !nextCurrency || isSomCurrencyValue(nextCurrency, nextDicts.currencies || [])
          ? "1"
          : (() => {
              const currency = (nextDicts.currencies || []).find((item) => Number(item.id) === Number(nextCurrency));
              const rateRow = nextRates.find((item) => Number(item.currency_id) === Number(currency?.id));
              return rateRow?.rate ? String(rateRow.rate) : "";
            })();

      setProject(nextProject);
      setPaymentTypes(nextTypes);
      setPaymentStatuses(nextStatuses);
      setPaymentArticles(nextArticles);
      setPaymentMethods(nextMethods);
      setPaymentCounterpartyTypes(nextCounterpartyTypes);
      setDictionaries(nextDicts);
      setRates(nextRates);
      setPaymentForm((prev) => ({
        ...prev,
        payment_type: prev.payment_type || String(nextDefaultType),
        currency: prev.currency || nextCurrency,
        currency_rate: prev.currency_rate || nextRate
      }));
    } catch (error) {
      console.error("ProjectPayments loadInitial error", error);
      toast.error("Не удалось загрузить модуль платежей");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);

      const payload = {
        project_id: Number(projectId),
        block_id: blockFilter || undefined,
        article_id: articleFilter || undefined,
        search,
        page,
        size: 20
      };

      if (quickFilter === "income" && incomeType?.id) {
        payload.payment_type = Number(incomeType.id);
      } else if (quickFilter === "expense" && expenseType?.id) {
        payload.payment_type = Number(expenseType.id);
      }

      if (statusFilter) {
        payload.statuses = [Number(statusFilter)];
      }

      const res = await postRequest("/payments/search", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить платежи");
        return;
      }

      setPayments(res.data || []);
      setPagination(res.pagination || null);
    } catch (error) {
      console.error("ProjectPayments loadPayments error", error);
      toast.error("Ошибка загрузки платежей");
    } finally {
      setLoading(false);
    }
  }, [projectId, blockFilter, articleFilter, statusFilter, search, page, quickFilter, incomeType, expenseType]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!paymentTypes.length && !paymentStatuses.length) return;
    loadPayments();
  }, [loadPayments, paymentTypes.length, paymentStatuses.length]);

  useEffect(() => {
    if (!modalOpen) return;

    if (paymentForm.entity_type === "manual") {
      setSourceOptions([]);
      return;
    }

    if (!paymentForm.block_id) {
      setSourceOptions([]);
      return;
    }

    const loadSourceOptions = async () => {
      try {
        setLoadingSources(true);

        if (paymentForm.entity_type === "purchaseOrder") {
          const res = await postRequest("/purchaseOrders/search", {
            project_id: Number(projectId),
            block_id: Number(paymentForm.block_id),
            page: 1,
            size: 100
          });
          setSourceOptions(res?.success ? res.data || [] : []);
          return;
        }

        if (paymentForm.entity_type === "workPerformed") {
          const res = await postRequest("/workPerformed/search", {
            block_id: Number(paymentForm.block_id),
            page: 1,
            size: 100
          });
          const nextSources = res?.success ? res.data || [] : [];
          setSourceOptions(nextSources);

          const article = paymentArticles.find((item) => String(item.id) === String(paymentForm.article_id));
          const shouldSelectFirstAct = article?.code === "contractor_payment" && !paymentForm.entity_id && nextSources[0];

          if (shouldSelectFirstAct) {
            const source = nextSources[0];
            const total = getWorkPerformedAmount(source);
            const remaining = Math.max(total - toNumber(source.advance_payment), 0);
            const contractorName = source.performed_person_name || "";
            const contractor = (dictionaries.contractors || []).find(
              (item) => String(item.label || "").trim().toLowerCase() === contractorName.trim().toLowerCase()
            );

            setPaymentForm((prev) => ({
              ...prev,
              entity_id: String(source.id),
              title: `Оплата АВР ${source.code || `№${source.id}`}`,
              amount: formatAmountInput(remaining || total),
              counterparty_type: getCounterpartyTypeId("contractor"),
              counterparty_id: contractor ? String(contractor.id) : "",
              counterparty_name: contractor?.label || contractorName || ""
            }));
          }

          return;
        }

        setSourceOptions([]);
      } catch (error) {
        console.error("ProjectPayments loadSourceOptions error", error);
        toast.error("Не удалось загрузить список источников");
        setSourceOptions([]);
      } finally {
        setLoadingSources(false);
      }
    };

    loadSourceOptions();
  }, [dictionaries.contractors, getCounterpartyTypeId, modalOpen, paymentArticles, paymentForm.article_id, paymentForm.block_id, paymentForm.entity_id, paymentForm.entity_type]);

  const setQuickFilterAndResetPage = (value) => {
    setQuickFilter(value);
    setArticleFilter("");
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetForm = useCallback(() => {
    const defaultType =
      quickFilter === "income"
        ? incomeType?.id
        : quickFilter === "expense"
          ? expenseType?.id
          : expenseType?.id || incomeType?.id || "";
    const defaultBlockId = blockFilter || (projectBlocks[0]?.id ? String(projectBlocks[0].id) : "");

    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      block_id: defaultBlockId,
      payment_type: defaultType ? String(defaultType) : "",
      entity_type: "purchaseOrder",
      currency: defaultCurrency?.id ? String(defaultCurrency.id) : "",
      currency_rate: "1"
    });
    setSourceOptions([]);
    setEditingPayment(null);
  }, [blockFilter, defaultCurrency, expenseType, incomeType, projectBlocks, quickFilter]);

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (payment) => {
    setEditingPayment(payment);
    setPaymentForm({
      block_id: payment.block_id ? String(payment.block_id) : "",
      payment_type: payment.payment_type ? String(payment.payment_type) : "",
      article_id: payment.article_id ? String(payment.article_id) : "",
      entity_type: payment.entity_type || "manual",
      entity_id: payment.entity_id ? String(payment.entity_id) : "",
      title: payment.title || "",
      amount: payment.amount ?? "",
      currency: payment.currency ? String(payment.currency) : (defaultCurrency?.id ? String(defaultCurrency.id) : ""),
      currency_rate:
        payment.currency_rate ?? (getCurrencyRateById(payment.currency || defaultCurrency?.id) || ""),
      planned_date: payment.planned_date || "",
      paid_date: payment.paid_date || "",
      counterparty_type: payment.counterparty_type ? String(payment.counterparty_type) : "",
      counterparty_id: payment.counterparty_id ? String(payment.counterparty_id) : "",
      counterparty_name: payment.counterparty_name || "",
      counterparty_inn: payment.counterparty_inn || "",
      payment_method: payment.payment_method ? String(payment.payment_method) : "",
      account_type: payment.account_type || "",
      document_number: payment.document_number || "",
      external_number: payment.external_number || "",
      description: payment.description || "",
      comment: payment.comment || ""
    });
    setModalOpen(true);
  };

  const handleCurrencyChange = (currencyId) => {
    setPaymentForm((prev) => ({
      ...prev,
      currency: currencyId,
      currency_rate: getCurrencyRateById(currencyId)
    }));
  };

  const handleFormChange = (field, value) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleArticleChange = (value) => {
    const article = paymentArticles.find((item) => String(item.id) === String(value));
    const isSupplierPayment = article?.code === "supplier_payment";
    const isContractorPayment = article?.code === "contractor_payment";
    const nextEntityType = isSupplierPayment
      ? "purchaseOrder"
      : isContractorPayment
        ? "workPerformed"
        : null;

    setPaymentForm((prev) => ({
      ...prev,
      article_id: value,
      entity_type: nextEntityType || prev.entity_type,
      entity_id: nextEntityType && prev.entity_type !== nextEntityType ? "" : prev.entity_id,
      counterparty_type: isSupplierPayment ? getCounterpartyTypeId("supplier") : isContractorPayment ? getCounterpartyTypeId("contractor") : prev.counterparty_type,
      counterparty_id: isSupplierPayment || isContractorPayment ? "" : prev.counterparty_id,
      counterparty_name: isSupplierPayment || isContractorPayment ? "" : prev.counterparty_name
    }));

    if (nextEntityType && paymentForm.entity_type !== nextEntityType) {
      setSourceOptions([]);
    }
  };

  const handleBlockChange = (value) => {
    setPaymentForm((prev) => ({
      ...prev,
      block_id: value,
      entity_id: prev.entity_type === "manual" ? prev.entity_id : ""
    }));
    if (paymentForm.entity_type !== "manual") {
      setSourceOptions([]);
    }
  };

  const handleEntityTypeChange = (value) => {
    setPaymentForm((prev) => ({
      ...prev,
      entity_type: value,
      entity_id: "",
      counterparty_type: prev.counterparty_type,
      counterparty_id: prev.counterparty_id,
      counterparty_name: prev.counterparty_name
    }));
    setSourceOptions([]);
  };

  const formatAmountInput = (value) => {
    const amount = toNumber(value);
    if (!amount) return "";
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
  };

  const handleSourceChange = (value) => {
    const source = sourceOptions.find((item) => String(item.id) === String(value));

    setPaymentForm((prev) => {
      const next = {
        ...prev,
        entity_id: value
      };

      if (!source || !value) return next;

      if (prev.entity_type === "purchaseOrder") {
        const amount = getPurchaseOrderAmount(source);
        const supplierIds = getPurchaseOrderSupplierIds(source);
        const supplierPaymentArticle = paymentArticles.find((item) => String(item.id) === String(prev.article_id));
        const isSupplierPayment = supplierPaymentArticle?.code === "supplier_payment";
        const selectedSupplierId = supplierIds.includes(Number(prev.counterparty_id))
          ? Number(prev.counterparty_id)
          : supplierIds.length === 1
            ? supplierIds[0]
            : null;
        const supplier = selectedSupplierId
          ? (dictionaries.suppliers || []).find((item) => Number(item.id) === selectedSupplierId)
          : null;
        const supplierAmount = selectedSupplierId
          ? getPurchaseOrderSupplierAmount(source, selectedSupplierId)
          : null;

        return {
          ...next,
          title: `Оплата закупа №${source.id}`,
          amount: formatAmountInput(supplierAmount || amount),
          counterparty_type: isSupplierPayment || supplier ? getCounterpartyTypeId("supplier") : prev.counterparty_type,
          counterparty_id: selectedSupplierId ? String(selectedSupplierId) : "",
          counterparty_name: supplier?.label || ""
        };
      }

      if (prev.entity_type === "workPerformed") {
        const total = getWorkPerformedAmount(source);
        const remaining = Math.max(total - toNumber(source.advance_payment), 0);
        const contractorName = source.performed_person_name || "";
        const contractor = (dictionaries.contractors || []).find(
          (item) => String(item.label || "").trim().toLowerCase() === contractorName.trim().toLowerCase()
        );

        return {
          ...next,
          title: `Оплата АВР ${source.code || `№${source.id}`}`,
          amount: formatAmountInput(remaining || total),
          counterparty_type: contractor || contractorName ? getCounterpartyTypeId("contractor") : prev.counterparty_type,
          counterparty_id: contractor ? String(contractor.id) : prev.counterparty_id,
          counterparty_name: contractor?.label || contractorName || prev.counterparty_name
        };
      }

      return next;
    });
  };

  const handleCounterpartySelect = (value) => {
    const selected = currentCounterpartyOptions.find((item) => String(item.id) === String(value));
    const counterpartyTypeCode = getCounterpartyTypeCode(paymentForm.counterparty_type);
    const selectedPurchaseOrder = paymentForm.entity_type === "purchaseOrder" && paymentForm.entity_id
      ? sourceOptions.find((item) => String(item.id) === String(paymentForm.entity_id))
      : null;
    const supplierAmount = counterpartyTypeCode === "supplier" && selectedPurchaseOrder && value
      ? getPurchaseOrderSupplierAmount(selectedPurchaseOrder, value)
      : null;

    setPaymentForm((prev) => ({
      ...prev,
      counterparty_id: value,
      counterparty_name: selected?.label || "",
      amount: supplierAmount ? formatAmountInput(supplierAmount) : prev.amount
    }));
  };

  const handleCounterpartyTypeChange = (value) => {
    setPaymentForm((prev) => ({
      ...prev,
      counterparty_type: value,
      counterparty_id: "",
      counterparty_name: "",
      counterparty_inn: prev.counterparty_inn
    }));
  };

  const submitPayment = async () => {
    if (saving) return;
    const counterpartyTypeCode = getCounterpartyTypeCode(paymentForm.counterparty_type);

    const payload = {
      project_id: Number(projectId),
      block_id: paymentForm.block_id ? Number(paymentForm.block_id) : null,
      payment_type: paymentForm.payment_type ? Number(paymentForm.payment_type) : null,
      article_id: paymentForm.article_id ? Number(paymentForm.article_id) : null,
      entity_type: paymentForm.entity_type,
      entity_id: paymentForm.entity_type === "manual" || !paymentForm.entity_id ? null : Number(paymentForm.entity_id),
      title: String(paymentForm.title || "").trim(),
      amount: paymentForm.amount,
      currency: paymentForm.currency ? Number(paymentForm.currency) : null,
      currency_rate: paymentForm.currency_rate || null,
      planned_date: paymentForm.planned_date || null,
      paid_date: paymentForm.paid_date || null,
      counterparty_type: paymentForm.counterparty_type ? Number(paymentForm.counterparty_type) : null,
      counterparty_id:
        paymentForm.counterparty_id && ["supplier", "contractor"].includes(counterpartyTypeCode)
          ? Number(paymentForm.counterparty_id)
          : null,
      counterparty_name:
        paymentForm.counterparty_type && !["supplier", "contractor"].includes(counterpartyTypeCode)
          ? String(paymentForm.counterparty_name || "").trim()
          : paymentForm.counterparty_name || null,
      counterparty_inn: normalizeInnInput(paymentForm.counterparty_inn),
      payment_method: paymentForm.payment_method ? Number(paymentForm.payment_method) : null,
      account_type: paymentForm.account_type || null,
      document_number: String(paymentForm.document_number || "").trim() || null,
      external_number: String(paymentForm.external_number || "").trim() || null,
      description: String(paymentForm.description || "").trim() || null,
      comment: String(paymentForm.comment || "").trim() || null,
      is_manual: paymentForm.entity_type === "manual"
    };

    if (!payload.block_id) return toast.error("Выберите блок");
    if (!payload.payment_type) return toast.error("Выберите тип платежа");
    if (!payload.currency) return toast.error("Выберите валюту");
    if (!payload.title) return toast.error("Введите название платежа");
    if (!payload.amount) return toast.error("Введите сумму");
    if (paymentForm.entity_type !== "manual" && !payload.entity_id) return toast.error("Выберите источник");
    if (["supplier", "contractor"].includes(counterpartyTypeCode) && !payload.counterparty_id) {
      return toast.error("Выберите контрагента");
    }

    try {
      setSaving(true);

      const res = editingPayment
        ? await putRequest(`/payments/update/${editingPayment.id}`, payload)
        : await postRequest("/payments/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить платеж");
        return;
      }

      toast.success(editingPayment ? "Платеж обновлен" : "Платеж создан");
      setModalOpen(false);
      resetForm();
      await loadPayments();
    } catch (error) {
      console.error("ProjectPayments submitPayment error", error);
      toast.error(error?.response?.data?.message || error?.message || "Серверная ошибка");
    } finally {
      setSaving(false);
    }
  };

  const updatePaymentStatus = async (payment, statusCode) => {
    const nextStatus = statusByCode[statusCode];
    if (!nextStatus) return;

    try {
      const res = await putRequest(`/payments/update/${payment.id}`, {
        status: nextStatus.id,
        ...getStatusButtonPayload(statusCode)
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось обновить статус");
        return;
      }

      toast.success("Статус обновлен");
      await loadPayments();
    } catch (error) {
      console.error("ProjectPayments updatePaymentStatus error", error);
      toast.error("Ошибка обновления статуса");
    }
  };

  const getFilenameFromDisposition = (disposition, fallback) => {
    if (!disposition) return fallback;

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return fallback;
      }
    }

    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
    return filenameMatch?.[1] || fallback;
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to convert blob"));
          return;
        }

        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const saveNativeReport = async (blob, filename) => {
    const base64Data = await blobToBase64(blob);
    return Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents
    });
  };

  const downloadPaymentCashOrderReport = async (payment) => {
    const token = getAuthToken();
    const format = "xlsx";

    try {
      setDownloadingReportId(payment.id);

      let res = null;
      let lastError = null;

      for (const url of reportsFallbackURLs()) {
        try {
          res = await fetch(`${url}/report/paymentCashOrder/${payment.id}?format=${format}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (res.ok) break;
          lastError = new Error(`HTTP ${res.status}`);
        } catch (error) {
          lastError = error;
        }
      }

      if (!res?.ok) {
        throw lastError || new Error("Report service is unavailable");
      }

      const blob = await res.blob();
      const reportName = payment.payment_type_ref?.code === "income" ? "ПКО" : "РКО";
      const filename = getFilenameFromDisposition(
        res.headers.get("Content-Disposition"),
        `${reportName} №${payment.id}.${format}`
      );

      if (Capacitor.isNativePlatform()) {
        await saveNativeReport(blob, filename);
        toast.success(`Файл сохранен: ${filename}`);
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
        toast.success("Отчет скачан");
      }
    } catch (error) {
      console.error("ProjectPayments downloadPaymentCashOrderReport error", error);
      toast.error("Ошибка скачивания отчета");
    } finally {
      setDownloadingReportId(null);
    }
  };

  const getPaymentFileUrl = (fileId) => `${baseURL()}/documentFiles/download/${fileId}`;

  const getFileIcon = (file, size = 40) => {
    const name = (file?.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const style = defaultStyles[ext] || defaultStyles.txt;

    return (
      <div style={{ width: size, height: size }}>
        <FileIcon extension={ext} {...style} />
      </div>
    );
  };

  const loadPaymentFiles = async (paymentId) => {
    if (!paymentId) return;

    try {
      setLoadingFiles(true);

      const docs = await postRequest("/documents/search", {
        entity_type: "payment",
        entity_id: Number(paymentId),
        page: 1,
        size: 1
      });

      if (!docs?.success) {
        toast.error(docs?.message || "Не удалось получить документы платежа");
        setPaymentDocumentId(null);
        setPaymentFiles([]);
        return;
      }

      const documentId = docs.data?.[0]?.id || null;
      setPaymentDocumentId(documentId);

      if (!documentId) {
        setPaymentFiles([]);
        return;
      }

      const files = await getRequest(`/documentFiles/files/${documentId}`);
      setPaymentFiles(files?.success ? files.data || [] : []);
    } catch (error) {
      console.error("ProjectPayments loadPaymentFiles error", error);
      toast.error(error?.response?.data?.message || "Ошибка загрузки файлов платежа");
      setPaymentFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const ensurePaymentDocument = async (payment) => {
    if (paymentDocumentId) return paymentDocumentId;

    const docs = await postRequest("/documents/search", {
      entity_type: "payment",
      entity_id: Number(payment.id),
      page: 1,
      size: 1
    });

    if (docs?.success && docs.data?.[0]?.id) {
      setPaymentDocumentId(docs.data[0].id);
      return docs.data[0].id;
    }

    const created = await postRequest("/documents/create", {
      entity_type: "payment",
      entity_id: Number(payment.id),
      name: `Файлы платежа №${payment.id}`,
      description: payment.title || ""
    });

    if (!created?.success) {
      throw new Error(created?.message || "Не удалось создать документ платежа");
    }

    setPaymentDocumentId(created.data.id);
    return created.data.id;
  };

  const openPaymentFiles = async (payment) => {
    setFilesModalPayment(payment);
    setPaymentDocumentId(null);
    setPaymentFiles([]);
    await loadPaymentFiles(payment.id);
  };

  const closePaymentFiles = () => {
    setFilesModalPayment(null);
    setPaymentDocumentId(null);
    setPaymentFiles([]);
  };

  const handleUploadPaymentFiles = async (event) => {
    const files = event.target.files;
    if (!files?.length || !filesModalPayment) return;

    try {
      setUploadingFiles(true);
      const documentId = await ensurePaymentDocument(filesModalPayment);
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await postRequest(`/documentFiles/upload/${documentId}`, formData);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить файлы");
        return;
      }

      toast.success("Файлы загружены");
      await loadPaymentFiles(filesModalPayment.id);
    } catch (error) {
      console.error("ProjectPayments uploadPaymentFiles error", error);
      toast.error(error?.response?.data?.message || error?.message || "Ошибка загрузки файлов");
    } finally {
      setUploadingFiles(false);
      event.target.value = "";
    }
  };

  const handleDeletePaymentFile = async (fileId) => {
    if (!filesModalPayment) return;

    const confirmed = window.confirm("Удалить файл?");
    if (!confirmed) return;

    try {
      const res = await deleteRequest(`/documentFiles/${fileId}`);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить файл");
        return;
      }

      toast.success("Файл удален");
      await loadPaymentFiles(filesModalPayment.id);
    } catch (error) {
      console.error("ProjectPayments deletePaymentFile error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления файла");
    }
  };

  const handleSwipeBackStart = (event) => {
    const touch = event.touches?.[0];
    const isModalOpen = modalOpen || filesModalPayment;

    if (!touch || isModalOpen || touch.clientX > 32) {
      swipeBackRef.current = { x: 0, y: 0, active: false };
      return;
    }

    swipeBackRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true
    };
  };

  const handleSwipeBackEnd = (event) => {
    const swipe = swipeBackRef.current;
    const touch = event.changedTouches?.[0];

    swipeBackRef.current = { x: 0, y: 0, active: false };

    if (!swipe.active || !touch) return;

    const deltaX = touch.clientX - swipe.x;
    const deltaY = touch.clientY - swipe.y;

    if (deltaX > 80 && Math.abs(deltaY) < 50) {
      navigate(-1);
    }
  };

  const activeTabClass = "bg-blue-600 text-white";

  return (
    <div className={pageClass} onTouchStart={handleSwipeBackStart} onTouchEnd={handleSwipeBackEnd}>
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-lg font-semibold ${titleClass}`}>Платежи: {project?.name || "..."}</h1>
          <div className={`text-sm ${secondaryTextClass}`}>{projectBlocks.find((item) => String(item.id) === String(blockFilter))?.label || "Все блоки"}</div>
        </div>
        <button onClick={() => navigate(-1)} className={subtleButtonClass}>
          Назад
        </button>
      </div>

      <PullToRefresh onRefresh={loadPayments} contentClassName="space-y-3">
        <div className={panelClass}>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.key}
                onClick={() => setQuickFilterAndResetPage(item.key)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${quickFilter === item.key ? activeTabClass : inactiveTabClass}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className={`absolute left-3 top-3 ${mutedTextClass}`} />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className={inputClass}
                placeholder="Поиск платежей..."
              />
            </div>
            <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
              Go
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={blockFilter}
                onChange={(e) => {
                  setBlockFilter(e.target.value);
                  setPage(1);
                }}
                className={modalInputClass}
              >
                <option value="">Все блоки</option>
                {projectBlocks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className={modalInputClass}
              >
                <option value="">Все статусы</option>
                {paymentStatuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={articleFilter}
                onChange={(e) => {
                  setArticleFilter(e.target.value);
                  setPage(1);
                }}
                className={modalInputClass}
              >
                <option value="">Все статьи</option>
                {filteredArticles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <button onClick={openCreateModal} className="flex shrink-0 items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500">
                <Plus size={16} />
                Платеж
              </button>
            </div>
          </div>
        </div>

        {payments.map((payment) => {
          const isDraftPayment = Number(payment.status) === 1;
          const statusColor = payment.status_ref?.color || "#64748b";
          const sourceLabel =
            payment.entity_type === "manual"
              ? "Ручной"
              : payment.entity_type === "purchaseOrder"
                ? "Закуп"
                : payment.entity_type === "workPerformed"
                  ? "АВР"
                  : payment.entity_type;

          return (
            <div key={payment.id} className={`${cardClass} overflow-hidden p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] ${secondaryTextClass}`}>Создан: {formatDateTime(payment.created_at)}</div>
                  <div className={`mt-1 truncate text-base font-semibold ${titleClass}`}>{payment.title}</div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => downloadPaymentCashOrderReport(payment)}
                    disabled={downloadingReportId === payment.id}
                    className={`${actionTileClass} h-8 w-8 p-0 disabled:opacity-60`}
                    title="Скачать ПКО/РКО"
                  >
                    <Download size={14} />
                  </button>

                  <button onClick={() => openPaymentFiles(payment)} className={`${actionTileClass} h-8 w-8 p-0`} title="Файлы">
                    <FileText size={14} />
                  </button>

                  {isDraftPayment ? (
                    <button onClick={() => openEditModal(payment)} className={`${actionTileClass} h-8 w-8 p-0`} title="Изменить">
                      <Pencil size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={`mt-2 flex flex-wrap gap-1.5 text-[11px] ${secondaryTextClass}`}>
                <span className="rounded-full border border-gray-700 px-2 py-0.5">{payment.payment_type_ref?.name || "-"}</span>
                <span
                  className="rounded-full border px-2 py-0.5 font-medium"
                  style={{ borderColor: statusColor, color: statusColor }}
                >
                  {payment.status_ref?.name || `Статус #${payment.status}`}
                </span>
                {payment.block?.name ? <span className="rounded-full border border-gray-700 px-2 py-0.5">{payment.block.name}</span> : null}
                <span className="rounded-full border border-gray-700 px-2 py-0.5">{sourceLabel}</span>
              </div>

              <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${themeSurface.panelMuted(isDark)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{payment.article?.name || "Не выбрана"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-semibold">
                      {formatMoney(payment.amount)} {getCurrencyLabel(payment.currency, payment.currency_ref)}
                    </div>
                  </div>
                </div>

                <div className={`mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-xs ${isDark ? "border-gray-700" : "border-slate-200"}`}>
                  <div>
                    <span className={secondaryTextClass}>План: </span>
                    <span className={titleClass}>{formatDate(payment.planned_date)}</span>
                  </div>
                  <div className="text-right">
                    <span className={secondaryTextClass}>Факт: </span>
                    <span className={titleClass}>{formatDate(payment.paid_date)}</span>
                  </div>
                  {!isSomCurrencyValue(payment.currency, currencies) && payment.currency_rate ? (
                    <div className={`col-span-2 ${secondaryTextClass}`}>Курс НБКР: {payment.currency_rate}</div>
                  ) : null}
                </div>
              </div>

              {(payment.counterparty_name || payment.counterparty_type || payment.counterparty_inn) && (
                <div className={`mt-2 text-xs ${secondaryTextClass}`}>
                  <span>Контрагент: </span>
                  <span className={titleClass}>{payment.counterparty_name || "—"}</span>
                  {payment.counterparty_inn ? <span> · ИНН: <span className={titleClass}>{payment.counterparty_inn}</span></span> : null}
                </div>
              )}

              {canControlStatus && isDraftPayment ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updatePaymentStatus(payment, "planned")}
                    className="rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Запланирован
                  </button>
                  <button
                    onClick={() => updatePaymentStatus(payment, "paid")}
                    className="rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                  >
                    Оплачен
                  </button>
                  <button
                    onClick={() => updatePaymentStatus(payment, "canceled")}
                    className="rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                  >
                    Отменен
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {!loading && !payments.length ? (
          <div className={`${cardClass} p-6 text-center`}>
            <Wallet className={`mx-auto mb-3 ${mutedTextClass}`} size={26} />
            <div className={titleClass}>Платежи не найдены</div>
            <div className={`mt-1 text-sm ${secondaryTextClass}`}>Попробуйте сменить фильтр или создать первый платеж.</div>
          </div>
        ) : null}

        {pagination ? (
          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={!pagination.hasPrev}
              className={subtleButtonClass}
            >
              Назад
            </button>
            <div className={`text-sm ${secondaryTextClass}`}>
              {pagination.page} / {pagination.pages || 1}
            </div>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!pagination.hasNext}
              className={subtleButtonClass}
            >
              Далее
            </button>
          </div>
        ) : null}
      </PullToRefresh>

      {filesModalPayment ? (
        <Modal
          title="Файлы платежа"
          subtitle={filesModalPayment.title}
          onClose={closePaymentFiles}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className={`text-sm ${secondaryTextClass}`}>
                {paymentFiles.length ? `Файлов: ${paymentFiles.length}` : "Файлы еще не добавлены"}
              </div>

              <label className={`flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 ${uploadingFiles ? "pointer-events-none opacity-60" : ""}`}>
                <Upload size={16} />
                {uploadingFiles ? "Загрузка..." : "Добавить"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUploadPaymentFiles}
                />
              </label>
            </div>

            {loadingFiles ? (
              <div className={`${themeSurface.panelMuted(isDark)} rounded-xl p-5 text-center text-sm ${secondaryTextClass}`}>
                Загрузка файлов...
              </div>
            ) : paymentFiles.length ? (
              <div className="grid grid-cols-2 gap-2">
                {paymentFiles.map((file) => {
                  const image = isImageFile(file);

                  return (
                    <div key={file.id} className={`${themeSurface.panelMuted(isDark)} flex min-h-[150px] flex-col rounded-xl p-2`}>
                      <div className={`flex h-[84px] items-center justify-center overflow-hidden rounded-lg ${isDark ? "bg-gray-950" : "bg-slate-100"}`}>
                        {image ? (
                          <img
                            src={getPaymentFileUrl(file.id)}
                            alt={file.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          getFileIcon(file, 46)
                        )}
                      </div>

                      <div className={`mt-2 line-clamp-2 text-xs ${titleClass}`}>
                        {file.name || `Файл #${file.id}`}
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <button
                          onClick={() => handleDeletePaymentFile(file.id)}
                          className="flex items-center justify-center rounded-lg bg-red-600/20 p-2 text-red-500"
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>

                        <button
                          onClick={() => window.open(getPaymentFileUrl(file.id), "_blank")}
                          className="flex items-center justify-center rounded-lg bg-blue-600/20 p-2 text-blue-400"
                          title="Открыть"
                        >
                          {image ? <ImageIcon size={16} /> : <Download size={16} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`rounded-xl border border-dashed p-6 text-center text-sm ${isDark ? "border-gray-700 bg-gray-950/40 text-gray-400" : "border-slate-300 bg-white text-slate-500"}`}>
                Прикрепите чек, счет, квитанцию или другой файл по платежу.
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {modalOpen ? (
        <Modal
          title={editingPayment ? "Изменить платеж" : "Новый платеж"}
          subtitle={project?.name ? `${project.name}${paymentForm.block_id ? ` • ${projectBlocks.find((item) => String(item.id) === String(paymentForm.block_id))?.label || ""}` : ""}` : ""}
          onClose={() => {
            setModalOpen(false);
            resetForm();
          }}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Блок">
                <select
                  value={paymentForm.block_id}
                  onChange={(e) => handleBlockChange(e.target.value)}
                  className={modalInputClass}
                >
                  <option value="">Выберите блок</option>
                  {projectBlocks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Тип платежа">
                <select
                  value={paymentForm.payment_type}
                  onChange={(e) => handleFormChange("payment_type", e.target.value)}
                  className={modalInputClass}
                >
                  <option value="">Выберите тип</option>
                  {paymentTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Статья">
                <select
                  value={paymentForm.article_id}
                  onChange={(e) => handleArticleChange(e.target.value)}
                  className={modalInputClass}
                >
                  <option value="">Не выбрана</option>
                  {formArticles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Источник">
                <select
                  value={paymentForm.entity_type}
                  onChange={(e) => handleEntityTypeChange(e.target.value)}
                  className={modalInputClass}
                >
                  {ENTITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {paymentForm.entity_type !== "manual" ? (
              <Field label="Выберите источник">
                <select
                  value={paymentForm.entity_id}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  disabled={!paymentForm.block_id || loadingSources}
                  className={modalInputClass}
                >
                  <option value="">
                    {!paymentForm.block_id
                      ? "Сначала выберите блок"
                      : loadingSources
                        ? "Загрузка..."
                        : "Выберите источник"}
                  </option>
                  {sourceOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getSourceOptionLabel(paymentForm.entity_type, item)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Название">
              <input
                value={paymentForm.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
                className={modalInputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Сумма">
                <input
                  value={paymentForm.amount}
                  onChange={(e) => handleFormChange("amount", e.target.value)}
                  className={modalInputClass}
                  inputMode="decimal"
                />
              </Field>

              <Field label="Валюта">
                <select
                  value={paymentForm.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className={modalInputClass}
                >
                  {currencies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code || item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {!isSomCurrencyValue(paymentForm.currency, currencies) ? (
              <Field label="Курс НБКР">
                <input
                  value={paymentForm.currency_rate || ""}
                  onChange={(e) => handleFormChange("currency_rate", e.target.value)}
                  className={modalInputClass}
                  inputMode="decimal"
                />
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Плановая дата">
                <div className="relative">
                  <input
                    type="date"
                    value={paymentForm.planned_date}
                    onChange={(e) => handleFormChange("planned_date", e.target.value)}
                    className={modalInputClass}
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </Field>

              <Field label="Фактическая дата">
                <div className="relative">
                  <input
                    type="date"
                    value={paymentForm.paid_date}
                    onChange={(e) => handleFormChange("paid_date", e.target.value)}
                    className={modalInputClass}
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Тип контрагента">
                <select
                  value={paymentForm.counterparty_type}
                  onChange={(e) => handleCounterpartyTypeChange(e.target.value)}
                  className={modalInputClass}
                >
                  <option value="">Не выбран</option>
                  {paymentCounterpartyTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Контрагент">
                {["supplier", "contractor"].includes(getCounterpartyTypeCode(paymentForm.counterparty_type)) ? (
                  <select
                    value={paymentForm.counterparty_id}
                    onChange={(e) => handleCounterpartySelect(e.target.value)}
                    className={modalInputClass}
                  >
                    <option value="">
                      {getCounterpartyTypeCode(paymentForm.counterparty_type) === "supplier" && paymentForm.entity_type === "purchaseOrder" && !paymentForm.entity_id
                        ? "Сначала выберите закуп"
                        : "Выберите контрагента"}
                    </option>
                    {currentCounterpartyOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={paymentForm.counterparty_name}
                    onChange={(e) => handleFormChange("counterparty_name", e.target.value)}
                    className={modalInputClass}
                  />
                )}
              </Field>
            </div>

            <Field label="ИНН контрагента">
              <input
                value={paymentForm.counterparty_inn}
                onChange={(e) => handleFormChange("counterparty_inn", normalizeInnInput(e.target.value))}
                className={modalInputClass}
                inputMode="numeric"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Способ оплаты">
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => handleFormChange("payment_method", e.target.value)}
                  className={modalInputClass}
                >
                  <option value="">Не выбран</option>
                  {paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Счет">
                <select
                  value={paymentForm.account_type}
                  onChange={(e) => handleFormChange("account_type", e.target.value)}
                  className={modalInputClass}
                >
                  {ACCOUNT_TYPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="№ документа">
                <input
                  value={paymentForm.document_number}
                  onChange={(e) => handleFormChange("document_number", e.target.value)}
                  className={modalInputClass}
                />
              </Field>

              <Field label="Внешний номер">
                <input
                  value={paymentForm.external_number}
                  onChange={(e) => handleFormChange("external_number", e.target.value)}
                  className={modalInputClass}
                />
              </Field>
            </div>

            <Field label="Описание">
              <textarea
                value={paymentForm.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                className={`${modalInputClass} min-h-[88px] resize-y`}
              />
            </Field>

            <Field label="Комментарий">
              <textarea
                value={paymentForm.comment}
                onChange={(e) => handleFormChange("comment", e.target.value)}
                className={`${modalInputClass} min-h-[88px] resize-y`}
              />
            </Field>

            <button
              onClick={submitPayment}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Сохранение..." : editingPayment ? "Сохранить изменения" : "Создать платеж"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
