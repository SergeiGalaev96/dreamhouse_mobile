import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ClipboardList, Download, Pencil, Plus, Search, X } from "lucide-react";
import Select from "react-select";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { AuthContext } from "../auth/AuthContext";
import { getAuthToken } from "../utils/authStorage";
import { formatDateReverse, formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { reportsFallbackURLs } from "../api/axios";
import { useTheme } from "../context/ThemeContext";
import PullToRefresh from "../components/PullToRefresh";
import { themeBorder, themeControl, themeSurface, themeText } from "../utils/themeStyles";

const ESTIMATE_EDITOR_ROLE_IDS = [1, 10, 11];

const getSelectStyles = (isDark) => ({
  control: (base, state) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff",
    borderColor: state.isFocused ? "#3b82f6" : isDark ? "#374151" : "#cbd5e1",
    boxShadow: "none",
    minHeight: 42,
    borderRadius: 8
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff",
    border: `1px solid ${isDark ? "#374151" : "#cbd5e1"}`,
    zIndex: 60
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
  dropdownIndicator: (base) => ({ ...base, color: isDark ? "#9ca3af" : "#64748b" }),
  indicatorSeparator: () => ({ display: "none" })
});

const EMPTY_ITEM_FORM = {
  id: null,
  item_type: 1,
  entry_type: 1,
  stage_id: "",
  subsection_id: "",
  material_type: "",
  service_type: "",
  material_id: "",
  service_id: "",
  unit_of_measure: "",
  quantity_planned: "",
  coefficient: "1",
  currency: "1",
  currency_rate: "1",
  price: "",
  comment: ""
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
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

const saveNativeReport = async (blob, filename) => {
  const base64Data = await blobToBase64(blob);
  return Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Documents
  });
};

