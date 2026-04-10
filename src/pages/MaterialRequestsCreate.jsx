import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import toast from "react-hot-toast";
import { FolderKanban, Plus, Search, Upload } from "lucide-react";
import { postRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { numberHandler } from "../utils/numberInput";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const getSelectStyles = (isDark) => ({
  control: (base, state) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff",
    borderColor: state.isFocused ? "#3b82f6" : isDark ? "#374151" : "#cbd5e1",
    boxShadow: "none",
    minHeight: 42
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: isDark ? "#111827" : "#ffffff",
    border: `1px solid ${isDark ? "#374151" : "#cbd5e1"}`
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

export default function MaterialRequestsCreate() {
  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [estimateItems, setEstimateMaterials] = useState([]);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [dictionaries, setDictionaries] = useState({});
  const [selected, setSelected] = useState({});
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manual, setManual] = useState({
    material_type: null,
    material_id: null,
    unit_of_measure: null,
    quantity: "",
    stage_id: null,
    subsection_id: null,
    item_type: 2,
    comment: ""
  });

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);
  const manualItems = Object.entries(selected).filter(([key]) => key.startsWith("manual_"));

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const panelClass = `${themeSurface.panel(isDark)} rounded-xl p-4`;
  const modalInputClass = themeControl.modalInput(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);

  useEffect(() => {
    loadMaterials();
  }, [page, search]);

  useEffect(() => {
    loadDictionaries([
      "materials",
      "materialTypes",
      "unitsOfMeasure",
      "blockStages",
      "stageSubsections"
    ]).then(setDictionaries);
  }, []);

  const loadMaterials = async () => {
    const res = await postRequest("/materialEstimateItems/search", {
      block_id: Number(blockId),
      item_type: 1,
      material_name: search,
      page,
      size: 20
    });

    if (!res.success) return;

    const sorted = [...res.data].sort((a, b) => b.remaining - a.remaining);
    setEstimateMaterials(sorted);
    setPagination(res.pagination);
  };

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

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

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
          material_type: item.material_type,
          material_id: item.material_id,
          unit_of_measure: item.unit_of_measure,
          stage_id: item.stage_id,
          subsection_id: item.subsection_id,
          quantity: item.remaining > 0 ? item.remaining : 1,
          currency: item.currency,
          price: item.price,
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
    const materialType = getOptions("materialTypes").find((type) => type.value === item.material_type);
    const unit = getOptions("unitsOfMeasure").find((unitItem) => unitItem.value === item.unit_of_measure);
    const stage = getOptions("blockStages").find((stageItem) => stageItem.value === item.stage_id);
    const subsection = dictionaries.stageSubsections
      ?.map((subsectionItem) => ({
        value: subsectionItem.id,
        label: subsectionItem.label,
        stage_id: subsectionItem.stage_id
      }))
      .find((subsectionItem) => subsectionItem.value === item.subsection_id);

    setManual({
      material_type: materialType || null,
      material_id: item.material_id,
      unit_of_measure: unit || null,
      stage_id: stage || null,
      subsection_id: subsection || null,
      quantity: item.quantity,
      comment: item.comment || ""
    });

    setEditingId(id);
    setShowManualModal(true);
  };

  const saveManualMaterial = () => {
    if (!manual.material_id || !manual.unit_of_measure || !manual.stage_id || !manual.quantity) {
      toast.error("Заполни все обязательные поля");
      return;
    }

    const itemData = {
      material_type: manual.material_type?.value,
      material_id: manual.material_id,
      unit_of_measure: manual.unit_of_measure?.value,
      quantity: Number(manual.quantity),
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
        const id = `manual_${Date.now()}`;
        copy[id] = itemData;
      }

      return copy;
    });

    setManual({
      material_type: null,
      material_id: null,
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

  const removeItem = (id) => {
    setSelected((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const createRequest = async () => {
    const items = Object.values(selected);
    if (!items.length) return;

    const res = await postRequest("/materialRequests/create", {
      project_id: Number(projectId),
      block_id: Number(blockId),
      items
    });

    if (res.success) {
      navigate(`/projects/${projectId}/blocks/${blockId}/material-requests`);
    } else {
      toast.error(res.message);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  const materialOptions = getOptions("materials", ["type", "unit_of_measure"]);
  const filteredMaterialOptions = materialOptions.filter((item) => {
    if (manual.material_type?.value && Number(item.type) !== Number(manual.material_type.value)) {
      return false;
    }

    return item.label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">Создание заявки</h1>
        </div>

        <button
          disabled={!selectedCount}
          onClick={createRequest}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:bg-gray-700"
        >
          Создать ({selectedCount})
        </button>
      </div>

      <button
        onClick={() => setShowManualModal(true)}
        className={`${themeControl.chipButton(isDark)} flex items-center gap-2 py-2`}
      >
        <Plus size={16} />
        Добавить материал
      </button>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Поиск материалов..."
            className={inputClass}
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
          <div className={`text-xs ${themeText.secondary(isDark)}`}>Добавленные вручную</div>

          {manualItems.map(([id, item]) => (
            <div
              key={id}
              className={`${panelClass} flex cursor-pointer items-start justify-between border-yellow-700/40`}
              onClick={() => editManualItem(id, item)}
            >
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-semibold text-yellow-400">
                    {getDictName("materials", item.material_id) || "Материал"}
                  </span>

                  <span className={`text-sm ${themeText.primary(isDark)}`}>
                    {item.quantity}{" "}
                    <span className={`text-xs ${themeText.muted(isDark)}`}>
                      {getDictName("unitsOfMeasure", item.unit_of_measure)}
                    </span>
                  </span>
                </div>

                <span className={`text-xs ${themeText.secondary(isDark)}`}>
                  {getDictName("blockStages", item.stage_id)}
                  {item.subsection_id && (
                    <>
                      {" "}
                      → {getDictName("stageSubsections", item.subsection_id)}
                    </>
                  )}
                </span>

                {item.comment && (
                  <span className={`text-[11px] ${themeText.muted(isDark)}`}>{item.comment}</span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(id);
                }}
                className="ml-2 text-xs text-red-400 hover:text-red-300"
              >
                ×
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
              className={`${panelClass} flex cursor-pointer items-center justify-between transition-all hover:scale-[1.01] ${
                checked
                  ? isDark
                    ? "border-green-500 bg-gray-800 shadow-lg shadow-green-900/20"
                    : "border-green-500 bg-green-50 shadow-lg shadow-green-200/40"
                  : isDark
                    ? "border-gray-800 hover:border-blue-500"
                    : "border-slate-200 hover:border-blue-500"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className={`text-sm font-semibold ${themeText.title(isDark)}`}>
                  {getDictName("materials", item.material_id)}
                </span>

                <span className={`text-xs ${themeText.secondary(isDark)}`}>
                  {getDictName("blockStages", item.stage_id)}
                  {item.subsection_id && (
                    <>
                      {" "}
                      → {getDictName("stageSubsections", item.subsection_id)}
                    </>
                  )}
                </span>

                <span className="text-xs">
                  <span className={themeText.secondary(isDark)}>К заказу: </span>
                  <span
                    className={
                      item.remaining > 0
                        ? "text-green-400"
                        : item.remaining === 0
                          ? "text-yellow-400"
                          : "text-red-400"
                    }
                  >
                    {item.remaining}
                  </span>

                  <span className={themeText.secondary(isDark)}> / </span>

                  <span className={themeText.primary(isDark)}>{item.quantity_planned}</span>

                  <span className={`ml-1 ${themeText.muted(isDark)}`}>
                    {getDictName("unitsOfMeasure", item.unit_of_measure)}
                  </span>
                </span>

                {item.remaining <= 0 && (
                  <span className="text-[11px] text-red-400">Возможен перерасход</span>
                )}

                {checked && (
                  <input
                    type="text"
                    placeholder="Комментарий..."
                    value={selected[item.id]?.comment || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateSelected(item.id, "comment", e.target.value)}
                    className={`${modalInputClass} mt-2`}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={selected[item.id]?.quantity || ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateSelected(item.id, "quantity", e.target.value)}
                  disabled={!checked}
                  className={`${modalInputClass} w-24 text-right`}
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
          <div className={`${themeSurface.panel(isDark)} w-[420px] space-y-3 rounded-xl p-5`}>
            <div className="text-sm font-semibold">
              {editingId ? "Редактировать материал" : "Добавить материал вручную"}
            </div>

            <Select
              styles={getSelectStyles(isDark)}
              options={getOptions("materialTypes")}
              value={manual.material_type}
              onChange={(value) =>
                setManual((prev) => ({ ...prev, material_type: value, material_id: null }))
              }
              placeholder="Тип материала..."
              isSearchable={false}
            />

            <div
              onClick={() => setShowMaterialModal(true)}
              className={`${themeSurface.panelMuted(isDark)} cursor-pointer rounded border ${isDark ? "border-gray-700" : "border-slate-300"} px-3 py-2 text-sm`}
            >
              {manual.material_id ? (
                <span className={themeText.primary(isDark)}>
                  {
                    materialOptions.find((material) => material.value === manual.material_id)?.label
                  }
                </span>
              ) : (
                <span className={themeText.secondary(isDark)}>Материал...</span>
              )}
            </div>

            {showMaterialModal && (
              <div
                className="fixed inset-0 z-50 flex flex-col justify-end"
                onClick={() => setShowMaterialModal(false)}
              >
                <div className="absolute inset-0 bg-black/60" />

                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`${themeSurface.page(isDark)} relative flex h-[75vh] w-full flex-col rounded-t-2xl`}
                >
                  <div className={`mx-auto my-2 h-1 w-10 rounded-full ${isDark ? "bg-gray-600" : "bg-slate-300"}`} />

                  <div className="px-4 pb-2">
                    <input
                      placeholder="Поиск..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={modalInputClass}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto px-2">
                    {filteredMaterialOptions.map((item) => (
                      <div
                        key={item.value}
                        onClick={() => {
                          const defaultUnit = getOptions("unitsOfMeasure").find(
                            (unit) => unit.value === item.unit_of_measure
                          );

                          setManual((prev) => ({
                            ...prev,
                            material_id: item.value,
                            unit_of_measure: defaultUnit || prev.unit_of_measure
                          }));

                          setShowMaterialModal(false);
                          setSearch("");
                        }}
                        className={`cursor-pointer border-b px-3 py-3 text-sm ${themeBorderClass(isDark)}`}
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
                inputMode="decimal"
                placeholder="Количество"
                value={manual.quantity}
                onChange={numberHandler((value) =>
                  setManual((prev) => ({ ...prev, quantity: value }))
                )}
                className={modalInputClass}
              />

              <Select
                styles={getSelectStyles(isDark)}
                options={getOptions("unitsOfMeasure")}
                value={manual.unit_of_measure}
                onChange={(value) =>
                  setManual((prev) => ({ ...prev, unit_of_measure: value }))
                }
                placeholder="Ед. изм..."
                isSearchable={false}
              />
            </div>

            <Select
              styles={getSelectStyles(isDark)}
              options={getOptions("blockStages")}
              value={manual.stage_id}
              onChange={(value) =>
                setManual((prev) => ({ ...prev, stage_id: value, subsection_id: null }))
              }
              placeholder="Этап..."
              isSearchable={false}
            />

            <Select
              styles={getSelectStyles(isDark)}
              options={getOptions("stageSubsections")}
              value={manual.subsection_id}
              onChange={(value) =>
                setManual((prev) => ({ ...prev, subsection_id: value }))
              }
              placeholder="Подэтап..."
              isDisabled={!manual.stage_id}
              isSearchable={false}
            />

            <input
              placeholder="Комментарий"
              value={manual.comment}
              onChange={(e) => setManual((prev) => ({ ...prev, comment: e.target.value }))}
              className={modalInputClass}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowManualModal(false)}
                className={subtleButtonClass}
              >
                Отмена
              </button>

              <button
                onClick={saveManualMaterial}
                className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500"
              >
                {editingId ? "Сохранить" : "Добавить"}
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
            className={subtleButtonClass}
          >
            Назад
          </button>

          <span className={`text-sm ${themeText.secondary(isDark)}`}>
            {pagination.page} / {pagination.pages}
          </span>

          <button
            disabled={!pagination.hasNext}
            onClick={() => setPage(page + 1)}
            className={subtleButtonClass}
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
}

function themeBorderClass(isDark) {
  return isDark
    ? "border-gray-800 active:bg-gray-800"
    : "border-slate-200 active:bg-slate-100";
}
