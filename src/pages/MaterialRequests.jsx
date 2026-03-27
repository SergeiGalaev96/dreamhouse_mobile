import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRequest, postRequest, putRequest } from "../api/request";
import { formatDateTime, formatDateReverse } from "../utils/date";
import { numberHandler } from "../utils/numberInput";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { AuthContext } from "../auth/AuthContext";

import { Search, ClipboardList, Plus } from "lucide-react";
import toast from "react-hot-toast";

export default function MaterialRequests() {

  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

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

  useEffect(() => {
    loadDicts();
    loadRates();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [page, search, tab]);

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

    // 🔥 грузим сметы
    const dicts = await loadDictionaries(["materialEstimates"]);

    const estimates = [...(dicts.materialEstimates || [])]
      .sort((a, b) => a.block_id - b.block_id);

    const firstEstimateId = estimates[0]?.id || null;

    // 🔥 init сразу при установке
    const prepared = res.data.map(r => ({
      ...r,
      items: r.items.map(item => {

        if (item.item_type !== 2) return item;

        return {
          ...item,
          currency: item.currency ?? 1,
          currency_rate: item.currency_rate ?? null,
          coefficient: item.coefficient ?? null,
          material_estimate_id:
            item.material_estimate_id ?? firstEstimateId
        };

      })
    }));

    setRequests(prepared);
    setPagination(res.pagination);

  };

  const initItem = (item, firstEstimateId) => {

    if (item.item_type !== 2) return item;

    return {
      ...item,
      currency: item.currency ?? 1,
      currency_rate: item.currency_rate ?? null,
      coefficient: item.coefficient ?? null,
      material_estimate_id:
        item.material_estimate_id ?? firstEstimateId ?? null
    };

  };

  const updateItemField = (requestId, itemId, field, value) => {

    setRequests(prev =>
      prev.map(r => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          items: r.items.map(item => {

            if (item.id !== itemId) return item;

            return {
              ...item,
              [field]: value
            };

          })
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
  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };

  const currencyOptions = dictionaries.currencies?.map(c => ({
    value: c.id,
    label: c.code
  }));

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

  /* роли */
  const roles = {
    admin: { id: 1, label: "Админ" },
    foreman: { id: 4, label: "Прораб" },
    site_manager: { id: 9, label: "Нач. уч" },
    purchasing_agent: { id: 7, label: "Снабж" },
    planning_engineer: { id: 10, label: "ПТО" },
    main_engineer: { id: 11, label: "Гл. инж" }
  };

  const role = Object.keys(roles).find(
    key => roles[key].id === roleId
  );

  const checkToShowInputFields = (item, r) => {
    if (item.item_type === 2 && item.status === 1) {

      if (role === "planning_engineer" || role === "admin") {
        // console.log("IT", item, r)
        if (r.approved_by_planning_engineer === null) {
          return true
        }
      }
    }
  }

  /* workflow */
  const workflow = [
    "foreman",
    "site_manager",
    "purchasing_agent",
    "main_engineer",
    "planning_engineer"
  ];

  const getApprovalField = (stage) => `approved_by_${stage}`;
  const getUserField = (stage) => `${stage}_user_id`;

  /* проверка возможности подписи */

  const canApprove = (stage, request) => {

    const approvedField = getApprovalField(stage);

    // уже подписано
    if (request[approvedField]) return false;

    // админ может всё
    if (role === "admin") return true;

    // только своя роль
    if (role !== stage) return false;

    return true;
  };

  const isLastApproval = (request, stage) => {
    return workflow.every(s => {
      if (s === stage) return true; // текущий сейчас подпишет
      return request[getApprovalField(s)];
    });

  }

  const approveRequest = async (requestId, stage) => {

    const request = requests.find(r => r.id === requestId);

    const needCheck =
      stage === "planning_engineer" ||
      stage === "admin";

    /* ---------------- VALIDATION ---------------- */

    if (needCheck) {
      const invalid = request.items
        .filter(i => i.item_type === 2 && i.status === 1)
        .some(i => {

          if (!i.price) return true;
          if (!i.currency) return true;
          if ((i.currency ?? 1) !== 1 && !i.currency_rate) return true;

          return false;
        });

      if (invalid) {
        toast.error("Заполни все поля для доп материалов");
        return;
      }
    }

    /* ---------------- ПРОВЕРКА: ПОСЛЕДНИЙ ЭТАП ---------------- */

    const isLast = isLastApproval(request, stage);

    /* ---------------- CREATE ESTIMATE ITEMS (ТОЛЬКО В КОНЦЕ) ---------------- */

    if (isLast) {

      for (const item of request.items.filter(i => i.item_type === 2)) {

        const createMEIPayload = [
          {
            material_estimate_id: item.material_estimate_id,
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

        console.log("CRE", createMEIPayload)

        const createMEIRes = await postRequest("/materialEstimateItems/create", createMEIPayload);

        if (!createMEIRes.success) {
          toast.error("Ошибка создания элемента сметы");
          return;
        }
        console.log("RES CREATE", createMEIRes)
        console.log("MEI CREATE ID", createMEIRes.data[0].id)

        if (!createMEIRes.data[0].id) {
          toast.error("Не удалось получить ID сметы");
          return;
        }
        else {
          // /* UPDATE REQUEST ITEM */
          const updateMRIPayload =
          {
            material_estimate_item_id: createMEIRes.data[0].id,
            price: item.price,
            coefficient: item.coefficient,
            currency: item.currency,
            currency_rate: item.currency_rate
          };

          console.log("UPDATE PL", updateMRIPayload)

          const updateItemsRes = await putRequest(`/materialRequestItems/update/${item.id}`, updateMRIPayload);
          console.log("RES UPDATE", updateItemsRes)

          if (!updateItemsRes.success) {
            toast.error("Ошибка обновления элементов заявки");
            return;
          }
        }


      }
    }

    /* ---------------- ПОДПИСЬ ---------------- */

    const payload = {
      [getApprovalField(stage)]: true,
      [getUserField(stage)]: user.id
    };

    const res = await putRequest(
      `/materialRequests/update/${requestId}`,
      payload
    );

    if (res.success) {
      loadRequests();
      toast.success("Заявка подписана");
    }

  };


  const getStatusesByTab = () => {
    if (tab === "new") return [1];
    if (tab === "active") return [2, 3];
    return [4, 5];
  };



  const miStatusStyles = {
    1: "bg-gray-500/10 text-gray-400",       // Создан
    2: "bg-yellow-500/10 text-yellow-400",   // Одобрено
    3: "bg-blue-500/10 text-blue-400",       // Частично заказано
    4: "bg-green-500/10 text-green-400",     // Полностью заказано
    5: "bg-red-500/10 text-red-400"          // Отменено
  };

  const itemTypeStyles = {
    1: "border-green-500/30",
    2: "border-orange-500/30"
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch);
  };

  return (

    <div className="space-y-4 text-white">

      {/* HEADER */}
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-blue-400" />
        <h1 className="text-lg font-semibold">
          Заявки: {getDictName("projectBlocks", blockId)}
        </h1>
      </div>

      {/* TABS */}
      <div className="flex gap-2">

        <button
          onClick={() => { setTab("new"); setPage(1); }}
          className={`flex-1 py-2 rounded ${tab === "new" ? "bg-blue-600" : "bg-gray-800"}`}
        >
          Новые
        </button>

        <button
          onClick={() => { setTab("active"); setPage(1); }}
          className={`flex-1 py-2 rounded ${tab === "active" ? "bg-blue-600" : "bg-gray-800"}`}
        >
          Одобрено
        </button>

        <button
          onClick={() => { setTab("done"); setPage(1); }}
          className={`flex-1 py-2 rounded ${tab === "done" ? "bg-blue-600" : "bg-gray-800"}`}
        >
          Завершенные
        </button>

      </div>

      {/* SEARCH */}
      <div className="flex gap-2">

        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm"
          />
        </div>

        <button
          onClick={handleSearch}
          className="px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
        >
          Go
        </button>

      </div>



      {requests.map(r => {

        const expanded = expandedId === r.id;

        return (

          <div
            key={r.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-blue-500 transition"
          >

            <div
              onClick={() => setExpandedId(expanded ? null : r.id)}
              className="cursor-pointer space-y-1"
            >

              {/* TOP */}
              <div className="flex justify-between items-center text-sm">

                <span className="font-semibold">
                  № {r.id}
                </span>

                <span className="text-[11px] text-gray-400">
                  {formatDateTime(r.created_at)}
                </span>

              </div>

              {/* STATUS + COUNT */}
              <div className="flex justify-between items-center text-[12px]">

                <span className="text-yellow-400 font-medium">
                  {getDictName("materialRequestStatuses", r.status)}
                </span>

                <span className="text-gray-400">
                  Позиций: {r.items?.length || 0}
                </span>

              </div>

              {/* WORKFLOW */}
              <div className="flex items-center gap-2 flex-wrap text-[11px]">

                {workflow.map(stage => {

                  const approved = r[getApprovalField(stage)];

                  return (
                    <div key={stage} className="flex items-center gap-1">

                      <div
                        className={`w-3 h-3 rounded-full ${approved ? "bg-green-500" : "bg-gray-600"
                          }`}
                      />

                      <span className="text-gray-400">
                        {roles[stage].label}
                      </span>

                    </div>
                  );

                })}

              </div>

            </div>

            {/* BUTTONS */}
            <div
              className="flex flex-wrap gap-1 mt-1"
              onClick={() => setExpandedId(expanded ? null : r.id)}
            >

              {workflow.map(stage => {

                if (!canApprove(stage, r)) return null;

                return (
                  <button
                    key={stage}
                    onClick={(e) => {
                      e.stopPropagation();
                      approveRequest(r.id, stage);
                    }}
                    className="px-2 py-[3px] bg-blue-600 hover:bg-blue-500 rounded text-[11px]"
                  >
                    {roles[stage].label}
                  </button>
                );

              })}

            </div>

            {/* ITEMS */}
            <div
              className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-1000 opacity-100 mt-2" : "max-h-0 opacity-0"
                }`}
            >
              <div className="space-y-2 border-t border-gray-800 pt-2">

                {r.items?.map(item => (

                  <div
                    key={item.id}
                    className={`bg-gray-800 border rounded p-2 text-xs ${itemTypeStyles[item.item_type] || "border-gray-700"}`}
                  >

                    {/* TOP LINE */}
                    <div className="flex justify-between items-start gap-2">

                      <span className="text-sm font-semibold text-gray-100 truncate">
                        {getDictName("materials", item.material_id)}
                      </span>

                      <span className="text-xs text-gray-300 whitespace-nowrap">
                        {item.quantity}{" "}
                        <span className="text-gray-500 text-[10px]">
                          {getDictName("unitsOfMeasure", item.unit_of_measure)}
                        </span>
                      </span>

                    </div>

                    {/* STAGE + STATUS */}
                    <div className="flex justify-between items-center mt-[2px]">

                      <span className="text-[10px] text-gray-400 truncate">

                        {getDictName("blockStages", item.stage_id)}

                        {item.subsection_id && (
                          <>
                            {" "}→ {getDictName("stageSubsections", item.subsection_id)}
                          </>
                        )}

                      </span>

                      <span
                        className={`text-[10px] px-2 py-[2px] rounded whitespace-nowrap ${miStatusStyles[item.status] || "bg-gray-500/10 text-gray-500"
                          }`}
                      >
                        {getDictName("materialRequestItemStatuses", item.status)}
                      </span>

                    </div>

                    {/* COMMENT */}
                    {item.comment && (
                      <div className="text-[10px] text-gray-500 mt-[2px]">
                        {item.comment}
                      </div>
                    )}

                    {checkToShowInputFields(item, r) && (

                      <div className="space-y-2">

                        {/* 🔥 1 СТРОКА — ЦЕНА + КОЭФФ */}
                        <div className="grid grid-cols-2 gap-2">

                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Цена"
                            value={item.price || ""}
                            onChange={numberHandler((val) =>
                              updateItemField(r.id, item.id, "price", val)
                            )}
                            className="w-full p-2 bg-gray-700 rounded text-xs"
                          />

                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Коэффициент"
                            value={
                              item.coefficient ??
                              dictionaries.materials?.find(m => m.id === item.material_id)?.coefficient ??
                              ""
                            }
                            onChange={numberHandler((val) =>
                              updateItemField(r.id, item.id, "coefficient", val)
                            )}
                            className="w-full p-2 bg-gray-700 rounded text-xs"
                          />

                        </div>

                        {/* 🔥 2 СТРОКА — ВАЛЮТА + КУРС */}
                        <div className="grid grid-cols-2 gap-2">

                          <select
                            value={item.currency ?? 1}
                            onChange={(e) => {
                              const currency = Number(e.target.value);
                              const rate = currency === 1 ? 1 : getRateByCurrency(currency);

                              updateItemField(r.id, item.id, "currency", currency);
                              updateItemField(r.id, item.id, "currency_rate", rate);
                            }}
                            className="w-full p-2 bg-gray-700 rounded text-xs"
                          >
                            {dictionaries.currencies?.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.code}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Курс"
                            value={
                              (item.currency ?? 1) === 1
                                ? 1
                                : item.currency_rate || ""
                            }
                            onChange={(e) =>
                              updateItemField(r.id, item.id, "currency_rate", Number(e.target.value))
                            }
                            disabled={(item.currency ?? 1) === 1}
                            className={`w-full p-2 rounded text-xs ${(item.currency ?? 1) === 1
                              ? "bg-gray-800 text-gray-500"
                              : "bg-gray-700"
                              }`}
                          />

                        </div>

                        {/* 🔥 3 СТРОКА — СМЕТА */}
                        <select
                          value={item.material_estimate_id || ""}
                          onChange={(e) =>
                            updateItemField(
                              r.id,
                              item.id,
                              "material_estimate_id",
                              Number(e.target.value)
                            )
                          }
                          className="w-full p-2 bg-gray-700 rounded text-xs"
                        >
                          {[...(dictionaries.materialEstimates || [])]
                            .sort((a, b) => a.block_id - b.block_id)
                            .map(est => (
                              <option key={est.id} value={est.id}>
                                {est.label}
                              </option>
                            ))}
                        </select>

                      </div>

                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        );

      })}



      {/* PAGINATION */}

      {pagination && (

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

      )}



      {/* CREATE BUTTON */}

      <button
        onClick={() =>
          navigate(`/projects/${projectId}/blocks/${blockId}/material-request-create`)
        }
        className="fixed bottom-20 right-8 w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center shadow-xl transition hover:scale-105"
      >
        <Plus size={28} className="text-white" />
      </button>

    </div>

  );

}