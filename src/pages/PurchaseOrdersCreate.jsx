import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest, postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { selectStyles } from "../utils/selectStyles";
import { numberHandler } from "../utils/numberInput";
import Select from "react-select";
import { formatDateReverse } from "../utils/date";
import { Search, FolderKanban, Plus } from "lucide-react";
import toast from "react-hot-toast";



export default function PurchaseOrders() {

  const { projectId, blockId } = useParams();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [rates, setRates] = useState([]);
  const [recommendedSuppliers, setRecommendedSuppliers] = useState({});

  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");


  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    loadRequestItems();
  }, [page, search]);

  useEffect(() => {
    loadDicts();
    loadRates();
  }, []);

  const loadRequestItems = async () => {

    const payload = {
      project_id: Number(projectId),
      block_id: Number(blockId),
      search,
      page,
      size: 20,
      material_name: search
    };

    // 🔥 добавляем фильтр по роли
    // if (user.role_id === 7) {
    payload.statuses = [2, 3];
    // }

    const res = await postRequest(
      "/materialRequestItems/search",
      payload
    );

    if (res.success) {
      setItems(res.data);
      setTotal(res.pagination.total || 0);
      setPagination(res.pagination);
    }

  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "projectBlocks",
      "materials",
      "unitsOfMeasure",
      "currencies",
      "materialRequestItemStatuses"
    ]);
    setDictionaries(dicts);
  };

  const loadRates = async () => {

    const res = await getRequest(
      "/currencyRates/getByDate/" + formatDateReverse(new Date())
    );

    if (res.success) {
      setRates(res.data);
    }

  };

  /* ---------------- HELPERS ---------------- */
  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  const miStatusStyles = {
    1: "bg-gray-500/10 text-gray-400",       // Создан
    2: "bg-yellow-500/10 text-yellow-400",   // Одобрено
    3: "bg-blue-500/10 text-blue-400",       // Частично заказано
    4: "bg-green-500/10 text-green-400",     // Полностью заказано
    5: "bg-red-500/10 text-red-400"          // Отменено
  };

  const getRateByCurrency = (currencyId) => {
    const rate = rates.find(r => r.currency_id === currencyId);
    return rate?.rate || "";
  };

  /* ---------------- SUPPLIERS ---------------- */

  const loadRecommendedSuppliers = async (itemId, materialId, currency) => {
    console.log("CC", currency)
    if (recommendedSuppliers[materialId]) return;

    const res = await getRequest(`/suppliers/recommend/${materialId}/${currency ?? 1}`);

    if (res.success) {

      const suppliers = res.data;

      setRecommendedSuppliers(prev => ({
        ...prev,
        [materialId]: suppliers
      }));

      // 🔥 ставим первого поставщика
      if (suppliers.length) {

        setSelected(prev => {

          const current = prev[itemId];

          if (!current) return prev;
          if (current.supplier_id) return prev;

          console.log("BB", suppliers[0])

          return {
            ...prev,
            [itemId]: {
              ...current,
              supplier_id: suppliers[0].id,
              price: suppliers[0].best_price ?? current.price
            }
          };
        });
      }
    }
  };

  const renderStars = (rating = 0) => {
    const full = Math.floor(rating);
    return (
      <span className="flex gap-[1px]">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={i < full ? "" : "text-gray-600"}>
            ★
          </span>
        ))}
      </span>
    );
  };

  const getSupplierOptions = (materialId) => {
    const recommended = recommendedSuppliers[materialId] || [];

    return recommended.map(s => ({
      value: s.id,
      label: (
        <div className="flex justify-between w-full">
          <span>{s.name}</span>
          <span className="text-yellow-400 text-xs">
            {renderStars(s.avg_rating)}
          </span>
        </div>
      )
    }));
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

  /* ---------------- LOGIC ---------------- */
  const toggleItem = (item) => {
    console.log("CH", item)

    setSelected(prev => {

      if (prev[item.id]) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: item.remaining_quantity,
          price: item.price ?? "",
          currency: item.currency ?? 1,
          currency_rate: item.currency !== 1 ? getRateByCurrency(item.currency) : null,
          supplier_id: null,
          comment: ""
        }
      };

    });

  };

  const updateField = (id, field, value) => {
    setSelected(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const createPurchase = async () => {

    const rawItems = Object.values(selected);

    console.log("ORDER", rawItems)

    if (!rawItems.length) {
      toast.error("Выбери хотя бы один материал");
      return;
    }

    const items = [];

    for (const item of rawItems) {

      const quantity = Number(item.quantity);
      const price = Number(item.price);
      const currency = item.currency;
      const supplier = item.supplier_id;
      const rate = Number(item.currency_rate);

      // 🔥 проверки
      if (!quantity || quantity <= 0) {
        toast.error("Укажи количество");
        return;
      }

      if (!price || price <= 0) {
        toast.error("Укажи цену");
        return;
      }

      if (!currency) {
        toast.error("Выбери валюту");
        return;
      }

      if (!supplier) {
        toast.error("Выбери поставщика");
        return;
      }

      // 🔥 курс обязателен если НЕ сом
      if (currency !== 1 && (!rate || rate <= 0)) {
        toast.error("Укажи курс валюты");
        return;
      }

      const finalRate = currency === 1 ? null : rate;

      const summ = quantity * price;

      items.push({
        material_request_item_id: item.id,
        material_type: item.material_type,
        material_id: item.material_id,
        unit_of_measure: item.unit_of_measure,
        quantity,
        price,
        currency,
        currency_rate: finalRate,
        supplier_id: supplier,
        summ
      });
    }

    const payload = {
      project_id: Number(projectId),
      block_id: Number(rawItems[0]?.block_id || 1), // подстрой если нужно
      created_user_id: 1, // потом заменишь на user.id
      items
    };

    console.log("ORDER", payload);

    const res = await postRequest('/purchaseOrders/create', payload);

    if (res.success == true) {
      toast.success("Заявка создана!");
      navigate(`/projects/${projectId}/blocks/${blockId}/purchase-orders`)
    }
    else {
      toast.error(res.message)
    }
  };

  /* ---------------- UI ---------------- */
  return (

    <div className="space-y-3 text-white pb-24">
      <h1 className="text-lg font-semibold">
        Создать закуп: {getDictName("projectBlocks", blockId)}
      </h1>

      {/* SEARCH */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            placeholder="Поиск материалов..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm"
          />
        </div>

        <button
          onClick={() => {
            setPage(1);
            setSearch(inputSearch);
          }}
          className="px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
        >
          Go
        </button>

      </div>

      {items.map(item => {
        const checked = !!selected[item.id];
        const expanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            className={`bg-gray-900 border rounded-xl p-3 transition
              ${checked ? "border-green-500" : "border-gray-800"}
            `}
          >

            {/* HEADER */}
            <div
              onClick={() => {
                setExpandedId(expanded ? null : item.id);

                if (!expanded) {
                  loadRecommendedSuppliers(item.id, item.material_id, item.currency);
                }
              }}
              className="flex justify-between items-start cursor-pointer"
            >

              {/* LEFT */}
              <div className="flex flex-col">

                <span className="text-sm font-semibold">
                  {getDictName("materials", item.material_id)}
                </span>

                <span className="text-xs text-gray-400">
                  Остаток: {item.remaining_quantity}{" "}
                  {getDictName("unitsOfMeasure", item.unit_of_measure)}
                </span>

              </div>

              {/* RIGHT */}
              <div className="flex flex-col items-end gap-1">

                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleItem(item)}
                  className="w-5 h-5 accent-green-500"
                />

                <span className={`text-[11px] px-2 py-[3px] rounded whitespace-nowrap ${miStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"}`}
                >
                  {getDictName("materialRequestItemStatuses", item.status)}
                </span>
              </div>

            </div>

            {/* DETAILS */}
            {checked && expanded && (

              <div className="mt-3 space-y-3">

                <div className="flex gap-2">

                  {/* КОЛИЧЕСТВО */}
                  <div className="relative flex-1">

                    <span className="absolute left-2 top-1 text-[10px] text-gray-400">
                      Кол-во
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Количество..."
                      value={selected[item.id]?.quantity ?? ""}
                      onChange={numberHandler((val) =>
                        updateField(item.id, "quantity", val)
                      )}
                      className="w-full pt-4 pb-2 px-2 bg-gray-800 rounded text-sm"
                    />

                  </div>

                  {/* ЕД ИЗМ */}
                  <div className="w-24">
                    <Select
                      styles={selectStyles}
                      options={getOptions("unitsOfMeasure")}
                      value={getOptions("unitsOfMeasure").find(
                        u => u.value === selected[item.id].unit_of_measure
                      )}
                      onChange={(v) =>
                        updateField(item.id, "unit_of_measure", v?.value)
                      }
                      placeholder="Ед."
                      isSearchable={false}
                    />
                  </div>

                  {/* ЦЕНА */}
                  <div className="relative w-28">

                    <span className="absolute left-2 top-1 text-[10px] text-gray-400">
                      Цена
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Цена..."
                      value={selected[item.id]?.price ?? ""}
                      onChange={numberHandler((val) =>
                        updateField(item.id, "price", val)
                      )}
                      className="w-full pt-4 pb-2 px-2 bg-gray-800 rounded text-sm"
                    />

                    {/* <input
                      type="number"
                      value={selected[item.id].price}
                      onChange={(e) =>
                        updateField(item.id, "price", e.target.value)
                      }
                      className="w-full pt-4 pb-2 px-2 bg-gray-800 rounded text-sm"
                    /> */}

                  </div>

                </div>

                <div className="flex gap-2">

                  {/* ВАЛЮТА */}
                  <div className="flex-1">
                    <Select
                      styles={selectStyles}
                      options={getOptions("currencies")}
                      value={getOptions("currencies").find(
                        c => c.value === selected[item.id].currency
                      )}
                      onChange={(v) => {
                        const currencyId = v?.value;

                        updateField(item.id, "currency", currencyId);

                        const rate = getRateByCurrency(currencyId);
                        updateField(item.id, "currency_rate", rate);
                      }}
                      placeholder="Валюта"
                      isSearchable={false}
                    />
                  </div>

                  {/* КУРС */}
                  {selected[item.id].currency !== 1 &&
                    selected[item.id].currency !== null && (
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Курс..."
                        value={selected[item.id]?.currency_rate ?? ""}
                        onChange={numberHandler((val) =>
                          updateField(item.id, "currency_rate", val)
                        )}
                        className="w-28 p-2 bg-gray-800 rounded text-sm"
                      />
                      // <input
                      //   type="number"
                      //   value={selected[item.id].currency_rate}
                      //   onChange={(e) =>
                      //     updateField(item.id, "currency_rate", e.target.value)
                      //   }
                      //   className="w-28 p-2 bg-gray-800 rounded text-sm"
                      //   placeholder="Курс"
                      // />
                    )}

                </div>


                {/* ПОСТАВЩИК */}
                <Select
                  styles={selectStyles}
                  options={getSupplierOptions(item.material_id)}
                  value={
                    getSupplierOptions(item.material_id).find(
                      s => s.value === selected[item.id].supplier_id
                    ) || getSupplierOptions(item.material_id)[0] || null
                  }
                  onChange={(v) =>
                    updateField(item.id, "supplier_id", v?.value)
                  }
                  placeholder="Поставщик"
                  isSearchable={false}
                />

                {/* КОММЕНТ */}
                <input
                  value={selected[item.id].comment}
                  onChange={(e) =>
                    updateField(item.id, "comment", e.target.value)
                  }
                  className="w-full p-2 bg-gray-800 rounded text-sm"
                  placeholder="Комментарий"
                />

              </div>

            )}

          </div>

        );

      })}

      {/* PAGINATION */}
      <div className="flex justify-center gap-3 mt-6">

        <button
          disabled={!pagination?.hasPrev}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50"
        >
          Prev
        </button>

        <span className="text-sm text-gray-400">
          {pagination?.page || page} / {pagination?.pages || 1}
        </span>

        <button
          disabled={!pagination?.hasNext}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50"
        >
          Next
        </button>

      </div>

      {/* CREATE */}
      <button
        onClick={createPurchase}
        className="fixed bottom-20 right-8 px-5 py-3 bg-green-600 rounded-lg"
      >
        Создать закуп ({Object.keys(selected).length})
      </button>

    </div>

  );

}