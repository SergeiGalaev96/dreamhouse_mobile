import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import { Search, FolderKanban, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { getRequest, postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateReverse } from "../utils/date";
import { numberHandler } from "../utils/numberInput";
import { selectStyles } from "../utils/selectStyles";
import { useTheme } from "../context/ThemeContext";
import { AuthContext } from "../auth/AuthContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

export default function WorkPerformedCreate() {
  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);
  const canEditAdvancePayment = user?.role_id === 1 || user?.role_id === 10;

  const [estimateItems, setEstimateMaterials] = useState([]);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [dictionaries, setDictionaries] = useState({});
  const [selected, setSelected] = useState({});
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rates, setRates] = useState([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [performedPersonName, setPerformedPersonName] = useState("");
  const [advancePayment, setAdvancePayment] = useState("");
  const [manual, setManual] = useState({
    service_type: null,
    service_id: null,
    unit_of_measure: null,
    quantity: "",
    stage_id: null,
    subsection_id: null,
    item_type: 2,
    comment: ""
  });

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);

  useEffect(() => {
    loadServices();
    loadRates();
  }, [page, search]);

  useEffect(() => {
    loadDictionaries([
      "projectBlocks",
      "services",
      "serviceTypes",
      "unitsOfMeasure",
      "blockStages",
      "stageSubsections"
    ]).then(setDictionaries);
  }, []);

  useEffect(() => {
    const parentPath = `/projects/${projectId}/blocks/${blockId}/work-performed`;
    if (typeof window === "undefined") return undefined;

    window.history.pushState({ workPerformedCreateBackGuard: true }, "", window.location.href);

    const handlePopState = () => {
      navigate(parentPath, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate, projectId, blockId]);

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const getOptions = (dictName, fields = []) => {
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
  };

  const serviceTypeOptions = useMemo(() => getOptions("serviceTypes"), [dictionaries]);
  const stageOptions = useMemo(
    () =>
      getOptions("blockStages", ["block_id"]).filter((item) =>
        item.block_id != null ? Number(item.block_id) === Number(blockId) : true
      ),
    [dictionaries, blockId]
  );
  const serviceOptions = useMemo(
    () => getOptions("services", ["service_type", "unit_of_measure"]),
    [dictionaries]
  );
  const stageSubsectionOptions = useMemo(
    () => getOptions("stageSubsections", ["stage_id"]),
    [dictionaries]
  );

  const filteredServiceOptions = useMemo(
    () =>
      serviceOptions.filter((item) =>
        manual.service_type?.value
          ? Number(item.service_type) === Number(manual.service_type.value)
          : false
      ),
    [serviceOptions, manual.service_type]
  );

  const subsectionOptions = useMemo(
    () =>
      stageSubsectionOptions.filter((item) =>
        manual.stage_id?.value ? Number(item.stage_id) === Number(manual.stage_id.value) : false
      ),
    [stageSubsectionOptions, manual.stage_id]
  );

  useEffect(() => {
    if (!serviceTypeOptions.length && !stageOptions.length) return;

    setManual((prev) => {
      let changed = false;
      const next = { ...prev };

      if (!prev.service_type) {
        const defaultServiceType =
          serviceTypeOptions.find((item) => Number(item.value) === 1) || serviceTypeOptions[0] || null;
        if (defaultServiceType) {
          next.service_type = defaultServiceType;
          changed = true;
        }
      }

      if (!prev.stage_id) {
        const defaultStage = stageOptions[0] || null;
        if (defaultStage) {
          next.stage_id = defaultStage;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [serviceTypeOptions, stageOptions]);

  const loadServices = async () => {
    const res = await postRequest("/materialEstimateItems/search", {
      block_id: Number(blockId),
      item_type: 2,
      service_name: search,
      page,
      size: 20
    });

    if (!res.success) return;

    const sorted = [...res.data].sort((a, b) => b.remaining - a.remaining);
    setEstimateMaterials(sorted);
    setPagination(res.pagination);
  };

  const loadRates = async () => {
    const res = await getRequest(`/currencyRates/getByDate/${formatDateReverse(new Date())}`);
    if (res.success) {
      setRates(res.data);
    }
  };

  const getRateByCurrency = (currencyId) => {
    const rate = rates.find((item) => item.currency_id === currencyId);
    return rate?.rate || "";
  };

  const toggleItem = (item) => {
    setSelected((prev) => {
      if (prev[item.id]) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      return {
        ...prev,
        [item.id]: {
          material_estimate_item_id: item.id,
          service_type: item.service_type,
          service_id: item.service_id,
          unit_of_measure: item.unit_of_measure,
          stage_id: item.stage_id,
          subsection_id: item.subsection_id,
          quantity: item.remaining > 0 ? item.remaining : 1,
          price: item.price ?? "",
          currency: item.currency ?? 1,
          currency_rate: item.currency !== 1 ? getRateByCurrency(item.currency) : null,
          item_type: 1,
          comment: ""
        }
      };
    });
  };

  const updateSelected = (id, field, value) => {
    setSelected((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const editManualItem = (id, item) => {
    const serviceType = getOptions("serviceTypes").find((option) => option.value === item.service_type);
    const unit = getOptions("unitsOfMeasure").find((option) => option.value === item.unit_of_measure);
    const stage = getOptions("blockStages").find((option) => option.value === item.stage_id);
    const subsection = dictionaries.stageSubsections
      ?.map((stageItem) => ({
        value: stageItem.id,
        label: stageItem.label,
        stage_id: stageItem.stage_id
      }))
      .find((option) => option.value === item.subsection_id);

    setManual({
      service_type: serviceType || null,
      service_id: item.service_id,
      unit_of_measure: unit || null,
      stage_id: stage || null,
      subsection_id: subsection || null,
      quantity: item.quantity,
      item_type: 2,
      comment: item.comment || ""
    });

    setEditingId(id);
    setShowManualModal(true);
  };

  const saveManualService = () => {
    if (!manual.service_id || !manual.unit_of_measure || !manual.stage_id || !manual.quantity) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    const itemData = {
      service_type: manual.service_type?.value,
      service_id: manual.service_id,
      unit_of_measure: manual.unit_of_measure?.value,
      quantity: manual.quantity,
      stage_id: manual.stage_id?.value,
      subsection_id: manual.subsection_id?.value || null,
      item_type: 2,
      comment: manual.comment
    };

    setSelected((prev) => {
      const copy = { ...prev };

      if (editingId) {
        copy[editingId] = itemData;
      } else {
        copy[`manual_${Date.now()}`] = itemData;
      }

      return copy;
    });

    setManual({
      service_type: null,
      service_id: null,
      unit_of_measure: null,
      stage_id: null,
      subsection_id: null,
      quantity: "",
      item_type: 2,
      comment: ""
    });

    setEditingId(null);
    setShowManualModal(false);
  };

  const manualItems = Object.entries(selected).filter(([key]) => key.startsWith("manual_"));

  const removeItem = (id) => {
    setSelected((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const createWorkPerformed = async () => {
    const items = Object.values(selected);
    if (!items.length) return;

    if (!performedPersonName) {
      toast.error("Укажите исполнителя");
      return;
    }

    const res = await postRequest("/workPerformed/create", {
      project_id: Number(projectId),
      block_id: Number(blockId),
      performed_person_name: performedPersonName,
      advance_payment: canEditAdvancePayment && advancePayment !== "" ? Number(advancePayment) : null,
      items
    });

    if (res.success) {
      navigate(`/projects/${projectId}/blocks/${blockId}/work-performed`);
    } else {
      toast.error(res.message);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  const pageClass = `${themeText.page(isDark)} pb-24`;
  const titleClass = themeText.title(isDark);
  const textClass = themeText.primary(isDark);
  const subTextClass = themeText.secondary(isDark);
  const cardClass = themeSurface.card(isDark);
  const modalClass = `${themeSurface.panel(isDark)} w-[420px] space-y-3 p-5 ${themeText.page(isDark)}`;
  const inputClass = isDark
    ? "w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
    : "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-black";
  const searchInputClass = themeControl.input(isDark);
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const manualCardClass = isDark
    ? "rounded-xl border border-yellow-700/40 bg-gray-900 p-3"
    : "rounded-xl border border-yellow-300 bg-yellow-50 p-3";
  const itemCardCheckedClass = isDark
    ? "border-green-500 bg-gray-800 shadow-lg shadow-green-900/20"
    : "border-green-500 bg-green-50 shadow-sm";
  const itemCardUncheckedClass = isDark
    ? "border-gray-800 hover:border-blue-500"
    : "border-slate-300 hover:border-blue-500";
  const sheetClass = isDark
    ? "relative flex h-[75vh] w-full flex-col rounded-t-2xl bg-gray-900"
    : "relative flex h-[75vh] w-full flex-col rounded-t-2xl bg-white";

  return (
    <div className={`space-y-4 ${pageClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban size={20} className="text-blue-500" />
          <h1 className={`text-lg font-semibold ${titleClass}`}>
            Создание АВР: {getDictName("projectBlocks", blockId)}
          </h1>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowManualModal(true)}
          className={isDark
            ? "flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700"
            : "flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-black hover:bg-slate-100"}
        >
          <Plus size={16} />
          Добавить услугу
        </button>

        <button
          disabled={!selectedCount}
          onClick={() => setShowPersonModal(true)}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:bg-gray-700 disabled:text-white"
        >
          Создать ({selectedCount})
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Поиск услуг из сметы..."
            className={searchInputClass}
          />
        </div>

        <button
          onClick={handleSearch}
          className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
        >
          Go
        </button>
      </div>

      {manualItems.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs ${subTextClass}`}>Добавленные вручную</div>

          {manualItems.map(([id, item]) => (
            <div
              key={id}
              className={`${manualCardClass} flex cursor-pointer items-start justify-between`}
              onClick={() => editManualItem(id, item)}
            >
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-semibold text-yellow-500">
                    {getDictName("services", item.service_id) || "Услуга"}
                  </span>

                  <span className={`text-sm ${textClass}`}>
                    {item.quantity}{" "}
                    <span className={`text-xs ${subTextClass}`}>
                      {getDictName("unitsOfMeasure", item.unit_of_measure)}
                    </span>
                  </span>
                </div>

                <span className={`text-xs ${subTextClass}`}>
                  {getDictName("blockStages", item.stage_id)}
                  {item.subsection_id && <> {"->"} {getDictName("stageSubsections", item.subsection_id)}</>}
                </span>

                {item.comment && (
                  <span className={`text-[11px] ${themeText.muted(isDark)}`}>
                    {item.comment}
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(id);
                }}
                className="ml-2 text-xs text-red-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {estimateItems.map((item) => {
          const checked = !!selected[item.id];

          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item)}
              className={`${cardClass} flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all hover:scale-[1.01] ${checked ? itemCardCheckedClass : itemCardUncheckedClass}`}
            >
              <div className="flex flex-col gap-1">
                <span className={`text-sm font-semibold ${titleClass}`}>
                  {getDictName("services", item.service_id)}
                </span>

                <span className={`text-xs ${subTextClass}`}>
                  {getDictName("blockStages", item.stage_id)}
                  {item.subsection_id && <> {"->"} {getDictName("stageSubsections", item.subsection_id)}</>}
                </span>

                <span className="text-xs">
                  <span className={subTextClass}>К заказу: </span>
                  <span className={item.remaining > 0 ? "text-green-500" : item.remaining === 0 ? "text-yellow-500" : "text-red-500"}>
                    {item.remaining}
                  </span>
                  <span className={subTextClass}> / </span>
                  <span className={textClass}>{item.quantity_planned}</span>
                  <span className={`ml-1 ${themeText.muted(isDark)}`}>
                    {getDictName("unitsOfMeasure", item.unit_of_measure)}
                  </span>
                </span>

                {item.remaining <= 0 && (
                  <span className="text-[11px] text-red-500">Возможен перерасход</span>
                )}

                {checked && (
                  <input
                    type="text"
                    placeholder="Комментарий..."
                    value={selected[item.id]?.comment || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateSelected(item.id, "comment", e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Количество..."
                  value={selected[item.id]?.quantity ?? ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={numberHandler((val) => updateSelected(item.id, "quantity", val))}
                  disabled={!checked}
                  className={isDark
                    ? "w-24 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-right text-sm text-white"
                    : "w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm text-black"}
                />

                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleItem(item)}
                  className="h-5 w-5 cursor-pointer accent-green-500"
                />
              </div>
            </div>
          );
        })}
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className={modalClass}>
            <div className="text-sm font-semibold">
              {editingId ? "Редактировать услугу" : "Добавить услугу вручную"}
            </div>

            <Select
              styles={selectStyles}
              options={serviceTypeOptions}
              value={manual.service_type}
              onChange={(value) => setManual((prev) => ({ ...prev, service_type: value, service_id: null }))}
              placeholder="Тип услуги..."
              isSearchable={false}
            />

            <div
              onClick={() => setShowServiceModal(true)}
              className={isDark
                ? "w-full cursor-pointer rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
                : "w-full cursor-pointer rounded border border-slate-300 bg-white px-3 py-2 text-sm text-black"}
            >
              {manual.service_id ? (
                <span className={textClass}>
                  {filteredServiceOptions.find((item) => item.value === manual.service_id)?.label}
                </span>
              ) : (
                <span className={subTextClass}>Услуга...</span>
              )}
            </div>

            {showServiceModal && (
              <div
                className="fixed inset-0 z-50 flex flex-col justify-end"
                onClick={() => setShowServiceModal(false)}
              >
                <div className="absolute inset-0 bg-black/60" />

                <div onClick={(e) => e.stopPropagation()} className={sheetClass}>
                  <div className={`mx-auto my-2 h-1 w-10 rounded-full ${isDark ? "bg-gray-600" : "bg-slate-400"}`} />

                  <div className="px-4 pb-2">
                    <input
                      placeholder="Поиск..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto px-2">
                    {filteredServiceOptions
                      .filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
                      .map((item) => (
                        <div
                          key={item.value}
                          onClick={() => {
                            const defaultUnit = getOptions("unitsOfMeasure").find((unit) => unit.value === item.unit_of_measure);

                            setManual((prev) => ({
                              ...prev,
                              service_id: item.value,
                              unit_of_measure: defaultUnit || prev.unit_of_measure
                            }));

                            setShowServiceModal(false);
                            setSearch("");
                          }}
                          className={`cursor-pointer border-b px-3 py-3 text-sm active:bg-opacity-80 ${isDark ? "border-gray-800 active:bg-gray-800" : "border-slate-200 active:bg-slate-100"}`}
                        >
                          {item.label}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Количество"
                value={manual.quantity}
                onChange={numberHandler((val) => setManual((prev) => ({ ...prev, quantity: val })))}
                className={inputClass}
              />

              <Select
                styles={selectStyles}
                options={getOptions("unitsOfMeasure")}
                value={manual.unit_of_measure}
                onChange={(value) => setManual((prev) => ({ ...prev, unit_of_measure: value }))}
                placeholder="Ед. изм..."
                isSearchable={false}
              />
            </div>

            <Select
              styles={selectStyles}
              options={stageOptions}
              value={manual.stage_id}
              onChange={(value) => setManual((prev) => ({ ...prev, stage_id: value, subsection_id: null }))}
              placeholder="Этап..."
              isSearchable={false}
            />

            <Select
              styles={selectStyles}
              options={subsectionOptions}
              value={manual.subsection_id}
              onChange={(value) => setManual((prev) => ({ ...prev, subsection_id: value }))}
              placeholder="Подэтап..."
              isDisabled={!manual.stage_id}
              isSearchable={false}
            />

            <input
              placeholder="Комментарий"
              value={manual.comment}
              onChange={(e) => setManual((prev) => ({ ...prev, comment: e.target.value }))}
              className={inputClass}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowManualModal(false);
                  setEditingId(null);
                }}
                className={themeControl.subtleButton(isDark)}
              >
                Отмена
              </button>

              <button
                onClick={saveManualService}
                className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500"
              >
                {editingId ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className={`${themeSurface.panel(isDark)} w-[400px] space-y-3 rounded-xl p-5 ${themeText.page(isDark)}`}>
            <div className="text-sm font-semibold">Исполнитель работ</div>

            <input
              placeholder="ФИО исполнителя / ИП..."
              value={performedPersonName}
              onChange={(e) => setPerformedPersonName(e.target.value)}
              className={inputClass}
            />

            {canEditAdvancePayment && (
              <input
                placeholder="Аванс"
                value={advancePayment}
                onChange={numberHandler((value) => setAdvancePayment(value))}
                className={inputClass}
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPersonModal(false)}
                className={themeControl.subtleButton(isDark)}
              >
                Отмена
              </button>

              <button
                onClick={() => {
                  createWorkPerformed();
                  setShowPersonModal(false);
                }}
                className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {pagination && (
        <div className="mt-6 flex justify-center gap-3">
          <button
            disabled={!pagination.hasPrev}
            onClick={() => setPage(page - 1)}
            className={pagerButtonClass}
          >
            Назад
          </button>

          <span className={`text-sm ${subTextClass}`}>
            {pagination.page} / {pagination.pages}
          </span>

          <button
            disabled={!pagination.hasNext}
            onClick={() => setPage(page + 1)}
            className={pagerButtonClass}
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
}
