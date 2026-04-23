import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import toast from "react-hot-toast";
import { FolderKanban, Search } from "lucide-react";
import { getRequest, postRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateReverse } from "../utils/date";
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

export default function PurchaseOrdersCreate() {
  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [rates, setRates] = useState([]);
  const [recommendedSuppliers, setRecommendedSuppliers] = useState({});
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");

  const pageClass = `space-y-3 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const panelClass = `${themeSurface.panel(isDark)} rounded-xl p-3 transition`;
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const modalInputClass = themeControl.modalInput(isDark);

  useEffect(() => {
    loadRequestItems();
  }, [page, search]);

  useEffect(() => {
    loadDicts();
    loadRates();
  }, []);

  useEffect(() => {
    const parentPath = `/projects/${projectId}/blocks/${blockId}/purchase-orders`;
    if (typeof window === "undefined") return undefined;

    window.history.pushState({ purchaseOrdersCreateBackGuard: true }, "", window.location.href);

    const handlePopState = () => {
      navigate(parentPath, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate, projectId, blockId]);

  const loadRequestItems = async () => {
    const payload = {
      project_id: Number(projectId),
      block_id: Number(blockId),
      search,
      page,
      size: 20,
      material_name: search,
      statuses: [2, 3]
    };

    const res = await postRequest("/materialRequestItems/search", payload);

    if (res.success) {
      setItems(res.data);
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
    const res = await getRequest(`/currencyRates/getByDate/${formatDateReverse(new Date())}`);
    if (res.success) {
      setRates(res.data);
    }
  };

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const miStatusStyles = {
    1: "bg-gray-500/10 text-gray-400",
    2: "bg-yellow-500/10 text-yellow-400",
    3: "bg-blue-500/10 text-blue-400",
    4: "bg-green-500/10 text-green-400",
    5: "bg-red-500/10 text-red-400"
  };

  const getRateByCurrency = (currencyId) => {
    const rate = rates.find((item) => item.currency_id === currencyId);
    return rate?.rate || "";
  };

  const loadRecommendedSuppliers = async (itemId, materialId, currency) => {
    if (recommendedSuppliers[materialId]) return;

    const res = await getRequest(`/suppliers/recommend/${materialId}/${currency ?? 1}`);

    if (res.success) {
      const suppliers = res.data;

      setRecommendedSuppliers((prev) => ({
        ...prev,
        [materialId]: suppliers
      }));

      if (suppliers.length) {
        setSelected((prev) => {
          const current = prev[itemId];
          if (!current || current.supplier_id) return prev;

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

    return recommended.map((supplier) => ({
      value: supplier.id,
      label: (
        <div className="flex w-full justify-between">
          <span>{supplier.name}</span>
          <span className="text-xs text-yellow-400">{renderStars(supplier.avg_rating)}</span>
        </div>
      )
    }));
  };

  const getOptions = (dictName, fields = []) => {
    const itemsList = dictionaries[dictName];
    if (!itemsList) return [];

    return itemsList.map((item) => {
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
    setSelected((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const createPurchase = async () => {
    const rawItems = Object.values(selected);

    if (!rawItems.length) {
      toast.error("Выбери хотя бы один материал");
      return;
    }

    const purchaseItems = [];

    for (const item of rawItems) {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      const currency = item.currency;
      const supplier = item.supplier_id;
      const rate = Number(item.currency_rate);

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

      if (currency !== 1 && (!rate || rate <= 0)) {
        toast.error("Укажи курс валюты");
        return;
      }

      const finalRate = currency === 1 ? null : rate;
      const summ = quantity * price;

      purchaseItems.push({
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
      block_id: Number(blockId),
      created_user_id: 1,
      items: purchaseItems
    };

    const res = await postRequest("/purchaseOrders/create", payload);

    if (res.success === true) {
      toast.success("Заявка создана!");
      navigate(`/projects/${projectId}/blocks/${blockId}/purchase-orders`);
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className={pageClass}>
      <div className="flex items-center gap-2">
        <FolderKanban size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">
          Создать закуп: {getDictName("projectBlocks", blockId)}
        </h1>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            placeholder="Поиск материалов..."
            className={inputClass}
          />
        </div>

        <button
          onClick={() => {
            setPage(1);
            setSearch(inputSearch);
          }}
          className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
        >
          Go
        </button>
      </div>

      {items.map((item) => {
        const checked = !!selected[item.id];
        const expanded = expandedId === item.id;

        return (
          <div
            key={item.id}
            className={`${panelClass} ${
              checked
                ? isDark
                  ? "border-green-500"
                  : "border-green-500 bg-green-50"
                : isDark
                  ? "border-gray-800"
                  : "border-slate-200"
            }`}
          >
            <div
              onClick={() => {
                setExpandedId(expanded ? null : item.id);

                if (!expanded) {
                  loadRecommendedSuppliers(item.id, item.material_id, item.currency);
                }
              }}
              className="flex cursor-pointer items-start justify-between"
            >
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${themeText.title(isDark)}`}>
                  {getDictName("materials", item.material_id)}
                </span>

                <span className={`text-xs ${themeText.secondary(isDark)}`}>
                  Остаток: {item.remaining_quantity}{" "}
                  {getDictName("unitsOfMeasure", item.unit_of_measure)}
                </span>
              </div>

              <div className="flex flex-col items-end gap-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleItem(item)}
                  className="h-5 w-5 accent-green-500"
                />

                <span
                  className={`whitespace-nowrap rounded px-2 py-[3px] text-[11px] ${
                    miStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"
                  }`}
                >
                  {getDictName("materialRequestItemStatuses", item.status)}
                </span>
              </div>
            </div>

            {checked && expanded && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className={`absolute left-2 top-1 text-[10px] ${themeText.secondary(isDark)}`}>
                      Кол-во
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Количество..."
                      value={selected[item.id]?.quantity ?? ""}
                      onChange={numberHandler((value) => updateField(item.id, "quantity", value))}
                      className={`${modalInputClass} px-2 pb-2 pt-4`}
                    />
                  </div>

                  <div className="w-24">
                    <Select
                      styles={getSelectStyles(isDark)}
                      options={getOptions("unitsOfMeasure")}
                      value={getOptions("unitsOfMeasure").find(
                        (unit) => unit.value === selected[item.id].unit_of_measure
                      )}
                      onChange={(value) => updateField(item.id, "unit_of_measure", value?.value)}
                      placeholder="Ед."
                      isSearchable={false}
                    />
                  </div>

                  <div className="relative w-28">
                    <span className={`absolute left-2 top-1 text-[10px] ${themeText.secondary(isDark)}`}>
                      Цена
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Цена..."
                      value={selected[item.id]?.price ?? ""}
                      onChange={numberHandler((value) => updateField(item.id, "price", value))}
                      className={`${modalInputClass} px-2 pb-2 pt-4`}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      styles={getSelectStyles(isDark)}
                      options={getOptions("currencies")}
                      value={getOptions("currencies").find(
                        (currency) => currency.value === selected[item.id].currency
                      )}
                      onChange={(value) => {
                        const currencyId = value?.value;
                        updateField(item.id, "currency", currencyId);
                        updateField(item.id, "currency_rate", getRateByCurrency(currencyId));
                      }}
                      placeholder="Валюта"
                      isSearchable={false}
                    />
                  </div>

                  {selected[item.id].currency !== 1 && selected[item.id].currency !== null && (
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Курс..."
                      value={selected[item.id]?.currency_rate ?? ""}
                      onChange={numberHandler((value) =>
                        updateField(item.id, "currency_rate", value)
                      )}
                      className={`${modalInputClass} w-28`}
                    />
                  )}
                </div>

                <Select
                  styles={getSelectStyles(isDark)}
                  options={getSupplierOptions(item.material_id)}
                  value={
                    getSupplierOptions(item.material_id).find(
                      (supplier) => supplier.value === selected[item.id].supplier_id
                    ) ||
                    getSupplierOptions(item.material_id)[0] ||
                    null
                  }
                  onChange={(value) => updateField(item.id, "supplier_id", value?.value)}
                  placeholder="Поставщик"
                  isSearchable={false}
                />

                <input
                  value={selected[item.id].comment}
                  onChange={(e) => updateField(item.id, "comment", e.target.value)}
                  className={modalInputClass}
                  placeholder="Комментарий"
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-6 flex justify-center gap-3">
        <button
          disabled={!pagination?.hasPrev}
          onClick={() => setPage(page - 1)}
          className={subtleButtonClass}
        >
          Назад
        </button>

        <span className={`text-sm ${themeText.secondary(isDark)}`}>
          {pagination?.page || page} / {pagination?.pages || 1}
        </span>

        <button
          disabled={!pagination?.hasNext}
          onClick={() => setPage(page + 1)}
          className={subtleButtonClass}
        >
          Далее
        </button>
      </div>

      <button
        onClick={createPurchase}
        className="fixed bottom-20 right-8 rounded-lg bg-green-600 px-5 py-3 text-white"
      >
        Создать закуп ({Object.keys(selected).length})
      </button>
    </div>
  );
}
