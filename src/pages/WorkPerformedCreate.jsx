import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { postRequest, getRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateReverse } from "../utils/date";
import { numberHandler } from "../utils/numberInput";
import { selectStyles } from "../utils/selectStyles";
import { Search, FolderKanban, Plus } from "lucide-react";
import Select from "react-select";
import toast from "react-hot-toast";


export default function WorkPerformedCreate() {

  const { projectId, blockId } = useParams();
  const navigate = useNavigate();

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

  const editManualItem = (id, item) => {

    const serviceType = getOptions("serviceTypes").find(
      t => t.value === item.service_type
    );

    const unit = getOptions("unitsOfMeasure").find(
      u => u.value === item.unit_of_measure
    );

    const stage = getOptions("blockStages").find(
      s => s.value === item.stage_id
    );

    const subsection = dictionaries.stageSubsections
      ?.map(s => ({
        value: s.id,
        label: s.label,
        stage_id: s.stage_id
      }))
      .find(s => s.value === item.subsection_id);

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

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);

  /* ---------------- LOAD DATA ---------------- */

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

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };



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

    console.log("SERV", sorted)

    setEstimateMaterials(sorted);
    setPagination(res.pagination);

  };


  /* ---------------- OPTIONS ---------------- */

  const getOptions = (dictName, fields = []) => {
    const items = dictionaries[dictName];
    if (!items) return [];

    return items.map(item => {
      const extra = {};

      fields.forEach(f => {
        extra[f] = item[f];
      });

      return {
        value: item.id,
        label: item.label,
        ...extra
      };
    });
  };

  const loadRates = async () => {
    const res = await getRequest(
      "/currencyRates/getByDate/" + formatDateReverse(new Date())
    );
    if (res.success) {
      setRates(res.data);
    }
  };

  const getRateByCurrency = (currencyId) => {
    const rate = rates.find(r => r.currency_id === currencyId);
    return rate?.rate || "";
  };

  /* ---------------- ESTIMATE ---------------- */
  const toggleItem = (item) => {
    console.log("IT", item)

    setSelected(prev => {

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
    setSelected(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value // 🔥 всегда строка
      }
    }));
  };

  /* ---------------- MANUAL ---------------- */
  const saveManualService = () => {
    // валидация
    if (
      !manual.service_id ||
      !manual.unit_of_measure ||
      !manual.stage_id ||
      !manual.quantity
    ) {
      toast.error("Заполни все обязательные поля");
      return;
    }

    const itemData = {
      service_type: manual.service_type?.value,
      service_id: manual.service_id,
      unit_of_measure: manual.unit_of_measure?.value,
      quantity: Number(manual.quantity),
      stage_id: manual.stage_id?.value,
      subsection_id: manual.subsection_id?.value || null,
      item_type: 2,
      comment: manual.comment
    };

    setSelected(prev => {

      const copy = { ...prev };

      if (editingId) {
        // 🔥 update
        copy[editingId] = itemData;
      } else {
        // 🔥 create
        const id = "manual_" + Date.now();
        copy[id] = itemData;
      }

      return copy;

    });

    // reset
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

  const manualItems = Object.entries(selected).filter(
    ([key]) => key.startsWith("manual_")
  );
  const removeItem = (id) => {
    setSelected(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  /* ---------------- CREATE REQUEST ---------------- */
  const createWorkPerformed = async () => {

    const items = Object.values(selected);
    console.log("REQ ITEMS", items)

    if (!items.length) return;
    const res = await postRequest("/workPerformed/create", {
      project_id: Number(projectId),
      block_id: Number(blockId),
      items
    });

    console.log("RES", res)

    if (res.success) {
      navigate(`/projects/${projectId}/blocks/${blockId}/work-performed`)
    }
    else {
      toast.error(res.message)
    }

  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };


  return (

    <div className="space-y-4 text-white pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FolderKanban size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            Создание АВР: {getDictName("projectBlocks", blockId)}
          </h1>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-between items-center gap-2">

        <button
          onClick={() => setShowManualModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-sm"
        >
          <Plus size={16} />
          Добавить услугу
        </button>

        <button
          disabled={!selectedCount}
          onClick={createWorkPerformed}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 disabled:bg-gray-700"
        >
          Создать ({selectedCount})
        </button>

      </div>

      {/* SEARCH */}
      <div className="flex gap-2 mb-4">

        <div className="relative flex-1">

          <Search
            size={16}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Поиск услуг из смет..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm focus:outline-none focus:border-blue-500"
          />

        </div>

        <button
          onClick={handleSearch}
          className="px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
        >
          Go
        </button>

      </div>




      {/* ESTIMATE ITEMS LIST */}

      {
        manualItems.length > 0 && (

          <div className="space-y-2">

            <div className="text-xs text-gray-400">
              Добавленные вручную
            </div>

            {manualItems.map(([id, item]) => (

              <div
                key={id}
                className="
                bg-gray-900
                border border-yellow-700/40
                rounded-xl
                p-3
                flex justify-between items-start
                cursor-pointer
              "
                onClick={() => editManualItem(id, item)}
              >
                {/* LEFT */}
                <div className="flex flex-col gap-1 flex-1">

                  {/* название + количество */}
                  <div className="flex justify-between">

                    <span className="text-sm font-semibold text-yellow-400">
                      {getDictName("services", item.service_id) || "Услуга"}
                    </span>

                    <span className="text-sm text-gray-300">
                      {item.quantity}{" "}
                      <span className="text-gray-500 text-xs">
                        {getDictName("unitsOfMeasure", item.unit_of_measure)}
                      </span>
                    </span>

                  </div>

                  {/* этап */}
                  <span className="text-xs text-gray-400">
                    {getDictName("blockStages", item.stage_id)}
                    {item.subsection_id && (
                      <>
                        {" "}
                        → {getDictName("stageSubsections", item.subsection_id)}
                      </>
                    )}
                  </span>

                  {/* комментарий */}
                  {item.comment && (
                    <span className="text-[11px] text-gray-500">
                      {item.comment}
                    </span>
                  )}

                </div>

                {/* DELETE */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(id); }}
                  className="
                  ml-2
                  text-red-400
                  hover:text-red-300
                  text-xs
                "
                >
                  ✕
                </button>

              </div>

            ))}

          </div>

        )
      }

      <div className="space-y-2">

        {estimateItems.map(item => {

          const checked = !!selected[item.id];

          return (

            <div
              key={item.id}
              onClick={() => toggleItem(item)}
              className={`bg-gray-900 border rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all hover:scale-[1.01]
                ${checked ? "border-green-500 bg-gray-800 shadow-lg shadow-green-900/20" : "border-gray-800 hover:border-blue-500"}
              `}
            >
              <div className="flex flex-col gap-1">

                <span className="text-sm font-semibold text-gray-100">
                  {getDictName("services", item.service_id)}
                </span>

                <span className="text-xs text-gray-400">

                  {getDictName("blockStages", item.stage_id)}

                  {item.subsection_id && (
                    <>
                      {" "}
                      → {getDictName("stageSubsections", item.subsection_id)}
                    </>
                  )}

                </span>

                <span className="text-xs">
                  <span className="text-gray-400">К заказу: </span>
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

                  <span className="text-gray-400">
                    {" / "}
                  </span>

                  <span className="text-gray-300">
                    {item.quantity_planned}
                  </span>

                  <span className="text-gray-500 ml-1">
                    {getDictName("unitsOfMeasure", item.unit_of_measure)}
                  </span>

                </span>

                {item.remaining <= 0 &&
                  <span className="text-[11px] text-red-400">
                    Возможен перерасход
                  </span>
                }

                {checked && (

                  <input
                    type="text"
                    placeholder="Комментарий..."
                    value={selected[item.id]?.comment || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateSelected(item.id, "comment", e.target.value)
                    }
                    className="mt-2 px-2 py-1 bg-gray-900 border border-gray-700 rounded-md text-xs w-full"
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
                  onChange={numberHandler((val) =>
                    updateSelected(item.id, "quantity", val)
                  )}
                  disabled={!checked}
                  className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded-md text-sm text-right"
                />

                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleItem(item)}
                  className="w-5 h-5 accent-green-500 cursor-pointer"
                />

              </div>

            </div>

          );

        })}

      </div>

      {/* MODAL */}
      {
        showManualModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-[420px] space-y-3">
              <div className="text-sm font-semibold">
                Добавить материал вручную
              </div>

              {/* SERVICE TYPE */}

              <Select
                styles={selectStyles}
                options={getOptions("serviceTypes")}
                value={manual.service_type}
                onChange={(v) =>
                  setManual(prev => ({ ...prev, service_type: v, service_id: null }))
                }
                placeholder="Тип услуги..."
                isSearchable={false}
              />
              {/* SERVICE */}
              <div
                onClick={() => setShowServiceModal(true)}
                className="
                w-full px-3 py-2
                bg-gray-800 border border-gray-700
                rounded text-sm cursor-pointer
              "
              >
                {manual.service_id ? (
                  <span className="text-gray-100">
                    {
                      getOptions("services", [
                        "service_type",
                        "unit_of_measure"
                      ]).find(m => m.value === manual.service_id)?.label
                    }
                  </span>
                ) : (
                  <span className="text-gray-400">
                    Услуга...
                  </span>
                )}
              </div>

              {showServiceModal && (
                <div
                  className="fixed inset-0 z-50 flex flex-col justify-end"
                  onClick={() => setShowServiceModal(false)}
                >

                  {/* overlay */}
                  <div className="absolute inset-0 bg-black/60" />

                  {/* modal */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="
                    relative
                    bg-gray-900
                    rounded-t-2xl
                    w-full
                    h-[75vh]          /* 🔥 фикс высота */
                    flex flex-col
                  "
                  >

                    {/* handle */}
                    <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto my-2" />

                    {/* SEARCH (всегда сверху) */}
                    <div className="px-4 pb-2">

                      <input
                        placeholder="Поиск..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="
                        w-full px-3 py-2
                        bg-gray-800 border border-gray-700
                        rounded text-sm
                      "
                      />

                    </div>

                    {/* LIST */}
                    <div className="flex-1 overflow-y-auto px-2">

                      {getOptions("services", [
                        "service_type",
                        "unit_of_measure"
                      ]).filter(m =>
                        m.label.toLowerCase().includes(search.toLowerCase())
                      )
                        .map(item => (

                          <div
                            key={item.value}
                            onClick={() => {

                              const defaultUnit = getOptions("unitsOfMeasure").find(
                                u => u.value === item.unit_of_measure
                              );

                              setManual(prev => ({
                                ...prev,
                                service_id: item.value,
                                unit_of_measure: defaultUnit || prev.unit_of_measure
                              }));

                              setShowServiceModal(false);
                              setSearch("");
                            }}
                            className="
                            px-3 py-3
                            border-b border-gray-800
                            text-sm
                            cursor-pointer
                            active:bg-gray-800
                          "
                          >
                            {item.label}
                          </div>

                        ))}

                    </div>

                  </div>

                </div>
              )}



              {/* QUANTITY + UNIT */}

              <div className="grid grid-cols-2 gap-2">

                <input
                  type="text"
                  placeholder="Количество"
                  value={manual.quantity}
                  onChange={numberHandler((val) =>
                    setManual(prev => ({ ...prev, quantity: val }))
                  )}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                />

                <Select
                  styles={selectStyles}
                  options={getOptions("unitsOfMeasure")}
                  value={manual.unit_of_measure}
                  onChange={(v) =>
                    setManual(prev => ({ ...prev, unit_of_measure: v }))
                  }
                  placeholder="Ед. изм..."
                  isSearchable={false}
                />

              </div>



              {/* STAGE */}

              <Select
                styles={selectStyles}
                options={getOptions("blockStages")}
                value={manual.stage_id}
                onChange={(v) =>
                  setManual(prev => ({
                    ...prev,
                    stage_id: v,
                    subsection_id: null
                  }))
                }
                placeholder="Этап..."
                isSearchable={false}
              />



              {/* SUBSECTION */}

              <Select
                styles={selectStyles}
                options={getOptions("stageSubsections")}
                value={manual.subsection_id}
                onChange={(v) =>
                  setManual(prev => ({ ...prev, subsection_id: v }))
                }
                placeholder="Подэтап..."
                isDisabled={!manual.stage_id}
                isSearchable={false}
              />



              {/* COMMENT */}

              <input
                placeholder="Комментарий"
                value={manual.comment}
                onChange={(e) =>
                  setManual(prev => ({ ...prev, comment: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              />



              {/* BUTTONS */}

              <div className="flex justify-end gap-2 pt-2">

                <button
                  onClick={() => setShowManualModal(false)}
                  className="px-3 py-1 bg-gray-700 rounded text-sm"
                >
                  Отмена
                </button>

                <button
                  onClick={saveManualService}
                  className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm"
                >
                  {editingId ? "Сохранить" : "Добавить"}
                </button>

              </div>

            </div>

          </div>

        )
      }

      {/* PAGINATION */}
      {
        pagination && (

          <div className="flex justify-center gap-3 mt-6">

            <button
              disabled={!pagination.hasPrev}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-gray-800 rounded"
            >
              Prev
            </button>

            <span className="text-sm text-gray-400">
              {pagination.page} / {pagination.pages}
            </span>

            <button
              disabled={!pagination.hasNext}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-gray-800 rounded"
            >
              Next
            </button>

          </div>

        )
      }
    </div >

  );

}