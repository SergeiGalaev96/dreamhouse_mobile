import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Search, FileSignature, PackageMinus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { postRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDate, formatDateTime } from "../utils/date";
import PullToRefresh from "../components/PullToRefresh";
import { themeBorder, themeControl, themeSurface, themeText } from "../utils/themeStyles";
import { useTheme } from "../context/ThemeContext";
import { AuthContext } from "../auth/AuthContext";

const PAGE_SIZE = 10;
const EMPTY_PAGINATION = {
  page: 1,
  size: PAGE_SIZE,
  total: 0,
  pages: 1,
  hasNext: false,
  hasPrev: false,
};

const SIGN_STAGES = [
  { key: "foreman", label: "Прораб", field: "signed_by_foreman" },
  { key: "planning_engineer", label: "ПТО", field: "signed_by_planning_engineer" },
  { key: "main_engineer", label: "Гл. инж", field: "signed_by_main_engineer" },
  { key: "general_director", label: "Ген. дир", field: "signed_by_general_director" },
];

const STATUS_STYLES = {
  1: {
    light: "bg-slate-100 text-slate-700",
    dark: "bg-gray-700 text-gray-200",
  },
  2: {
    light: "bg-yellow-100 text-yellow-700",
    dark: "bg-yellow-500/10 text-yellow-400",
  },
  3: {
    light: "bg-green-100 text-green-700",
    dark: "bg-green-500/10 text-green-400",
  },
  4: {
    light: "bg-red-100 text-red-700",
    dark: "bg-red-500/10 text-red-400",
  },
};

const emptyAvrForm = {
  workPerformedId: "",
  workPerformedItemId: "",
  note: "",
};

const emptyMbpForm = {
  note: "",
};

