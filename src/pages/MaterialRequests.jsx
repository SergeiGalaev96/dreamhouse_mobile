import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardList, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { AuthContext } from "../auth/AuthContext";
import PullToRefresh from "../components/PullToRefresh";
import { getRequest, postRequest, putRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateReverse, formatDateTime } from "../utils/date";
import { numberHandler } from "../utils/numberInput";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";

const roles = {
  admin: { id: 1, label: "Админ" },
  foreman: { id: 4, label: "Прораб" },
  site_manager: { id: 9, label: "Нач. уч" },
  purchasing_agent: { id: 7, label: "Снабж" },
  planning_engineer: { id: 10, label: "ПТО" },
  main_engineer: { id: 11, label: "Гл. инж" }
};

const workflow = [
  "foreman",
  "site_manager",
  "purchasing_agent",
  "main_engineer",
  "planning_engineer"
];

const miStatusStyles = {
  1: "bg-gray-500/10 text-gray-400",
  2: "bg-yellow-500/10 text-yellow-400",
  3: "bg-blue-500/10 text-blue-400",
  4: "bg-green-500/10 text-green-400",
  5: "bg-red-500/10 text-red-400"
};

export default function MaterialRequests() {
  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const roleId = user?.role_id;

  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [tab, setTab] = useState("new");
  const [rates, setRates] = useState([]);
  const [hideTitle, setHideTitle] = useState(false);

  const role = Object.keys(roles).find((key) => roles[key].id === roleId);

  const pageClass = `space-y-4 ${themeText.page(isDark)}`;
  const inputClass = themeControl.input(isDark);
  const searchInputClass = isDark
    ? "h-[42px] w-full rounded-lg border border-gray-800 bg-gray-900 pl-9 pr-3 text-sm text-white focus:border-blue-500 focus:outline-none"
    : "h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-black focus:border-blue-500 focus:outline-none";
  const cardClass = `${themeSurface.panel(isDark)} p-3 transition hover:border-blue-500`;
  const pagerButtonClass = themeControl.subtleButton(isDark);
  const pagerTextClass = `text-sm ${themeText.secondary(isDark)}`;
  const stickyClass = themeSurface.sticky(isDark);
  const inactiveTabClass = isDark
    ? "bg-gray-800 text-white"
    : "border border-slate-300 bg-white text-black";

  const getApprovalField = (stage) => `approved_by_${stage}`;
  const getUserField = (stage) => `${stage}_user_id`;

  useEffect(() => {
    loadDicts();
    loadRates();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [page, search, tab]);

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

  const getStatusesByTab = () => {
    if (tab === "new") return [1];
    if (tab === "active") return [2, 3];
    return [4, 5];
  };

  const getDictName = (dictName, id, field = "label") =>
    dictionaries[dictName]?.find((item) => item.id === Number(id))?.[field] || "";

  const itemCardClass = (itemType) =>
    `${themeSurface.panelMuted(isDark)} rounded border p-2 text-xs ${itemType === 1
      ? "border-green-500/30"
      : itemType === 2
        ? "border-orange-500/30"
        : isDark
          ? "border-gray-700"
          : "border-slate-300"
    }`;

  const loadRequests = async () => {
    const res = await postRequest("/materialRequests/search", {
      project_id: Number(projectId),
      block_id: blockId ? Number(blockId) : null,
      item_statuses: getStatusesByTab(),
      search,
      page,
      size: 10
    });

    if (!res.success) return;

    const dicts = await loadDictionaries(["materialEstimates"]);
    const estimates = [...(dicts.materialEstimates || [])].sort((a, b) => a.block_id - b.block_id);
    const firstEstimateId = estimates[0]?.id || null;

    const prepared = res.data.map((request) => ({
      ...request,
      items: request.items.map((item) => {
        if (item.item_type !== 2) return item;

        return {
          ...item,
          currency: item.currency ?? 1,
          currency_rate: item.currency_rate ?? null,
          coefficient: item.coefficient ?? null,
          material_estimate_id: item.material_estimate_id ?? firstEstimateId
        };
      })
    }));

    setRequests(prepared);
    setPagination(res.pagination);
  };

  const updateItemField = (requestId, itemId, field, value) => {
    setRequests((prev) =>
      prev.map((request) => {
        if (request.id !== requestId) return request;
        return {
          ...request,
          items: request.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          )
        };
      })
    );
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "materials",
      "unitsOfMeasure",
      "currencies",
      "materialRequestStatuses",
      "materialRequestItemStatuses",
      "projectBlocks",
      "blockStages",
      "stageSubsections",
      "materialEstimates"
    ]);

    setDictionaries(dicts);
  };

  const loadRates = async () => {
    const res = await getRequest(`/currencyRates/getByDate/${formatDateReverse(new Date())}`);
    if (res.success) setRates(res.data);
  };

  const getRateByCurrency = (currencyId) => {
    const rate = rates.find((item) => item.currency_id === currencyId);
    return rate?.rate || "";
  };

  const checkToShowInputFields = (item, request) => {
    if (item.item_type !== 2 || item.status !== 1) return false;
    if (role === "planning_engineer" || role === "admin") {
      return request.approved_by_planning_engineer === null;
    }
    return false;
  };

  const canApprove = (stage, request) => {
    const approvedField = getApprovalField(stage);
    if (request[approvedField]) return false;
    if (role === "admin") return true;
    if (role !== stage) return false;
    return true;
  };

  const isLastApproval = (request, stage) =>
    workflow.every((current) => {
      if (current === stage) return true;
      return request[getApprovalField(current)];
    });

  const findEstimateByBlock = async () => {
    const estimate = dictionaries.materialEstimates?.find((item) => item.block_id === Number(blockId));
    return estimate?.id;
  };

  const approveRequest = async (requestId, stage) => {
    const request = requests.find((item) => item.id === requestId);
    const needCheck = stage === "planning_engineer" || stage === "admin";

    if (needCheck) {
      const invalid = request.items
        .filter((item) => item.item_type === 2 && item.status === 1)
        .some((item) => {
          if (!item.price) return true;
          if (!item.currency) return true;
          if ((item.currency ?? 1) !== 1 && !item.currency_rate) return true;
          return false;
        });

      if (invalid) {
        toast.error("Заполни все поля для доп. материалов");
        return;
      }
    }

    const isLast = isLastApproval(request, stage);

    if (isLast) {
      const materialEstimateId = await findEstimateByBlock();

      for (const item of request.items.filter((current) => current.item_type === 2)) {
        const createPayload = [
          {
            material_estimate_id: materialEstimateId,
            stage_id: item.stage_id,
            subsection_id: item.subsection_id,
            item_type: 1,
            entry_type: 2,
            material_type: item.material_type,
            material_id: item.material_id,
            unit_of_measure: item.unit_of_measure,
            quantity_planned: item.quantity,
            coefficient: item.coefficient,
            currency: item.currency,
            currency_rate: item.currency_rate,
            price: item.price,
            comment: item.comment || ""
          }
        ];

        const createRes = await postRequest("/materialEstimateItems/create", createPayload);

        if (!createRes.success) {
          toast.error("Ошибка создания элемента сметы");
          return;
        }

        const createdId = createRes.data?.[0]?.id;

        if (!createdId) {
          toast.error("Не удалось получить ID элемента сметы");
          return;
        }

        const updatePayload = {
          material_estimate_item_id: createdId,
          price: item.price,
          coefficient: item.coefficient,
          currency: item.currency,
          currency_rate: item.currency_rate
        };

        const updateRes = await putRequest(`/materialRequestItems/update/${item.id}`, updatePayload);

        if (!updateRes.success) {
          toast.error("Ошибка обновления элементов заявки");
          return;
        }
      }
    }

    const payload = {
      [getApprovalField(stage)]: true,
      [getUserField(stage)]: user.id
    };

    const res = await putRequest(`/materialRequests/update/${requestId}`, payload);

    if (res.success) {
      loadRequests();
      toast.success("Заявка подписана");
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  return (
    <div className={pageClass}>
      <div
        className={`select-none transition-all duration-200 ${hideTitle ? "mb-0 max-h-0 overflow-hidden opacity-0" : "mb-4 max-h-12 opacity-100"
          }`}
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">
            Заявки: {getDictName("projectBlocks", blockId)}
          </h1>
        </div>
      </div>

      <div
        className={stickyClass}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTab("new");
              setPage(1);
            }}
            className={`flex-1 rounded py-2 ${tab === "new" ? "bg-blue-600 text-white" : inactiveTabClass
              }`}
          >
            Новые
          </button>
          <button
            onClick={() => {
              setTab("active");
              setPage(1);
            }}
            className={`flex-1 rounded py-2 ${tab === "active" ? "bg-blue-600 text-white" : inactiveTabClass
              }`}
          >
            Одобрено
          </button>
          <button
            onClick={() => {
              setTab("done");
              setPage(1);
            }}
            className={`flex-1 rounded py-2 ${tab === "done" ? "bg-blue-600 text-white" : inactiveTabClass
              }`}
          >
            Завершенные
          </button>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto] items-stretch gap-2">
          <div className="relative min-w-0">
            <Search size={16} className={`absolute left-3 top-3 ${themeText.secondary(isDark)}`} />
            <input
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Поиск..."
              className={searchInputClass}
            />
          </div>

          <button
            onClick={handleSearch}
            className="h-[42px] rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500"
          >
            Go
          </button>
        </div>

      </div>

      <PullToRefresh className="mt-3" contentClassName="space-y-1.5" onRefresh={loadRequests}>
        {requests.map((request) => {
          const expanded = expandedId === request.id;

          return (
            <div key={request.id} className={cardClass}>
              <div
                onClick={() => setExpandedId(expanded ? null : request.id)}
                className="cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">№ {request.id}</span>
                  <span className={`text-[11px] ${themeText.secondary(isDark)}`}>
                    {formatDateTime(request.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-yellow-400">
                    {getDictName("materialRequestStatuses", request.status)}
                  </span>
                  <span className={themeText.secondary(isDark)}>
                    Позиций: {request.items?.length || 0}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {workflow.map((stage) => {
                    const approved = request[getApprovalField(stage)];

                    return (
                      <div key={stage} className="flex items-center gap-1">
                        <div
                          className={`h-3 w-3 rounded-full ${approved ? "bg-green-500" : isDark ? "bg-gray-600" : "bg-slate-300"
                            }`}
                        />
                        <span className={themeText.secondary(isDark)}>{roles[stage].label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="mt-1 flex flex-wrap gap-1"
                onClick={() => setExpandedId(expanded ? null : request.id)}
              >
                {workflow.map((stage) => {
                  if (!canApprove(stage, request)) return null;

                  return (
                    <button
                      key={stage}
                      onClick={(e) => {
                        e.stopPropagation();
                        approveRequest(request.id, stage);
                      }}
                      className="rounded bg-blue-600 px-2 py-[3px] text-[11px] text-white hover:bg-blue-500"
                    >
                      {roles[stage].label}
                    </button>
                  );
                })}
              </div>

              <div
                className={`overflow-hidden transition-all duration-300 ${expanded ? "mt-2 max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                  }`}
              >
                <div className={`space-y-2 border-t pt-2 ${isDark ? "border-gray-800" : "border-slate-200"}`}>
                  {request.items?.map((item) => (
                    <div key={item.id} className={itemCardClass(item.item_type)}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`truncate text-sm font-semibold ${themeText.primary(isDark)}`}>
                          {getDictName("materials", item.material_id)}
                        </span>

                        <span className={`whitespace-nowrap text-xs ${themeText.secondary(isDark)}`}>
                          {item.quantity}{" "}
                          <span className={`text-[10px] ${themeText.muted(isDark)}`}>
                            {getDictName("unitsOfMeasure", item.unit_of_measure)}
                          </span>
                        </span>
                      </div>

                      <div className="mt-[2px] flex items-center justify-between gap-2">
                        <span className={`truncate text-[10px] ${themeText.secondary(isDark)}`}>
                          {getDictName("blockStages", item.stage_id)}
                          {item.subsection_id && (
                            <> {"->"} {getDictName("stageSubsections", item.subsection_id)}</>
                          )}
                        </span>

                        <span
                          className={`whitespace-nowrap rounded px-2 py-[2px] text-[10px] ${miStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"
                            }`}
                        >
                          {getDictName("materialRequestItemStatuses", item.status)}
                        </span>
                      </div>

                      {item.comment && (
                        <div className={`mt-[2px] text-[10px] ${themeText.muted(isDark)}`}>
                          {item.comment}
                        </div>
                      )}

                      {checkToShowInputFields(item, request) && (
                        <div className="mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Цена"
                              value={item.price || ""}
                              onChange={numberHandler((value) =>
                                updateItemField(request.id, item.id, "price", value)
                              )}
                              className={themeControl.modalInput(isDark)}
                            />

                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Коэффициент"
                              value={
                                item.coefficient ??
                                dictionaries.materials?.find((material) => material.id === item.material_id)
                                  ?.coefficient ??
                                ""
                              }
                              onChange={numberHandler((value) =>
                                updateItemField(request.id, item.id, "coefficient", value)
                              )}
                              className={themeControl.modalInput(isDark)}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={item.currency ?? 1}
                              onChange={(e) => {
                                const currency = Number(e.target.value);
                                const rate = currency === 1 ? 1 : getRateByCurrency(currency);
                                updateItemField(request.id, item.id, "currency", currency);
                                updateItemField(request.id, item.id, "currency_rate", rate);
                              }}
                              className={themeControl.modalInput(isDark)}
                            >
                              {dictionaries.currencies?.map((currency) => (
                                <option key={currency.id} value={currency.id}>
                                  {currency.code}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Курс"
                              value={(item.currency ?? 1) === 1 ? 1 : item.currency_rate || ""}
                              onChange={(e) =>
                                updateItemField(
                                  request.id,
                                  item.id,
                                  "currency_rate",
                                  Number(e.target.value)
                                )
                              }
                              disabled={(item.currency ?? 1) === 1}
                              className={
                                (item.currency ?? 1) === 1
                                  ? `${themeSurface.panelMuted(isDark)} ${themeText.muted(
                                    isDark
                                  )} rounded border ${isDark ? "border-gray-800" : "border-slate-300"
                                  } px-3 py-2 text-sm`
                                  : themeControl.modalInput(isDark)
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </PullToRefresh>

      {pagination && (
        <div className="mt-6 flex justify-center gap-3">
          <button
            disabled={!pagination.hasPrev}
            onClick={() => setPage(page - 1)}
            className={pagerButtonClass}
          >
            Назад
          </button>

          <span className={pagerTextClass}>
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

      <button
        onClick={() => navigate(`/projects/${projectId}/blocks/${blockId}/material-request-create`)}
        className="fixed bottom-20 right-8 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-xl transition hover:scale-105 hover:bg-green-500"
      >
        <Plus size={28} className="text-white" />
      </button>
    </div>
  );
}
