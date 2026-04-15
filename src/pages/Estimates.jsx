import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ClipboardList, Pencil, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { deleteRequest, getRequest, postRequest, putRequest } from "../api/request";
import { AuthContext } from "../auth/AuthContext";
import { formatDateReverse, formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import PullToRefresh from "../components/PullToRefresh";
import { themeBorder, themeControl, themeSurface, themeText } from "../utils/themeStyles";

const ESTIMATE_EDITOR_ROLE_IDS = [1, 10, 11];

const EMPTY_ITEM_FORM = {
  id: null,
  item_type: 1,
  entry_type: 1,
  stage_id: "",
  subsection_id: "",
  material_id: "",
  service_id: "",
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
  const [rates, setRates] = useState([]);

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

  const estimateStatusLabel = useMemo(
    () => getDictName("generalStatuses", estimate?.status),
    [estimate?.status, getDictName]
  );

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

  const openCreateModal = () => {
    if (!canEditEstimate) return;
    setItemForm(EMPTY_ITEM_FORM);
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
      material_id: String(item.material_id || ""),
      service_id: String(item.service_id || ""),
      quantity_planned: String(item.quantity_planned ?? ""),
      coefficient: String(item.coefficient ?? "1"),
      currency: String(item.currency ?? "1"),
      currency_rate: String(item.currency_rate ?? "1"),
      price: item.price == null ? "" : String(item.price),
      comment: item.comment || ""
    });
    setItemModalOpen(true);
  };

  const closeModal = () => {
    if (savingItem) return;
    setItemModalOpen(false);
    setItemForm(EMPTY_ITEM_FORM);
  };

  const handleItemFormChange = (field, value) => {
    setItemForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "item_type") {
        next.material_id = "";
        next.service_id = "";
      }

      if (field === "stage_id") {
        next.subsection_id = "";
      }

      if (field === "material_id") {
        const material = getMaterialById(value);
        next.material_id = value;
        if (material?.unit_of_measure) {
          next.unit_of_measure = material.unit_of_measure;
        }
      }

      if (field === "service_id") {
        const service = getServiceById(value);
        next.service_id = value;
        if (service?.unit_of_measure) {
          next.unit_of_measure = service.unit_of_measure;
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
    const unitOfMeasure = material?.unit_of_measure || service?.unit_of_measure;

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
          entry_type: Number(itemForm.entry_type),
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
            entry_type: Number(itemForm.entry_type),
            service_type: Number(itemForm.item_type) === 2 ? service?.service_type || null : null,
            service_id: Number(itemForm.item_type) === 2 ? Number(itemForm.service_id) : null,
            material_type: Number(itemForm.item_type) === 1 ? material?.type || null : null,
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

  const pageClass = `space-y-4 pb-20 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-3`;
  const itemCardClass = `${themeSurface.panelMuted(isDark)} rounded px-2 py-1.5 text-xs`;
  const stickyClass = themeSurface.sticky(isDark);
  const modalBackdropClass = "fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4";
  const modalCardClass = `${themeSurface.panel(isDark)} w-full max-w-2xl rounded-t-2xl p-4 md:rounded-2xl`;
  const modalLabelClass = `mb-1 block text-[11px] font-medium ${themeText.secondary(isDark)}`;

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
          <h1 className="text-lg font-semibold">Смета</h1>
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{estimate.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${Number(estimate.status) === 2
                      ? "bg-emerald-100 text-emerald-700"
                      : isDark
                        ? "bg-gray-800 text-gray-200"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                    {estimateStatusLabel || `Статус #${estimate.status}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] ${themeText.secondary(isDark)}`}>{formatDateTime(estimate.created_at)}</span>
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

              <div className="flex justify-between text-[12px]">
                <span className={themeText.secondary(isDark)}>Позиций: {filteredItems.length}</span>
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

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className={modalLabelClass}>Тип позиции</span>
                <select
                  className={inputClass}
                  value={itemForm.item_type}
                  onChange={(e) => handleItemFormChange("item_type", e.target.value)}
                  disabled={Boolean(itemForm.id)}
                >
                  <option value={1}>Материал</option>
                  <option value={2}>Услуга</option>
                </select>
              </label>

              <label>
                <span className={modalLabelClass}>Этап</span>
                <select
                  className={inputClass}
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
                <span className={modalLabelClass}>Подэтап</span>
                <select
                  className={inputClass}
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
                <span className={modalLabelClass}>Тип записи</span>
                <select
                  className={inputClass}
                  value={itemForm.entry_type}
                  onChange={(e) => handleItemFormChange("entry_type", e.target.value)}
                >
                  <option value={1}>Основной</option>
                  <option value={2}>Дополнительный</option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className={modalLabelClass}>{Number(itemForm.item_type) === 1 ? "Материал" : "Услуга"}</span>
                {Number(itemForm.item_type) === 1 ? (
                  <select
                    className={inputClass}
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
                    className={inputClass}
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

              <label>
                <span className={modalLabelClass}>Количество</span>
                <input
                  className={inputClass}
                  value={itemForm.quantity_planned}
                  onChange={(e) => handleItemFormChange("quantity_planned", e.target.value)}
                  placeholder="0"
                />
              </label>

              <label>
                <span className={modalLabelClass}>Коэффициент</span>
                <input
                  className={inputClass}
                  value={itemForm.coefficient}
                  onChange={(e) => handleItemFormChange("coefficient", e.target.value)}
                  placeholder="1"
                />
              </label>

              <label>
                <span className={modalLabelClass}>Валюта</span>
                <select
                  className={inputClass}
                  value={itemForm.currency}
                  onChange={(e) => handleItemFormChange("currency", e.target.value)}
                >
                  {(dictionaries.currencies || []).map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.code || currency.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className={modalLabelClass}>Курс</span>
                <input
                  className={inputClass}
                  value={Number(itemForm.currency) === 1 ? "1" : itemForm.currency_rate}
                  onChange={(e) => handleItemFormChange("currency_rate", e.target.value)}
                  placeholder="Курс"
                  disabled={Number(itemForm.currency) === 1}
                />
              </label>

              <label>
                <span className={modalLabelClass}>Цена</span>
                <input
                  className={inputClass}
                  value={itemForm.price}
                  onChange={(e) => handleItemFormChange("price", e.target.value)}
                  placeholder="0"
                />
              </label>

              <label className="md:col-span-2">
                <span className={modalLabelClass}>Комментарий</span>
                <input
                  className={inputClass}
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
    </div>
  );
}