export default function MaterialWriteOffs() {
  const { projectId, warehouseId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState("avr");
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inputSearch, setInputSearch] = useState("");
  const [search, setSearch] = useState("");
  const [dictionaries, setDictionaries] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [avrForm, setAvrForm] = useState(emptyAvrForm);
  const [mbpForm, setMbpForm] = useState(emptyMbpForm);
  const [workPerformedList, setWorkPerformedList] = useState([]);
  const [workPerformedItems, setWorkPerformedItems] = useState([]);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [materialQuantities, setMaterialQuantities] = useState({});
  const [materialInputSearch, setMaterialInputSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const loadRequestRef = useRef(0);

  const pageClass = `space-y-4 pb-24 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const modalInputClass = themeControl.modalInput(isDark);
  const panelClass = `${themeSurface.panel(isDark)} px-3 py-2`;
  const cardClass = `${themeSurface.panel(isDark)} p-3 transition hover:border-blue-500`;
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const mutedTextClass = themeText.secondary(isDark);
  const sectionTitleClass = `text-[10px] font-semibold uppercase tracking-wide ${themeText.secondary(isDark)}`;

  const loadDictionariesData = useCallback(async () => {
    setDictionaries(
      await loadDictionaries([
        "userRoles",
        "materials",
        "unitsOfMeasure",
        "projects",
        "projectBlocks",
        "warehouses",
        "blockStages",
        "stageSubsections",
        "services",
        "materialWriteOffStatuses",
      ])
    );
  }, []);

  useEffect(() => {
    loadDictionariesData();
  }, [loadDictionariesData]);

  const getUnitLabel = useCallback(
    (id) => (dictionaries.unitsOfMeasure || []).find((item) => item.id === Number(id))?.label || "",
    [dictionaries.unitsOfMeasure]
  );

  const getWorkItemLabel = useCallback(
    (item) => {
      console.log("IT", item)
      const serviceName =
        (dictionaries.services || []).find((service) => service.id === Number(item?.service_id))?.label ||
        `Работа #${item?.id}`;
      const stageName =
        (dictionaries.blockStages || []).find((stage) => stage.id === Number(item?.stage_id))?.label || "";
      const subsectionName =
        (dictionaries.stageSubsections || []).find((subsection) => subsection.id === Number(item?.subsection_id))?.label || "";

      const routePart = [stageName, subsectionName].filter(Boolean).join(" / ");
      return routePart ? `${serviceName} | ${routePart}` : serviceName;
    },
    [dictionaries.blockStages, dictionaries.services, dictionaries.stageSubsections]
  );

  const getBlockLabel = useCallback(
    (blockId) => (dictionaries.projectBlocks || []).find((block) => block.id === Number(blockId))?.label || "",
    [dictionaries.projectBlocks]
  );

  const currentRoleLabel = useMemo(
    () => (dictionaries.userRoles || []).find((item) => item.id === Number(user?.role_id))?.label?.toLowerCase() || "",
    [dictionaries.userRoles, user?.role_id]
  );

  const canSignStage = useCallback(
    (stage) => {
      if (Number(user?.role_id) === 1) return true;
      if (stage.key === "foreman") return currentRoleLabel.includes("прораб");
      if (stage.key === "planning_engineer") return currentRoleLabel.includes("пто") || currentRoleLabel.includes("инженер пто");
      if (stage.key === "main_engineer") return currentRoleLabel.includes("глав");
      if (stage.key === "general_director") return currentRoleLabel.includes("ген");
      return false;
    },
    [currentRoleLabel, user?.role_id]
  );

  const getStatusLabel = useCallback(
    (status) => {
      const dictLabel = (dictionaries.materialWriteOffStatuses || []).find((item) => item.id === Number(status))?.label;
      if (dictLabel) return dictLabel;
      if (status === 1) return "Создан";
      if (status === 2) return "На подписании";
      if (status === 3) return "Проведен";
      if (status === 4) return "Отменен";
      return `Статус ${status}`;
    },
    [dictionaries.materialWriteOffStatuses]
  );

  const loadAvrWriteOffs = useCallback(async (requestId) => {
    const res = await postRequest("/materialWriteOffs/search", {
      project_id: Number(projectId),
      warehouse_id: Number(warehouseId),
      page,
      size: PAGE_SIZE,
    });

    if (!res.success) {
      if (loadRequestRef.current !== requestId) return;
      setItems([]);
      setPagination(EMPTY_PAGINATION);
      return;
    }

    const query = search.trim().toLowerCase();
    const filtered = query
      ? (res.data || []).filter((item) => {
        const workCode = String(item.work_performed?.code || "").toLowerCase();
        const workName = String(getWorkItemLabel(item.work_performed_item || {})).toLowerCase();
        return workCode.includes(query) || workName.includes(query);
      })
      : res.data || [];

    if (loadRequestRef.current !== requestId) return;
    setItems(filtered);
    setPagination(res.pagination);
  }, [getWorkItemLabel, page, projectId, search, warehouseId]);

  const loadMbpWriteOffs = useCallback(async (requestId) => {
    const res = await postRequest("/mbpWriteOffs/search", {
      project_id: Number(projectId),
      warehouse_id: Number(warehouseId),
      page,
      size: PAGE_SIZE,
    });

    if (!res.success) {
      if (loadRequestRef.current !== requestId) return;
      setItems([]);
      setPagination(EMPTY_PAGINATION);
      return;
    }

    const query = search.trim().toLowerCase();
    const filtered = query
      ? (res.data || []).filter((item) => {
        const note = String(item.note || "").toLowerCase();
        const materialNames = (item.items || [])
          .map((detail) => detail.material?.name || "")
          .join(" ")
          .toLowerCase();
        return note.includes(query) || materialNames.includes(query) || String(item.id).includes(query);
      })
      : res.data || [];

    if (loadRequestRef.current !== requestId) return;
    setItems(filtered);
    setPagination(res.pagination);
  }, [page, projectId, search, warehouseId]);

  const loadProcessingWriteOffs = useCallback(async (requestId) => {
    const res = await postRequest("/materialProcessingWriteOffs/search", {
      project_id: Number(projectId),
      warehouse_id: Number(warehouseId),
      page,
      size: PAGE_SIZE,
    });

    if (!res.success) {
      if (loadRequestRef.current !== requestId) return;
      setItems([]);
      setPagination(EMPTY_PAGINATION);
      return;
    }

    const query = search.trim().toLowerCase();
    const filtered = query
      ? (res.data || []).filter((item) => {
        const note = String(item.note || "").toLowerCase();
        const materialNames = (item.items || [])
          .map((detail) => detail.material?.name || "")
          .join(" ")
          .toLowerCase();
        return note.includes(query) || materialNames.includes(query) || String(item.id).includes(query);
      })
      : res.data || [];

    if (loadRequestRef.current !== requestId) return;
    setItems(filtered);
    setPagination(res.pagination);
  }, [page, projectId, search, warehouseId]);

  const loadItems = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);
    try {
      if (activeTab === "avr") {
        await loadAvrWriteOffs(requestId);
      } else if (activeTab === "processing") {
        await loadProcessingWriteOffs(requestId);
      } else {
        await loadMbpWriteOffs(requestId);
      }
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [activeTab, loadAvrWriteOffs, loadMbpWriteOffs, loadProcessingWriteOffs]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    const warehousePath = `/projects/${projectId}/warehouses/${warehouseId}/warehouse-stocks`;

    if (typeof window === "undefined") return undefined;

    window.history.pushState({ writeOffBackGuard: true }, "", window.location.href);

    const handlePopState = () => {
      navigate(warehousePath, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate, projectId, warehouseId]);

  useEffect(() => {
    setItems([]);
    setPagination(EMPTY_PAGINATION);
    setPage(1);
    setExpandedId(null);
  }, [activeTab]);

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  const loadAvailableMaterials = useCallback(async () => {
    const res = await postRequest("/warehouseStocks/search", {
      warehouse_id: Number(warehouseId),
      page: 1,
      size: 200,
    });

    if (res.success) {
      setAvailableMaterials((res.data || []).filter((stock) => Number(stock.quantity) > 0));
    }
  }, [warehouseId]);

  const openCreateModal = async () => {
    setMaterialQuantities({});
    setAvailableMaterials([]);
    setMaterialInputSearch("");
    setMaterialSearch("");
    setWorkPerformedList([]);
    setWorkPerformedItems([]);

    if (activeTab === "avr") {
      setAvrForm({
        ...emptyAvrForm,
      });

      const res = await postRequest("/workPerformed/search", {
        project_id: Number(projectId),
        page: 1,
        size: 100,
      });

      if (res.success) {
        setWorkPerformedList(res.data || []);
      }
    } else {
      setMbpForm({
        ...emptyMbpForm,
      });
    }

    await loadAvailableMaterials();
    setShowCreate(true);
  };

  const handleChangeWorkPerformed = async (value) => {
    setAvrForm((prev) => ({
      ...prev,
      workPerformedId: value,
      workPerformedItemId: "",
    }));
    setWorkPerformedItems([]);

    if (!value) return;

    const res = await postRequest("/workPerformedItems/search", {
      work_performed_id: Number(value),
      page: 1,
      size: 100,
    });

    if (res.success) {
      setWorkPerformedItems(res.data || []);
    }
  };

  const selectedWorkPerformedItem = useMemo(
    () => workPerformedItems.find((item) => item.id === Number(avrForm.workPerformedItemId)),
    [avrForm.workPerformedItemId, workPerformedItems]
  );

  const selectedWorkPerformed = useMemo(
    () => workPerformedList.find((item) => item.id === Number(avrForm.workPerformedId)),
    [avrForm.workPerformedId, workPerformedList]
  );

  const createPayloadItems = useMemo(
    () =>
      availableMaterials
        .map((stock) => {
          const quantity = Number(materialQuantities[stock.material_id] || 0);
          if (!quantity || quantity <= 0) return null;

          return {
            material_id: Number(stock.material_id),
            unit_of_measure: Number(stock.unit_of_measure),
            quantity,
          };
        })
        .filter(Boolean),
    [availableMaterials, materialQuantities]
  );

  const filteredAvailableMaterials = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    if (!query) return availableMaterials;

    return availableMaterials.filter((stock) => {
      const materialName = String(stock.material?.name || "").toLowerCase();
      const unitName = String(getUnitLabel(stock.unit_of_measure) || "").toLowerCase();
      return materialName.includes(query) || unitName.includes(query);
    });
  }, [availableMaterials, getUnitLabel, materialSearch]);

  const handleMaterialSearch = () => {
    setMaterialSearch(materialInputSearch);
  };

  const handleChangeTab = (tab) => {
    loadRequestRef.current += 1;
    setItems([]);
    setPagination(EMPTY_PAGINATION);
    setExpandedId(null);
    setPage(1);
    setActiveTab(tab);
  };

  const handleCreateAvr = async () => {
    if (!avrForm.workPerformedId) return toast.error("Выберите АВР");
    if (!avrForm.workPerformedItemId) return toast.error("Выберите работу АВР");
    if (!createPayloadItems.length) return toast.error("Укажите хотя бы один материал");

    setCreating(true);
    try {
      const res = await postRequest("/materialWriteOffs/create", {
        warehouse_id: Number(warehouseId),
        work_performed_item_id: Number(avrForm.workPerformedItemId),
        note: avrForm.note,
        items: createPayloadItems,
      });

      if (!res.success) {
        throw new Error(res.message || "Ошибка создания акта списания");
      }

      toast.success("Акт списания создан");
      setShowCreate(false);
      await loadItems();
    } catch (error) {
      toast.error(error.message || "Ошибка создания акта списания");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateMbp = async () => {
    if (!createPayloadItems.length) return toast.error("Укажите хотя бы один материал");

    setCreating(true);
    try {
      const res = await postRequest("/mbpWriteOffs/create", {
        warehouse_id: Number(warehouseId),
        note: mbpForm.note,
        items: createPayloadItems,
      });

      if (!res.success) {
        throw new Error(res.message || "Ошибка создания списания МБП");
      }

      toast.success("Списание МБП создано");
      setShowCreate(false);
      await loadItems();
    } catch (error) {
      toast.error(error.message || "Ошибка создания списания МБП");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateProcessing = async () => {
    if (!createPayloadItems.length) return toast.error("Укажите хотя бы один материал");

    setCreating(true);
    try {
      const res = await postRequest("/materialProcessingWriteOffs/create", {
        warehouse_id: Number(warehouseId),
        note: mbpForm.note,
        items: createPayloadItems,
      });

      if (!res.success) {
        throw new Error(res.message || "Ошибка создания акта переработки");
      }

      toast.success("Акт переработки создан");
      setShowCreate(false);
      await loadItems();
    } catch (error) {
      toast.error(error.message || "Ошибка создания акта переработки");
    } finally {
      setCreating(false);
    }
  };

  const handleSign = async (item, stageKey) => {
    const endpoint =
      activeTab === "avr"
        ? "/materialWriteOffs/sign/"
        : activeTab === "processing"
          ? "/materialProcessingWriteOffs/sign/"
          : "/mbpWriteOffs/sign/";
    const res = await postRequest(`${endpoint}${item.id}`, { stage: stageKey });

    if (res.success) {
      toast.success(res.message || "Подпись сохранена");
      await loadItems();
      return;
    }

    toast.error(res.message || "Ошибка подписи");
  };

  const renderStatus = (status) => (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${(STATUS_STYLES[status] || STATUS_STYLES[1])[isDark ? "dark" : "light"]
        }`}
    >
      {getStatusLabel(status)}
    </span>
  );

  const renderStatusWithPostedAt = (item) => (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {renderStatus(item.status)}
      {item.posted_at && (
        <div className={`text-[10px] leading-none ${mutedTextClass}`}>
          {formatDateTime(item.posted_at)}
        </div>
      )}
    </div>
  );

  const renderSignDots = (item) => (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
      {SIGN_STAGES.map((stage) => {
        const signed = item[stage.field];
        return (
          <div key={stage.key} className="flex items-center gap-1">
            <div className={`h-3 w-3 rounded-full ${signed ? "bg-green-500" : isDark ? "bg-gray-600" : "bg-slate-300"}`} />
            <span className={mutedTextClass}>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );

  const renderSignButtons = (item) => (
    <div className="mt-1 flex flex-wrap gap-1">
      {SIGN_STAGES.map((stage) => {
        const signed = item[stage.field];
        const canSign = canSignStage(stage) && item.status !== 3 && item.status !== 4 && !signed;
        if (!canSign) return null;

        return (
          <button
            key={stage.key}
            onClick={(e) => {
              e.stopPropagation();
              handleSign(item, stage.key);
            }}
            className="rounded bg-blue-600 px-2 py-[3px] text-[11px] text-white hover:bg-blue-500"
          >
            {stage.label}
          </button>
        );
      })}
    </div>
  );

  const renderAvrCard = (item) => {
    const expanded = expandedId === item.id;
    const detailItems = item.items || [];

    return (
      <div key={`avr-${item.id}`} className={cardClass} onClick={() => handleToggleExpand(item.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {!!item.block_id && (
              <div className={`mb-0.5 text-[13px] font-semibold ${isDark ? "text-sky-300" : "text-blue-700"}`}>
                {getBlockLabel(item.block_id) || item.block_id}
              </div>
            )}
            <div className={`break-words pr-2 text-[12px] font-medium leading-snug ${themeText.primary(isDark)}`}>
              {getWorkItemLabel(item.work_performed_item || {})}
            </div>
            <span className={`text-[11px] ${mutedTextClass}`}>
              АВР: №{item.work_performed_id || item.work_performed?.id || "-"} | Объем: {item.work_performed_item?.quantity || "-"}
            </span>
          </div>

          {renderStatusWithPostedAt(item)}
        </div>

        {renderSignDots(item)}
        {renderSignButtons(item)}

        <div
          className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-2 max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            }`}
        >
          <div className={`space-y-2 border-t pt-2 ${themeBorder.divider(isDark)}`}>
            <div className={sectionTitleClass}>Материалы</div>
            {detailItems.map((detailItem) => (
              <div key={detailItem.id} className={`${themeSurface.panelMuted(isDark)} rounded px-2 py-1.5 text-[11px]`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{detailItem.material?.name || "Материал"}</span>
                  <span className="whitespace-nowrap font-medium">
                    {detailItem.quantity} {getUnitLabel(detailItem.unit_of_measure)}
                  </span>
                </div>
                {detailItem.note && (
                  <div className={`mt-1 font-medium ${isDark ? "text-sky-300" : "text-blue-700"}`}>{detailItem.note}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMbpCard = (item) => {
    const expanded = expandedId === item.id;
    const detailItems = item.items || [];
    const materialCount = detailItems.length;
    const isProcessing = activeTab === "processing";

    return (
      <div key={`${isProcessing ? "processing" : "mbp"}-${item.id}`} className={cardClass} onClick={() => handleToggleExpand(item.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={`break-words pr-2 text-[12px] font-medium leading-snug ${themeText.primary(isDark)}`}>
              {isProcessing ? "Акт переработки" : "МБП списание"} №{item.id}
            </div>
            <span className={`text-[11px] ${mutedTextClass}`}>
              Материалов: {materialCount}
            </span>
            {!!item.note && <div className={`mt-1 text-[11px] ${mutedTextClass}`}>{item.note}</div>}
          </div>

          {renderStatusWithPostedAt(item)}
        </div>

        {renderSignDots(item)}
        {renderSignButtons(item)}

        <div
          className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-2 max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            }`}
        >
          <div className={`space-y-2 border-t pt-2 ${themeBorder.divider(isDark)}`}>
            <div className={sectionTitleClass}>Материалы</div>
            {detailItems.map((detailItem) => (
              <div key={detailItem.id} className={`${themeSurface.panelMuted(isDark)} rounded px-2 py-1.5 text-[11px]`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{detailItem.material?.name || "Материал"}</span>
                  <span className="whitespace-nowrap font-medium">
                    {detailItem.quantity} {getUnitLabel(detailItem.unit_of_measure)}
                  </span>
                </div>
                {detailItem.note && (
                  <div className={`mt-1 font-medium ${isDark ? "text-sky-300" : "text-blue-700"}`}>{detailItem.note}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={pageClass}>
      <div className="flex items-center gap-2">
        <PackageMinus size={20} className="text-red-400" />
        <h1 className="text-lg font-semibold">
          Списания: {(dictionaries.warehouses || []).find((item) => item.id === Number(warehouseId))?.label || ""}
        </h1>
      </div>

      <div className={`${themeSurface.sticky(isDark)} sticky z-20 space-y-2 rounded-xl p-2`} style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleChangeTab("avr")}
            className={activeTab === "avr" ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" : pagerButtonClass}
          >
            АВР
          </button>
          <button
            onClick={() => handleChangeTab("mbp")}
            className={activeTab === "mbp" ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" : pagerButtonClass}
          >
            МБП
          </button>
          <button
            onClick={() => handleChangeTab("processing")}
            className={activeTab === "processing" ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" : pagerButtonClass}
          >
            Переработка
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${mutedTextClass}`} />
            <input
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                activeTab === "avr"
                  ? "Поиск по АВР и работе..."
                  : activeTab === "processing"
                    ? "Поиск по переработке и материалам..."
                    : "Поиск по МБП и материалам..."
              }
              className={inputClass}
            />
          </div>

          <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 text-sm text-white">
            Go
          </button>
        </div>
      </div>

      <PullToRefresh className="space-y-2" onRefresh={loadItems} disabled={loading}>
        {items.map((item) => (activeTab === "avr" ? renderAvrCard(item) : renderMbpCard(item)))}

        {!loading && items.length === 0 && (
          <div className={panelClass}>
            <div className={`text-sm ${mutedTextClass}`}>
              {activeTab === "avr"
                ? "Акты списания не найдены."
                : activeTab === "processing"
                  ? "Акты переработки не найдены."
                  : "Списания МБП не найдены."}
            </div>
          </div>
        )}
      </PullToRefresh>

      <div className="mt-4 flex justify-center gap-3">
        <button disabled={!pagination?.hasPrev} onClick={() => setPage((prev) => prev - 1)} className={pagerButtonClass}>
          Назад
        </button>
        <span className={`text-sm ${mutedTextClass}`}>{pagination?.page || page} / {pagination?.pages || 1}</span>
        <button disabled={!pagination?.hasNext} onClick={() => setPage((prev) => prev + 1)} className={pagerButtonClass}>
          Далее
        </button>
      </div>

      <button
        onClick={openCreateModal}
        className="fixed bottom-20 right-8 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-xl transition hover:scale-105 hover:bg-red-500"
      >
        <Minus size={28} className="text-white" />
      </button>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60">
          <div className={`${themeSurface.page(isDark)} max-h-[92vh] w-full overflow-y-auto rounded-t-2xl px-4 pb-6 pt-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature size={18} className="text-red-400" />
                <div className="text-base font-semibold">
                  {activeTab === "avr"
                    ? "Новый акт списания"
                    : activeTab === "processing"
                      ? "Новый акт переработки"
                      : "Новое списание МБП"}
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} className={pagerButtonClass}>
                Закрыть
              </button>
            </div>

            <div className="space-y-3">
              {activeTab === "avr" && (
                <>
                  <div>
                    <div className={`mb-1 text-xs ${mutedTextClass}`}>АВР</div>
                    <select value={avrForm.workPerformedId} onChange={(e) => handleChangeWorkPerformed(e.target.value)} className={modalInputClass}>
                      <option value="">Выберите АВР</option>
                      {workPerformedList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {(item.code || `АВР #${item.id}`) + (item.performed_person_name ? ` - ${item.performed_person_name}` : "")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className={`mb-1 text-xs ${mutedTextClass}`}>Работа АВР</div>
                    <select
                      value={avrForm.workPerformedItemId}
                      onChange={(e) => setAvrForm((prev) => ({ ...prev, workPerformedItemId: e.target.value }))}
                      className={modalInputClass}
                    >
                      <option value="">Выберите работу</option>
                      {workPerformedItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {getWorkItemLabel(item)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedWorkPerformedItem && (
                    <div className={`${themeSurface.panelMuted(isDark)} rounded px-3 py-2 text-xs`}>
                      <div className="font-semibold">{getWorkItemLabel(selectedWorkPerformedItem)}</div>
                      <div className={`mt-1 font-medium ${isDark ? "text-sky-300" : "text-blue-700"}`}>
                        {getBlockLabel(selectedWorkPerformed?.block_id) || "-"}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <div className={`mb-1 text-xs ${mutedTextClass}`}>Комментарий</div>
                <textarea
                  value={activeTab === "avr" ? avrForm.note : mbpForm.note}
                  onChange={(e) =>
                    activeTab === "avr"
                      ? setAvrForm((prev) => ({ ...prev, note: e.target.value }))
                      : setMbpForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                  className={modalInputClass}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Материалы склада</div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className={`absolute left-3 top-3 ${mutedTextClass}`} />
                    <input
                      value={materialInputSearch}
                      onChange={(e) => setMaterialInputSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMaterialSearch();
                      }}
                      placeholder="Поиск материалов..."
                      className={`${modalInputClass} pl-9`}
                    />
                  </div>
                  <button
                    onClick={handleMaterialSearch}
                    className="rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
                  >
                    Go
                  </button>
                </div>

                {filteredAvailableMaterials.length === 0 && (
                  <div className={`rounded-lg px-3 py-4 text-center text-sm ${themeSurface.panelMuted(isDark)} ${mutedTextClass}`}>
                    Материалы не найдены
                  </div>
                )}

                {filteredAvailableMaterials.map((stock) => (
                  <div key={stock.id} className={`${themeSurface.panelMuted(isDark)} rounded px-3 py-2`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{stock.material?.name || "Материал"}</div>
                        <div className={`text-[11px] ${mutedTextClass}`}>
                          Остаток: {stock.quantity} {getUnitLabel(stock.unit_of_measure)}
                        </div>
                      </div>

                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={materialQuantities[stock.material_id] || ""}
                        onChange={(e) =>
                          setMaterialQuantities((prev) => ({
                            ...prev,
                            [stock.material_id]: e.target.value,
                          }))
                        }
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-black"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={
                  activeTab === "avr"
                    ? handleCreateAvr
                    : activeTab === "processing"
                      ? handleCreateProcessing
                      : handleCreateMbp
                }
                disabled={creating}
                className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {creating
                  ? "Сохранение..."
                  : activeTab === "avr"
                    ? "Создать акт списания"
                    : activeTab === "processing"
                      ? "Создать акт переработки"
                      : "Создать списание МБП"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