export default function Estimates() {
  const { blockId } = useParams();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputItemSearch, setInputItemSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [dictionaries, setDictionaries] = useState({});
  const [hideTitle, setHideTitle] = useState(false);
  const [creatingEstimate, setCreatingEstimate] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [inputItemOptionSearch, setInputItemOptionSearch] = useState("");
  const [itemOptionSearch, setItemOptionSearch] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [rates, setRates] = useState([]);
  const [downloadingEstimateReport, setDownloadingEstimateReport] = useState(false);

  const loadEstimate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postRequest("/materialEstimates/search", {
        block_id: Number(blockId),
        page: 1,
        size: 1
      });

      if (res?.success) {
        setEstimate(res.data?.[0] || null);
      }
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  useEffect(() => {
    loadEstimate();
  }, [loadEstimate]);

  useEffect(() => {
    const loadDicts = async () => {
      setDictionaries(
        await loadDictionaries([
          "materials",
          "materialTypes",
          "unitsOfMeasure",
          "currencies",
          "projectBlocks",
          "blockStages",
          "stageSubsections",
          "services",
          "serviceTypes",
          "generalStatuses"
        ])
      );
    };

    loadDicts();
  }, []);

  useEffect(() => {
    const loadRates = async () => {
      try {
        const res = await getRequest(`/currencyRates/getByDate/${formatDateReverse(new Date())}`);
        if (res?.success) {
          setRates(res.data || []);
        }
      } catch (error) {
        console.error("Currency rates load error", error);
      }
    };

    loadRates();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setHideTitle(scrollTop > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getDictName = useCallback(
    (dictName, id, field = "label") => dictionaries[dictName]?.find((item) => Number(item.id) === Number(id))?.[field] || "",
    [dictionaries]
  );

  const getOptions = useCallback(
    (dictName, fields = []) => {
      const items = dictionaries[dictName];
      if (!items) return [];

      return items.map((item) => {
        const extra = {};
        fields.forEach((field) => {
          extra[field] = item[field];
        });

        return {
          value: item.id,
          label: item.label,
          ...extra
        };
      });
    },
    [dictionaries]
  );

  const getMaterialById = useCallback(
    (id) => dictionaries.materials?.find((item) => Number(item.id) === Number(id)),
    [dictionaries.materials]
  );

  const getServiceById = useCallback(
    (id) => dictionaries.services?.find((item) => Number(item.id) === Number(id)),
    [dictionaries.services]
  );

  const getRateByCurrency = useCallback(
    (currencyId) => {
      const rate = rates.find((item) => Number(item.currency_id) === Number(currencyId));
      return rate?.rate || "";
    },
    [rates]
  );

  const getItemName = useCallback(
    (item) => {
      if (Number(item.item_type) === 1) {
        return getDictName("materials", item.material_id);
      }

      return getDictName("services", item.service_id) || item.name || "";
    },
    [getDictName]
  );

  const calcItemSum = useCallback(
    (item) => (toNumber(item.quantity_planned) || 0) * (toNumber(item.price) || 0) * (toNumber(item.coefficient, 1) || 1),
    []
  );

  const handleSearch = () => {
    setItemSearch(inputItemSearch);
  };

  const handleItemOptionSearch = () => {
    setItemOptionSearch(inputItemOptionSearch.trim().toLowerCase());
  };

  const estimateStatusLabel = useMemo(
    () => getDictName("generalStatuses", estimate?.status),
    [estimate?.status, getDictName]
  );
  const blockLabel = useMemo(() => getDictName("projectBlocks", blockId), [blockId, getDictName]);

  const isSignedEstimate = Number(estimate?.status) === 2;
  const canManageEstimate = ESTIMATE_EDITOR_ROLE_IDS.includes(Number(user?.role_id));
  const canEditEstimate = canManageEstimate && Boolean(estimate) && !isSignedEstimate;

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    const items = estimate?.items || [];

    if (!query) {
      return items;
    }

    return items.filter((item) => {
      const itemName = getItemName(item).toLowerCase();
      const stageName = getDictName("blockStages", item.stage_id).toLowerCase();
      const subsectionName = getDictName("stageSubsections", item.subsection_id).toLowerCase();

      return itemName.includes(query) || stageName.includes(query) || subsectionName.includes(query);
    });
  }, [estimate?.items, getDictName, getItemName, itemSearch]);

  const groupedSections = useMemo(() => {
    const groups = new Map();

    for (const item of filteredItems) {
      const stageId = Number(item.stage_id) || 0;
      const subsectionId = Number(item.subsection_id) || 0;
      const key = `${stageId}_${subsectionId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          stageId,
          subsectionId,
          stageName: getDictName("blockStages", stageId) || "Без этапа",
          subsectionName: subsectionId ? getDictName("stageSubsections", subsectionId) || "Без подэтапа" : "Без подэтапа",
          services: [],
          materials: []
        });
      }

      const group = groups.get(key);
      if (Number(item.item_type) === 1) {
        group.materials.push(item);
      } else {
        group.services.push(item);
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.stageName !== b.stageName) {
        return a.stageName.localeCompare(b.stageName, "ru");
      }
      return a.subsectionName.localeCompare(b.subsectionName, "ru");
    });
  }, [filteredItems, getDictName]);

  const totalSum = useMemo(
    () => filteredItems.reduce((acc, item) => acc + calcItemSum(item), 0),
    [calcItemSum, filteredItems]
  );

  const modalSubsections = useMemo(
    () => (dictionaries.stageSubsections || []).filter((item) => Number(item.stage_id) === Number(itemForm.stage_id)),
    [dictionaries.stageSubsections, itemForm.stage_id]
  );

  const stageOptions = useMemo(
    () =>
      getOptions("blockStages", ["block_id"])
        .filter((item) => Number(item.block_id) === Number(blockId)),
    [blockId, getOptions]
  );

  const subsectionOptions = useMemo(
    () =>
      modalSubsections.map((item) => ({
        value: item.id,
        label: item.label,
        stage_id: item.stage_id
      })),
    [modalSubsections]
  );

  const materialTypeOptions = useMemo(() => getOptions("materialTypes"), [getOptions]);
  const serviceTypeOptions = useMemo(() => getOptions("serviceTypes"), [getOptions]);
  const currencyOptions = useMemo(
    () =>
      (dictionaries.currencies || []).map((currency) => ({
        value: String(currency.id),
        label: currency.code || currency.label
      })),
    [dictionaries.currencies]
  );

  const materialOptions = useMemo(
    () =>
      getOptions("materials", ["type"]).map((item) => ({
        ...item,
        value: String(item.value)
      })),
    [getOptions]
  );

  const serviceOptions = useMemo(
    () =>
      getOptions("services", ["service_type"]).map((item) => ({
        ...item,
        value: String(item.value)
      })),
    [getOptions]
  );

  const filteredMaterialOptions = useMemo(() => {
    const byType = itemForm.material_type
      ? materialOptions.filter((item) => String(item.type) === String(itemForm.material_type))
      : materialOptions;

    if (!itemOptionSearch) {
      return byType;
    }

    return byType.filter((item) => item.label.toLowerCase().includes(itemOptionSearch));
  }, [itemForm.material_type, itemOptionSearch, materialOptions]);

  const filteredServiceOptions = useMemo(() => {
    const byType = itemForm.service_type
      ? serviceOptions.filter((item) => String(item.service_type) === String(itemForm.service_type))
      : serviceOptions;

    if (!itemOptionSearch) {
      return byType;
    }

    return byType.filter((item) => item.label.toLowerCase().includes(itemOptionSearch));
  }, [itemForm.service_type, itemOptionSearch, serviceOptions]);

  const pickerOptions = useMemo(
    () => (Number(itemForm.item_type) === 1 ? filteredMaterialOptions : filteredServiceOptions),
    [filteredMaterialOptions, filteredServiceOptions, itemForm.item_type]
  );

  const visiblePickerOptions = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return pickerOptions;
    return pickerOptions.filter((item) => item.label.toLowerCase().includes(query));
  }, [pickerOptions, pickerSearch]);

  const openCreateModal = () => {
    if (!canEditEstimate) return;
    setItemForm(EMPTY_ITEM_FORM);
    setInputItemOptionSearch("");
    setItemOptionSearch("");
    setPickerSearch("");
    setShowItemPicker(false);
    setItemModalOpen(true);
  };

  const openEditModal = (item) => {
    if (!canEditEstimate) return;
    setItemForm({
      id: item.id,
      item_type: Number(item.item_type),
      entry_type: Number(item.entry_type || 1),
      stage_id: String(item.stage_id || ""),
      subsection_id: String(item.subsection_id || ""),
      material_type: String(item.material_type || getMaterialById(item.material_id)?.type || ""),
      service_type: String(item.service_type || getServiceById(item.service_id)?.service_type || ""),
      material_id: String(item.material_id || ""),
      service_id: String(item.service_id || ""),
      unit_of_measure: String(item.unit_of_measure || ""),
      quantity_planned: String(item.quantity_planned ?? ""),
      coefficient: String(item.coefficient ?? "1"),
      currency: String(item.currency ?? "1"),
      currency_rate: String(item.currency_rate ?? "1"),
      price: item.price == null ? "" : String(item.price),
      comment: item.comment || ""
    });
    setInputItemOptionSearch("");
    setItemOptionSearch("");
    setPickerSearch("");
    setShowItemPicker(false);
    setItemModalOpen(true);
  };

  const closeModal = () => {
    if (savingItem) return;
    setItemModalOpen(false);
    setItemForm(EMPTY_ITEM_FORM);
    setInputItemOptionSearch("");
    setItemOptionSearch("");
    setPickerSearch("");
    setShowItemPicker(false);
  };

  const handleItemFormChange = (field, value) => {
    setItemForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "item_type") {
        next.material_type = "";
        next.service_type = "";
        next.material_id = "";
        next.service_id = "";
        next.unit_of_measure = "";
        setInputItemOptionSearch("");
        setItemOptionSearch("");
        setPickerSearch("");
      }

      if (field === "stage_id") {
        next.subsection_id = "";
      }

      if (field === "material_type") {
        next.material_type = value;
        next.material_id = "";
        next.unit_of_measure = "";
        setInputItemOptionSearch("");
        setItemOptionSearch("");
        setPickerSearch("");
      }

      if (field === "service_type") {
        next.service_type = value;
        next.service_id = "";
        next.unit_of_measure = "";
        setInputItemOptionSearch("");
        setItemOptionSearch("");
        setPickerSearch("");
      }

      if (field === "material_id") {
        const material = getMaterialById(value);
        next.material_id = value;
        next.material_type = material?.type ? String(material.type) : next.material_type;
        if (material?.unit_of_measure) {
          next.unit_of_measure = String(material.unit_of_measure);
        }
      }

      if (field === "service_id") {
        const service = getServiceById(value);
        next.service_id = value;
        next.service_type = service?.service_type ? String(service.service_type) : next.service_type;
        if (service?.unit_of_measure) {
          next.unit_of_measure = String(service.unit_of_measure);
        }
      }

      if (field === "currency") {
        const currencyId = Number(value || 1);
        next.currency = value;
        next.currency_rate = String(currencyId === 1 ? 1 : (getRateByCurrency(currencyId) || ""));
      }

      return next;
    });
  };

  const createEstimate = async () => {
    if (!canManageEstimate) return;

    try {
      setCreatingEstimate(true);
      const res = await postRequest("/materialEstimates/create", {
        block_id: Number(blockId),
        status: 1,
        name: `Смета блока ${blockId}`,
        items: []
      });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось создать смету");
        return;
      }

      toast.success("Смета создана");
      await loadEstimate();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка создания сметы");
    } finally {
      setCreatingEstimate(false);
    }
  };

  const saveItemForm = async () => {
    if (!estimate || !canEditEstimate) return;

    if (!itemForm.stage_id || !itemForm.subsection_id) {
      toast.error("Выберите этап и подэтап");
      return;
    }

    if (Number(itemForm.item_type) === 1 && !itemForm.material_id) {
      toast.error("Выберите материал");
      return;
    }

    if (Number(itemForm.item_type) === 2 && !itemForm.service_id) {
      toast.error("Выберите услугу");
      return;
    }

    const material = Number(itemForm.item_type) === 1 ? getMaterialById(itemForm.material_id) : null;
    const service = Number(itemForm.item_type) === 2 ? getServiceById(itemForm.service_id) : null;
    const unitOfMeasure = itemForm.unit_of_measure || material?.unit_of_measure || service?.unit_of_measure;

    if (!unitOfMeasure) {
      toast.error("Не удалось определить единицу измерения");
      return;
    }

    try {
      setSavingItem(true);

      if (itemForm.id) {
        const res = await putRequest(`/materialEstimateItems/update/${itemForm.id}`, {
          stage_id: Number(itemForm.stage_id),
          subsection_id: Number(itemForm.subsection_id),
          entry_type: 1,
          material_type: Number(itemForm.item_type) === 1 && itemForm.material_type ? Number(itemForm.material_type) : null,
          service_type: Number(itemForm.item_type) === 2 && itemForm.service_type ? Number(itemForm.service_type) : null,
          quantity_planned: toNumber(itemForm.quantity_planned),
          coefficient: toNumber(itemForm.coefficient, 1),
          currency: itemForm.currency ? Number(itemForm.currency) : null,
          currency_rate: toNumber(itemForm.currency_rate, 1),
          price: itemForm.price === "" ? null : toNumber(itemForm.price),
          comment: itemForm.comment || ""
        });

        if (!res?.success) {
          toast.error(res?.message || "Не удалось обновить позицию");
          return;
        }
      } else {
        const payload = [
          {
            material_estimate_id: estimate.id,
            stage_id: Number(itemForm.stage_id),
            subsection_id: Number(itemForm.subsection_id),
            item_type: Number(itemForm.item_type),
            entry_type: 1,
            service_type: Number(itemForm.item_type) === 2 && itemForm.service_type ? Number(itemForm.service_type) : null,
            service_id: Number(itemForm.item_type) === 2 ? Number(itemForm.service_id) : null,
            material_type: Number(itemForm.item_type) === 1 && itemForm.material_type ? Number(itemForm.material_type) : null,
            material_id: Number(itemForm.item_type) === 1 ? Number(itemForm.material_id) : null,
            unit_of_measure: Number(unitOfMeasure),
            quantity_planned: toNumber(itemForm.quantity_planned),
            coefficient: toNumber(itemForm.coefficient, 1),
            currency: itemForm.currency ? Number(itemForm.currency) : null,
            currency_rate: toNumber(itemForm.currency_rate, 1),
            price: itemForm.price === "" ? null : toNumber(itemForm.price),
            comment: itemForm.comment || ""
          }
        ];

        const res = await postRequest("/materialEstimateItems/create", payload);

        if (!res?.success) {
          toast.error(res?.message || "Не удалось добавить позицию");
          return;
        }
      }

      toast.success(itemForm.id ? "Позиция обновлена" : "Позиция добавлена");
      closeModal();
      await loadEstimate();
    } catch (error) {
      console.error(error);
      toast.error(itemForm.id ? "Ошибка обновления позиции" : "Ошибка добавления позиции");
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (itemId) => {
    if (!canEditEstimate) return;

    try {
      setDeletingItemId(itemId);
      const res = await deleteRequest(`/materialEstimateItems/delete/${itemId}`);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить позицию");
        return;
      }

      toast.success("Позиция удалена");
      if (itemForm.id === itemId) {
        closeModal();
      }
      await loadEstimate();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка удаления позиции");
    } finally {
      setDeletingItemId(null);
    }
  };

  const downloadEstimateReport = async () => {
    if (!estimate) return;

    const token = getAuthToken();
    try {
      setDownloadingEstimateReport(true);
      let res = null;
      let lastError = null;

      for (const url of reportsFallbackURLs()) {
        try {
          const reportUrl = `${url}/report/estimate-stage?blockId=${Number(blockId)}&format=xlsx`;
          res = await fetch(reportUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (res.ok) break;

          let errorText = "";
          try {
            errorText = await res.text();
          } catch {
            errorText = "";
          }
          lastError = new Error(errorText || `HTTP ${res.status}`);
        } catch (error) {
          lastError = error;
        }
      }

      if (!res?.ok) {
        throw lastError || new Error("Report service is unavailable");
      }

      const blob = await res.blob();
      const filename = getFilenameFromDisposition(
        res.headers.get("Content-Disposition"),
        `Смета блок ${blockId}.xlsx`
      );

      if (Capacitor.isNativePlatform()) {
        await saveNativeReport(blob, filename);
        toast.success(`Файл сохранен: ${filename}`);
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        toast.success("Смета скачана");
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Ошибка скачивания сметы");
    } finally {
      setDownloadingEstimateReport(false);
    }
  };

  const pageClass = `space-y-4 pb-20 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-3`;
  const itemCardClass = `${themeSurface.panelMuted(isDark)} rounded px-2 py-1.5 text-xs`;
  const stickyClass = themeSurface.sticky(isDark);
  const modalBackdropClass = "fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4";
  const modalCardClass = `${themeSurface.panel(isDark)} w-full max-w-2xl rounded-t-2xl p-4 md:rounded-2xl`;
  const modalLabelClass = `mb-1 block text-[11px] font-medium ${themeText.secondary(isDark)}`;
  const modalSelectClass = isDark
    ? "w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
    : "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-black";

  const renderItemCard = (item) => {
    const sum = calcItemSum(item);
    const currencyCode = getDictName("currencies", item.currency, "code");
    const unitName = getDictName("unitsOfMeasure", item.unit_of_measure);
    const coefficient = Number(item.coefficient);
    const currencyRate = Number(item.currency_rate);

    return (
      <div key={item.id} className={itemCardClass}>
        <div className="flex justify-between gap-3">
          <span className="truncate text-sm font-semibold">{getItemName(item)}</span>
          <div className="flex items-center gap-2">
            <span className={`whitespace-nowrap font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
              {item.quantity_planned} {unitName}
            </span>
            {canEditEstimate && (
              <button
                onClick={() => openEditModal(item)}
                className="rounded p-1 text-blue-500 hover:bg-blue-500/10"
                aria-label="Редактировать позицию"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-[2px] flex items-center justify-between gap-3">
          <span className={`text-[10px] ${themeText.secondary(isDark)}`}>
            {item.price} {currencyCode}
            {coefficient > 1 && <> x {coefficient}</>}
            {currencyRate > 0 && item.currency !== 1 && <> | курс: {currencyRate}</>}
            {Number(item.entry_type) === 2 && <> | доп.</>}
          </span>

          <span className="whitespace-nowrap text-[12px] font-semibold text-green-500">
            {sum.toLocaleString()} {currencyCode}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={pageClass}>
      <div
        className={`select-none transition-all duration-200 ${hideTitle ? "mb-0 max-h-0 overflow-hidden opacity-0" : "mb-4 max-h-12 opacity-100"
          }`}
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-green-500" />
          <h1 className="text-lg font-semibold">{`Смета: ${blockLabel || `Блок ${blockId}`}`}</h1>
        </div>
      </div>

      <div className={stickyClass} style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
            <input
              value={inputItemSearch}
              onChange={(e) => setInputItemSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Поиск по смете..."
              className={inputClass}
            />
          </div>

          <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 text-sm text-white">
            Go
          </button>
        </div>
      </div>

      <PullToRefresh className="mt-3" contentClassName="space-y-2.5" onRefresh={loadEstimate} disabled={loading}>
        {loading && (
          <div className={panelClass}>
            <div className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Загрузка сметы...</div>
          </div>
        )}

        {!loading && !estimate && (
          <div className={panelClass}>
            <div className="space-y-3">
              {!canManageEstimate && (
                <div className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Смета для блока не найдена.</div>
              )}
              {canManageEstimate && (
                <>
                  <div className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Смета для блока не найдена.</div>
                  <button
                    onClick={createEstimate}
                    disabled={creatingEstimate}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    <Plus size={16} />
                    {creatingEstimate ? "Создание..." : "Создать смету"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!loading && estimate && (
          <div className={panelClass}>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className={`text-[11px] ${themeText.secondary(isDark)}`}>{formatDateTime(estimate.created_at)}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadEstimateReport}
                    disabled={downloadingEstimateReport}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-2 text-xs text-white hover:bg-emerald-600 disabled:opacity-60"
                    aria-label="Скачать смету"
                    >
                      <Download size={14} />
                      {downloadingEstimateReport ? "..." : "Excel"}
                    </button>
                  {canEditEstimate && (
                    <button
                      onClick={openCreateModal}
                      className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-500"
                      aria-label="Добавить позицию"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className={themeText.secondary(isDark)}>Позиций: {filteredItems.length}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${Number(estimate.status) === 2
                    ? "bg-emerald-100 text-emerald-700"
                    : isDark
                      ? "bg-gray-800 text-gray-200"
                      : "bg-slate-100 text-slate-700"
                    }`}>
                    {estimateStatusLabel || `Статус #${estimate.status}`}
                  </span>
                </div>

                <span className="font-medium text-green-500">{totalSum.toLocaleString()}</span>
              </div>
            </div>

              <div className={`mt-3 space-y-2 border-t pt-2 ${themeBorder.divider(isDark)}`}>
              {groupedSections.map((group) => (
                <div
                  key={group.key}
                  className={`rounded-xl border px-2 py-1.5 ${themeBorder.soft(isDark)} ${themeSurface.panel(isDark)}`}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-[12px]">
                    <span className="font-semibold">{group.stageName}</span>
                    <span className={themeText.secondary(isDark)}>/</span>
                    <span className={themeText.secondary(isDark)}>{group.subsectionName}</span>
                  </div>

                  {group.services.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Услуги</div>
                      <div className="space-y-1">
                        {group.services.map(renderItemCard)}
                      </div>
                    </div>
                  )}

                  {group.materials.length > 0 && (
                    <div className={group.services.length > 0 ? "mt-2 space-y-1" : "space-y-1"}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Материалы</div>
                      <div className="space-y-1">
                        {group.materials.map(renderItemCard)}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {groupedSections.length === 0 && (
                <div className={itemCardClass}>
                  <div className={`text-sm ${themeText.secondary(isDark)}`}>По вашему запросу позиции не найдены.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </PullToRefresh>

      {itemModalOpen && canEditEstimate && (
        <div className={modalBackdropClass} onClick={closeModal}>
          <div className={modalCardClass} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold">{itemForm.id ? "Редактировать позицию" : "Добавить позицию"}</div>
              <button onClick={closeModal} className="rounded p-1 hover:bg-black/5">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 hidden">
                <span className={modalLabelClass}>Тип позиции</span>
                <select
                  className={modalSelectClass}
                  value={itemForm.item_type}
                  onChange={(e) => handleItemFormChange("item_type", e.target.value)}
                  disabled={Boolean(itemForm.id)}
                >
                  <option value={1}>Материал</option>
                  <option value={2}>Услуга</option>
                </select>
              </label>

              <label className="col-span-2">
                <span className={modalLabelClass}>Тип записи</span>
                <Select
                  styles={getSelectStyles(isDark)}
                  options={[
                    { value: "1", label: "Материал" },
                    { value: "2", label: "Услуга" }
                  ]}
                  value={[
                    { value: "1", label: "Материал" },
                    { value: "2", label: "Услуга" }
                  ].find((option) => Number(option.value) === Number(itemForm.item_type))}
                  onChange={(option) => handleItemFormChange("item_type", option?.value || "1")}
                  isSearchable={false}
                  isDisabled={Boolean(itemForm.id)}
                />
              </label>

              <label className="hidden">
                <span className={modalLabelClass}>Этап</span>
                <select
                  className={modalSelectClass}
                  value={itemForm.stage_id}
                  onChange={(e) => handleItemFormChange("stage_id", e.target.value)}
                >
                  <option value="">Выберите этап</option>
                  {(dictionaries.blockStages || []).filter((item) => Number(item.block_id) === Number(blockId)).map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className={modalLabelClass}>Этап</span>
                <Select
                  styles={getSelectStyles(isDark)}
                  options={stageOptions}
                  value={stageOptions.find((option) => String(option.value) === String(itemForm.stage_id)) || null}
                  onChange={(option) => handleItemFormChange("stage_id", option ? String(option.value) : "")}
                  placeholder="Выберите..."
                />
              </label>

              <label className="hidden">
                <span className={modalLabelClass}>Подэтап</span>
                <select
                  className={modalSelectClass}
                  value={itemForm.subsection_id}
                  onChange={(e) => handleItemFormChange("subsection_id", e.target.value)}
                >
                  <option value="">Выберите подэтап</option>
                  {modalSubsections.map((subsection) => (
                    <option key={subsection.id} value={subsection.id}>{subsection.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={modalLabelClass}>Подэтап</span>
                <Select
                  styles={getSelectStyles(isDark)}
                  options={subsectionOptions}
                  value={subsectionOptions.find((option) => String(option.value) === String(itemForm.subsection_id)) || null}
                  onChange={(option) => handleItemFormChange("subsection_id", option ? String(option.value) : "")}
                  placeholder="Выберите..."
                />
              </label>

              {Number(itemForm.item_type) === 1 ? (
                <label className="col-span-2">
                  <span className={modalLabelClass}>Тип материала</span>
                  <Select
                    styles={getSelectStyles(isDark)}
                    options={materialTypeOptions}
                    value={materialTypeOptions.find((option) => String(option.value) === String(itemForm.material_type)) || null}
                    onChange={(option) => handleItemFormChange("material_type", option ? String(option.value) : "")}
                    placeholder="Тип материала..."
                  />
                </label>
              ) : (
                <label className="col-span-2">
                  <span className={modalLabelClass}>Тип услуги</span>
                  <Select
                    styles={getSelectStyles(isDark)}
                    options={serviceTypeOptions}
                    value={serviceTypeOptions.find((option) => String(option.value) === String(itemForm.service_type)) || null}
                    onChange={(option) => handleItemFormChange("service_type", option ? String(option.value) : "")}
                    placeholder="Тип услуги..."
                  />
                </label>
              )}

              <label className="col-span-2 hidden">
                <span className={modalLabelClass}>{Number(itemForm.item_type) === 1 ? "Материал" : "Услуга"}</span>
                {Number(itemForm.item_type) === 1 ? (
                  <select
                    className={modalSelectClass}
                    value={itemForm.material_id}
                    onChange={(e) => handleItemFormChange("material_id", e.target.value)}
                    disabled={Boolean(itemForm.id)}
                  >
                    <option value="">Выберите материал</option>
                    {(dictionaries.materials || []).map((material) => (
                      <option key={material.id} value={material.id}>{material.label}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    className={modalSelectClass}
                    value={itemForm.service_id}
                    onChange={(e) => handleItemFormChange("service_id", e.target.value)}
                    disabled={Boolean(itemForm.id)}
                  >
                    <option value="">Выберите услугу</option>
                    {(dictionaries.services || []).map((service) => (
                      <option key={service.id} value={service.id}>{service.label}</option>
                    ))}
                  </select>
                )}
              </label>

              <label className="col-span-2">
                <span className={modalLabelClass}>{Number(itemForm.item_type) === 1 ? "Материал" : "Услуга"}</span>
                <div
                  onClick={() => !itemForm.id && setShowItemPicker(true)}
                  className={`${themeSurface.panelMuted(isDark)} cursor-pointer rounded border ${isDark ? "border-gray-700" : "border-slate-300"} px-3 py-2 text-sm ${itemForm.id ? "cursor-not-allowed opacity-60" : ""
                    }`}
                >
                  {Number(itemForm.item_type) === 1 ? (
                    itemForm.material_id ? (
                      <span className={themeText.primary(isDark)}>
                        {filteredMaterialOptions.find((item) => String(item.value) === String(itemForm.material_id))?.label ||
                          materialOptions.find((item) => String(item.value) === String(itemForm.material_id))?.label}
                      </span>
                    ) : (
                      <span className={themeText.secondary(isDark)}>Материал...</span>
                    )
                  ) : itemForm.service_id ? (
                    <span className={themeText.primary(isDark)}>
                      {filteredServiceOptions.find((item) => String(item.value) === String(itemForm.service_id))?.label ||
                        serviceOptions.find((item) => String(item.value) === String(itemForm.service_id))?.label}
                    </span>
                  ) : (
                    <span className={themeText.secondary(isDark)}>Услуга...</span>
                  )}
                </div>
              </label>

              <label className="col-span-2 hidden">
                <span className={modalLabelClass}>{Number(itemForm.item_type) === 1 ? "Материал" : "Услуга"}</span>
                {Number(itemForm.item_type) === 1 ? (
                  <Select
                    styles={getSelectStyles(isDark)}
                    options={filteredMaterialOptions}
                    value={filteredMaterialOptions.find((option) => String(option.value) === String(itemForm.material_id)) || null}
                    onChange={(option) => handleItemFormChange("material_id", option ? String(option.value) : "")}
                    placeholder="Выберите материал"
                    isSearchable
                    noOptionsMessage={() => "Ничего не найдено"}
                    isDisabled={Boolean(itemForm.id)}
                  />
                ) : (
                  <Select
                    styles={getSelectStyles(isDark)}
                    options={filteredServiceOptions}
                    value={filteredServiceOptions.find((option) => String(option.value) === String(itemForm.service_id)) || null}
                    onChange={(option) => handleItemFormChange("service_id", option ? String(option.value) : "")}
                    placeholder="Выберите услугу"
                    isSearchable
                    noOptionsMessage={() => "Ничего не найдено"}
                    isDisabled={Boolean(itemForm.id)}
                  />
                )}
              </label>

              <div className="col-span-2 grid grid-cols-2 gap-2">
                <label>
                  <span className={modalLabelClass}>Количество</span>
                  <input
                    className={modalInputClass}
                    value={itemForm.quantity_planned}
                    onChange={(e) => handleItemFormChange("quantity_planned", e.target.value)}
                    placeholder="0"
                  />
                </label>

                <label>
                  <span className={modalLabelClass}>Ед. изм.</span>
                  <Select
                    styles={getSelectStyles(isDark)}
                    options={getOptions("unitsOfMeasure")}
                    value={getOptions("unitsOfMeasure").find((option) => String(option.value) === String(itemForm.unit_of_measure)) || null}
                    onChange={(option) => handleItemFormChange("unit_of_measure", option ? String(option.value) : "")}
                    placeholder="Ед. изм..."
                    isSearchable={false}
                  />
                </label>
              </div>

              <label>
                <span className={modalLabelClass}>Валюта</span>
                <Select
                  styles={getSelectStyles(isDark)}
                  options={currencyOptions}
                  value={currencyOptions.find((option) => String(option.value) === String(itemForm.currency)) || null}
                  onChange={(option) => handleItemFormChange("currency", option ? String(option.value) : "")}
                  isSearchable={false}
                />
              </label>

              <label>
                <span className={modalLabelClass}>Курс</span>
                <input
                  className={modalSelectClass}
                  value={Number(itemForm.currency) === 1 ? "1" : itemForm.currency_rate}
                  onChange={(e) => handleItemFormChange("currency_rate", e.target.value)}
                  placeholder="Курс"
                  disabled={Number(itemForm.currency) === 1}
                />
              </label>

              <label>
                <span className={modalLabelClass}>Цена</span>
                <input
                  className={modalInputClass}
                  value={itemForm.price}
                  onChange={(e) => handleItemFormChange("price", e.target.value)}
                  placeholder="0"
                />
              </label>

              <label>
                <span className={modalLabelClass}>Коэффициент</span>
                <input
                  className={modalInputClass}
                  value={itemForm.coefficient}
                  onChange={(e) => handleItemFormChange("coefficient", e.target.value)}
                  placeholder="1"
                />
              </label>

              <label className="col-span-2">
                <span className={modalLabelClass}>Комментарий</span>
                <input
                  className={modalInputClass}
                  value={itemForm.comment}
                  onChange={(e) => handleItemFormChange("comment", e.target.value)}
                  placeholder="Комментарий"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <div>
                {itemForm.id && (
                  <button
                    onClick={() => deleteItem(itemForm.id)}
                    disabled={deletingItemId === itemForm.id}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    {deletingItemId === itemForm.id ? "Удаление..." : "Удалить"}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                  Отмена
                </button>
                <button
                  onClick={saveItemForm}
                  disabled={savingItem}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {savingItem ? "Сохранение..." : itemForm.id ? "Сохранить" : "Добавить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showItemPicker && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={() => setShowItemPicker(false)}>
          <div className="absolute inset-0 bg-black/60" />

          <div
            onClick={(e) => e.stopPropagation()}
            className={`${themeSurface.page(isDark)} relative flex h-[75vh] w-full flex-col rounded-t-2xl`}
          >
            <div className={`mx-auto my-2 h-1 w-10 rounded-full ${isDark ? "bg-gray-600" : "bg-slate-300"}`} />

            <div className="px-4 pb-2">
              <input
                placeholder="Поиск..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className={modalInputClass}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2">
              {visiblePickerOptions.map((item) => (
                <div
                  key={item.value}
                  onClick={() => {
                    if (Number(itemForm.item_type) === 1) {
                      handleItemFormChange("material_id", String(item.value));
                    } else {
                      handleItemFormChange("service_id", String(item.value));
                    }

                    setShowItemPicker(false);
                    setPickerSearch("");
                  }}
                  className={`cursor-pointer border-b px-3 py-3 text-sm ${themeBorder.divider(isDark)}`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
