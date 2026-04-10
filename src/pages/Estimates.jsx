import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ClipboardList, Search } from "lucide-react";
import { postRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import PullToRefresh from "../components/PullToRefresh";
import { themeBorder, themeControl, themeSurface, themeText } from "../utils/themeStyles";

export default function Estimates() {
  const { blockId } = useParams();
  const { isDark } = useTheme();

  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputItemSearch, setInputItemSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [dictionaries, setDictionaries] = useState({});
  const [hideTitle, setHideTitle] = useState(false);

  const loadEstimate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postRequest("/materialEstimates/search", {
        block_id: Number(blockId),
        status: 1,
        page: 1,
        size: 1,
      });

      if (res.success) {
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
          "unitsOfMeasure",
          "currencies",
          "blockStages",
          "stageSubsections",
          "services",
        ])
      );
    };

    loadDicts();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setHideTitle(scrollTop > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const getDictName = useCallback(
    (dictName, id, field = "label") => dictionaries[dictName]?.find((item) => item.id === id)?.[field] || "",
    [dictionaries]
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
    (item) => (Number(item.quantity_planned) || 0) * (Number(item.price) || 0) * (Number(item.coefficient) || 1),
    []
  );

  const handleSearch = () => {
    setItemSearch(inputItemSearch);
  };

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
          materials: [],
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

  const pageClass = `space-y-4 pb-20 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const panelClass = `${themeSurface.panel(isDark)} p-3`;
  const itemCardClass = `${themeSurface.panelMuted(isDark)} rounded px-2 py-1.5 text-xs`;
  const stickyClass = themeSurface.sticky(isDark);

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
          <span className={`whitespace-nowrap font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
            {item.quantity_planned} {unitName}
          </span>
        </div>

        <div className="mt-[2px] flex items-center justify-between gap-3">
          <span className={`text-[10px] ${themeText.secondary(isDark)}`}>
            {item.price} {currencyCode}
            {coefficient > 1 && <> x {coefficient}</>}
            {currencyRate > 0 && item.currency !== 1 && <> | курс: {currencyRate}</>}
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
        className={`select-none transition-all duration-200 ${
          hideTitle ? "mb-0 max-h-0 overflow-hidden opacity-0" : "mb-4 max-h-12 opacity-100"
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
            <div className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Смета для блока не найдена.</div>
          </div>
        )}

        {!loading && estimate && (
          <div className={panelClass}>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{estimate.name}</span>
                <span className={`text-[11px] ${themeText.secondary(isDark)}`}>{formatDateTime(estimate.created_at)}</span>
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
    </div>
  );
}
