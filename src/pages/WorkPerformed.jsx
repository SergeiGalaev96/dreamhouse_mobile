import { React, useEffect, useState, useContext } from "react";
import Select from "react-select";
import { useParams, useNavigate } from "react-router-dom";
import { baseURL } from "../api/axios";
import { getRequest, postRequest, putRequest, deleteRequest } from "../api/request";
import { formatDateTime, formatDateReverse } from "../utils/date";
import { numberHandler } from "../utils/numberInput";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { AuthContext } from "../auth/AuthContext";
import { FileIcon, defaultStyles } from "react-file-icon";
import { selectStyles } from "../utils/selectStyles";

import {
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  File,
  FileCode,
  FileAudio,
  FileVideo,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react"

import { Search, ClipboardList, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { act } from "react";

export default function WorkPerformed() {

  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const roleId = user?.role_id;

  const [acts, setActs] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});

  const [rates, setRates] = useState([]);

  const [actDocId, setActDocId] = useState([]);
  const [actFiles, setActFiles] = useState([]);
  const [openFilesId, setOpenFilesId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    loadActs();
  }, [page]);
  useEffect(() => {
    loadDicts();
    loadRates();
  }, []);

  const loadActs = async () => {
    const res = await postRequest("/workPerformed/search", {
      block_id: Number(blockId),
      code: search,
      page,
      size: 10
    });

    if (res.success) {

      // 🔥 грузим сметы
      // const dicts = await loadDictionaries(["materialEstimates"]);

      // const estimates = [...(dicts.materialEstimates || [])]
      //   .sort((a, b) => a.block_id - b.block_id);

      // const firstEstimateId = estimates[0]?.id || null;

      // 🔥 init сразу при установке
      const prepared = res.data.map(a => ({
        ...a,
        items: a.items.map(item => {

          if (item.item_type !== 2) return item;

          return {
            ...item,
            currency: item.currency ?? 1,
            currency_rate: item.currency_rate ?? null,
            // material_estimate_id:
            //   item.material_estimate_id ?? firstEstimateId
          };

        })
      }));
      setActs(prepared);
      console.log("ACTS", res.data)
      setPagination(res.pagination);
    }
  };

  const updateItemField = (actId, itemId, field, value) => {
    setActs(prev =>
      prev.map(a => {
        if (a.id !== actId) return a;
        return {
          ...a,
          items: a.items.map(item =>
            item.id === itemId
              ? { ...item, [field]: value }
              : item
          )
        };
      })
    );
  }

  const checkToShowInputFields = (item, act) => {
    if (item.item_type !== 2) return false;

    if (role === "planning_engineer" || role === "admin") {
      return !act.signed_by_planning_engineer;
    }

    return false;
  };

  const loadDicts = async () => {
    const dicts = await loadDictionaries([
      "unitsOfMeasure",
      "currencies",
      "projectBlocks",
      "blockStages",
      "stageSubsections",
      "services",
      "generalStatuses",
      "materialEstimates"
    ]);
    setDictionaries(dicts);
  };

  const getDictName = (dictName, id, field = "label") => {
    return dictionaries[dictName]?.find(x => x.id === Number(id))?.[field] || "";
  };
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

  const currencyOptions = getOptions("currencies");

  const loadRates = async () => {
    const res = await getRequest(
      "/currencyRates/getByDate/" + formatDateReverse(new Date())
    );
    if (res.success) setRates(res.data);
  };

  const getRateByCurrency = (currencyId) => {
    const rate = rates.find(r => r.currency_id === currencyId);
    return rate?.rate || "";
  };

  // FILES
  const loadFiles = async (actId) => {
    const docPayload = {
      entity_type: "workPerformed",
      entity_id: actId,
      page: 1,
      size: 100
    };

    let docId;

    const docs = await postRequest(`/documents/search`, docPayload);

    if (!docs.success) {
      toast.error("Ошибка получения документа");
      return;
    }

    if (!docs.data?.length) {
      const createDocPayload = {
        entity_type: "workPerformed",
        entity_id: actId,
        name: "Файлы Акта №" + actId,
        status: 3
      };

      const createDoc = await postRequest(`/documents/create`, createDocPayload);

      if (!createDoc.success) {
        toast.error("Ошибка создания папки файлов");
        return;
      }

      docId = createDoc.data.id;
    } else {
      docId = docs.data[0].id;
    }

    if (!docId) {
      console.error("docId undefined");
      return;
    }

    setActDocId(docId);

    const files = await getRequest(`/documentFiles/files/${docId}`);

    if (files.success) {
      setActFiles(files.data);
    } else {
      setActFiles([]);
    }
  };
  const handleUpload = async (e, actId) => {

    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {

      const formData = new FormData();

      // добавляем все файлы
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await postRequest(`/documentFiles/upload/${actDocId}`, formData);
      if (res.success) {
        toast.success("Файлы загружены");
        // обновляем список
        loadFiles(actId);
        // очистить input (важно)
        e.target.value = null;
      } else {
        toast.error(result.message || "Ошибка загрузки");
        console.log(result)
      }
    }
    catch (err) {
      console.error(err);
      toast.error("Ошибка загрузки");
    }
  };

  const getFileIcon = (file, size = 40) => {
    const name = (file.name || "").toLowerCase();

    // достаём расширение
    const ext = name.includes(".")
      ? name.split(".").pop()
      : "";

    // если нет стиля — fallback
    const style = defaultStyles[ext] || defaultStyles["txt"];

    return (
      <div style={{ width: size, height: size }}>
        <FileIcon
          extension={ext}
          {...style}
        />
      </div>
    );
  };

  const getFileUrl = (id) => `${baseURL()}/documentFiles/download/${id}`;

  const openPreview = (index) => {
    setPreviewIndex(index);
    setZoom(1);
  };

  const closePreview = () => {
    setPreviewIndex(null);
    setZoom(1);
  };

  const nextImage = () => {
    setPreviewIndex((prev) => (prev + 1) % actFiles.length);
  };

  const prevImage = () => {
    setPreviewIndex((prev) =>
      prev === 0 ? actFiles.length - 1 : prev - 1
    );
  };

  let startX = 0;

  const handleTouchStart = (e) => {
    startX = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;

    if (startX - endX > 50) nextImage();     // свайп влево
    if (endX - startX > 50) prevImage();     // свайп вправо
  };

  const handleWheel = (e) => {
    e.preventDefault();

    setZoom(prev => {
      const next = prev + (e.deltaY > 0 ? -0.2 : 0.2);
      return Math.min(Math.max(next, 1), 3);
    });
  };


  /* ---------------- ROLES ---------------- */
  const roles = {
    admin: { id: 1, label: "Админ" },
    foreman: { id: 4, label: "Прораб" },
    planning_engineer: { id: 10, label: "ПТО" },
    main_engineer: { id: 11, label: "Гл. инж" }
  };

  const role = Object.keys(roles).find(
    key => roles[key].id === roleId
  );

  /* ---------------- WORKFLOW ---------------- */
  const workflow = [
    "foreman",
    "planning_engineer",
    "main_engineer"
  ];

  const getField = (stage) => `signed_by_${stage}`;
  const getUserField = (stage) => `${stage}_user_id`;

  /* ---------------- APPROVE LOGIC ---------------- */

  const canApprove = (stage, act) => {

    const field = getField(stage);

    // уже подписано
    if (act[field]) return false;

    // админ может всё
    if (role === "admin") return true;

    // не своя роль
    if (role !== stage) return false;

    const index = workflow.indexOf(stage);

    // первый этап
    if (index === 0) return true;

    const prevStage = workflow[index - 1];

    return act[getField(prevStage)];
  };

  const isLastApproval = (act, stage) => {
    return workflow.every(s => {
      if (s === stage) return true;
      return act[getField(s)];
    });
  };
  const approveAct = async (id, stage) => {

    const act = acts.find(a => a.id === id);

    console.log("SIGN", act)

    /* ---------------- VALIDATION ---------------- */

    if (stage === "planning_engineer" || stage === "admin") {

      const invalid = act.items
        .filter(i => i.item_type === 2)
        .some(i => {
          if (!i.price) return true;
          if (!i.currency) return true;
          if ((i.currency ?? 1) !== 1 && !i.currency_rate) return true;
          return false;
        });

      if (invalid) {
        toast.error("Заполните все поля для доп работ!");
        return;
      }
    }

    /* ---------------- LAST APPROVAL ---------------- */

    const isLast = isLastApproval(act, stage);

    /* ---------------- CREATE ESTIMATE ITEMS ---------------- */

    if (isLast) {

      for (const item of act.items.filter(i => i.item_type === 2)) {

        const material_estimate_id = await findEstimateByBlock()

        const createPayload = [
          {
            material_estimate_id: material_estimate_id,
            stage_id: item.stage_id,
            subsection_id: item.subsection_id,
            item_type: 2,
            entry_type: 2,
            service_type: item.service_type,
            service_id: item.service_id,
            unit_of_measure: item.unit_of_measure,
            quantity_planned: item.quantity,
            // coefficient: item.coefficient,
            currency: item.currency,
            currency_rate: item.currency_rate,
            price: item.price,
            comment: item.comment || ""
          }
        ];

        console.log("CR BODY", createPayload)
        const createRes = await postRequest("/materialEstimateItems/create", createPayload);

        if (!createRes.success) {
          toast.error("Ошибка создания элемента сметы");
          return;
        }

        console.log("CR RES", createRes)

        const created = createRes.data?.[0];

        if (!created?.id) {
          toast.error("Не удалось получить ID сметы");
          return;
        }

        /* ---------------- UPDATE WORK PERFORMED ITEM ---------------- */
        const updatePayload = {
          material_estimate_item_id: created.id,
          price: item.price,
          coefficient: item.coefficient,
          currency: item.currency,
          currency_rate: item.currency_rate
        };

        console.log("UPD BODY", updatePayload)

        const updateRes = await putRequest(`/workPerformedItems/update/${item.id}`, updatePayload);

        console.log("UPD RES", updateRes)

        if (!updateRes.success) {
          toast.error("Ошибка обновления позиции акта");
          return;
        }
      }
    }

    /* ---------------- SIGN ---------------- */

    try {

      const payload = {
        [getField(stage)]: true,
        [getUserField(stage)]: user.id
      };

      const res = await putRequest(`/workPerformed/update/${id}`, payload);

      if (res.success) {
        toast.success("Подписано");
        loadActs();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка");
    }

  };

  const findEstimateByBlock = async () => {
    const est = dictionaries["materialEstimates"]?.find(x => x.block_id === Number(blockId));
    const est_id = est.id
    // console.log("EST ID", est_id)
    return est_id
  }



  /* ---------------- HELPERS ---------------- */
  const calcSum = (item) => {

    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const rate = Number(item.currency_rate) || 0;

    let sum = quantity * price;

    if (item.currency !== 1 && rate > 0) {
      sum *= rate;
    }

    return sum;

  };

  const calcTotal = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((acc, i) => {
      const sum = calcSum(i);
      return acc + (Number(sum) || 0);
    }, 0);
  };

  const itemTypeStyles = {
    1: "border-green-500/40",
    2: "border-orange-500/40"
  };

  /* ---------------- UI ---------------- */
  return (

    <div className="space-y-4 text-white pb-24">

      {/* HEADER */}
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-green-400" />
        <h1 className="text-lg font-semibold">
          Акты: {getDictName("projectBlocks", Number(blockId))}
        </h1>
      </div>

      {/* SEARCH */}
      <div className="flex gap-2">

        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm"
          />
        </div>

        <button
          onClick={() => {
            setPage(1);
            loadActs();
          }}
          className="px-4 bg-blue-600 rounded-lg text-sm"
        >
          Go
        </button>

      </div>

      {/* LIST */}
      {acts.map(a => {

        const expanded = expandedId === a.id;
        const total = calcTotal(a.items || []);

        return (
          <div
            key={a.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3"
          >
            {/* HEADER */}
            <div
              onClick={() => setExpandedId(expanded ? null : a.id)}
              className="cursor-pointer space-y-1"
            >

              <div className="flex justify-between text-sm">

                <span className="font-semibold">
                  {a.code || `Акт №${a.id}`}
                </span>

                <span className="text-[11px] text-gray-400">
                  {formatDateTime(a.created_at)}
                </span>

              </div>

              <div className="flex justify-between text-[12px]">

                <span className="text-gray-400 truncate">
                  {a.performed_person_name}
                </span>

                <span className="text-green-400 font-medium">
                  {total.toLocaleString()} Сом
                </span>

              </div>

              {/* WORKFLOW + STATUS */}
              <div className="flex justify-between items-center">

                <div className="flex items-center gap-2 flex-wrap text-[11px]">

                  {workflow.map(stage => {

                    const approved = a[getField(stage)];

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

                <span className="text-[11px] text-yellow-400 font-medium whitespace-nowrap ml-2">
                  {getDictName("generalStatuses", a.status)}
                </span>

              </div>

            </div>

            {/* BUTTONS */}
            <div
              className="flex flex-wrap gap-1 mt-2"
              onClick={() => setExpandedId(expanded ? null : a.id)}
            >

              {workflow.map(stage => {

                if (!canApprove(stage, a)) return null;

                return (
                  <button
                    key={stage}
                    onClick={(e) => {
                      e.stopPropagation();
                      approveAct(a.id, stage);
                    }}
                    className="px-2 py-[3px] bg-blue-600 rounded text-[11px] hover:bg-blue-500 transition"
                  >
                    {roles[stage].label}
                  </button>
                );

              })}

            </div>

            {/* ITEMS */}
            {expanded && (
              <div>

                <div className="flex justify-end mt-2">

                  <button className="text-xs px-2 py-1 bg-gray-800 rounded flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();

                      if (openFilesId === a.id) {
                        setOpenFilesId(null);
                      } else {
                        setOpenFilesId(a.id);
                        loadFiles(a.id);
                      }
                    }}
                  >
                    <ImageIcon size={14} /> Файлы
                  </button>

                </div>

                {openFilesId === a.id && (

                  <div className="mt-2 space-y-2 border-t border-gray-800 pt-2" >

                    {/* upload */}
                    <div className="flex justify-end">

                      <label className="text-xs px-2 py-1 bg-gray-800 rounded cursor-pointer">
                        📎 Добавить файл
                        <input
                          type="file"
                          multiple
                          onChange={(e) => handleUpload(e, a.id)}
                          className="hidden"
                        />
                      </label>

                    </div>

                    {/* пусто */}
                    {actFiles.length === 0 && (
                      <div className="text-[11px] text-gray-500">
                        Нет файлов
                      </div>
                    )}

                    {/* список */}
                    <div className="grid grid-cols-3 gap-2">

                      {actFiles.map((file, index) => {

                        const isImage = file.mime_type?.startsWith("image");

                        return (
                          <div
                            key={file.id}
                            className="bg-gray-800 rounded p-2 text-xs space-y-1 flex flex-col items-center"
                          >

                            {/* IMAGE */}
                            {isImage ? (
                              <img
                                src={getFileUrl(file.id)}
                                onClick={() => openPreview(index)}
                                className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80"
                              />
                            ) : (
                              <div className="h-24 w-full flex flex-col items-center justify-between border border-gray-700 rounded p-2">

                                {/* 📄 ИКОНКА (сверху) */}
                                <div className="text-gray-300 mt-1">
                                  {getFileIcon(file, 36)}
                                </div>

                                {/* 🔥 КНОПКИ (внизу) */}
                                <div className="flex gap-4 mb-0">

                                  <button
                                    onClick={async () => {
                                      const confirmDelete = window.confirm("Удалить файл?");
                                      if (!confirmDelete) return;

                                      const res = await deleteRequest(`/documentFiles/${file.id}`);

                                      if (res.success) {
                                        toast.success("Удалено");
                                        loadFiles(a.id);
                                      } else {
                                        toast.error(res.message || "Ошибка удаления");
                                      }
                                    }}
                                    className="text-red-400 hover:text-red-300 hover:scale-110 transition"
                                  >
                                    <Trash2 size={20} />
                                  </button>

                                  <button
                                    onClick={() => window.open(getFileUrl(file.id))}
                                    className="text-blue-400 hover:text-blue-300 hover:scale-110 transition"
                                  >
                                    <Download size={20} />
                                  </button>
                                </div>

                              </div>
                            )}
                            {/* NAME */}
                            <span className="block truncate text-gray-200 text-[10px] w-full text-center">
                              {file.name || `Файл #${file.id}`}
                            </span>

                          </div>
                        );
                      })}

                    </div>
                    {previewImage && (
                      <div
                        onClick={() => setPreviewImage(null)}
                        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                      >
                        <img
                          src={previewImage}
                          className="max-w-[90%] max-h-[90%] rounded"
                        />
                      </div>
                    )}

                    {previewIndex !== null && (() => {

                      const file = actFiles[previewIndex];
                      const isImage = file.mime_type?.startsWith("image");

                      // ❌ если не картинка — вообще не показываем preview
                      if (!isImage) return null;

                      const fileUrl = getFileUrl(file.id);

                      return (
                        <div
                          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
                          onClick={closePreview}
                          onTouchStart={handleTouchStart}
                          onTouchEnd={handleTouchEnd}
                        >

                          {/* IMAGE */}
                          <img
                            src={fileUrl}
                            onClick={(e) => e.stopPropagation()}
                            onWheel={handleWheel}
                            style={{ transform: `scale(${zoom})` }}
                            className="max-w-[90%] max-h-[90%] transition-transform"
                          />

                          {/* LEFT */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              prevImage();
                            }}
                            className="absolute left-4 text-white"
                          >
                            <ChevronLeft size={36} />
                          </button>

                          {/* RIGHT */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              nextImage();
                            }}
                            className="absolute right-4 text-white"
                          >
                            <ChevronRight size={36} />
                          </button>

                          {/* ACTIONS */}
                          <div className="absolute top-4 right-4 flex gap-4">

                            <button
                              onClick={async (e) => {
                                e.stopPropagation();

                                const confirmDelete = window.confirm("Удалить файл?");
                                if (!confirmDelete) return;

                                const res = await deleteRequest(`/documentFiles/${file.id}`);

                                if (res.success) {
                                  toast.success("Удалено");
                                  closePreview();
                                  loadFiles(openFilesId);
                                } else {
                                  toast.error(res.message || "Ошибка удаления");
                                }
                              }}
                              className="bg-red-600/80 p-3 rounded hover:bg-red-600"
                            >
                              <Trash2 size={22} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(fileUrl);
                              }}
                              className="bg-black/50 p-3 rounded hover:bg-black/70"
                            >
                              <Download size={22} />
                            </button>

                          </div>

                          {/* CLOSE */}
                          <button
                            onClick={closePreview}
                            className="absolute top-4 left-4 text-white"
                          >
                            <X size={28} />
                          </button>

                        </div>
                      );
                    })()}

                  </div>

                )}

                <div className="mt-3 space-y-2 border-t border-gray-800 pt-3">
                  {a.items?.map(item => {
                    const sum = calcSum(item);
                    return (
                      <div
                        key={item.id}
                        className={`bg-gray-800 border rounded-lg p-3 text-xs transition ${itemTypeStyles[item.item_type] || "border-gray-700"
                          }`}
                      >

                        {/* TOP LINE */}
                        <div className="flex justify-between items-start gap-2 mb-1">

                          <span className="text-sm font-semibold text-gray-100 truncate">
                            {getDictName("services", item.service_id) || "Услуга"}
                          </span>

                          <span className="text-xs text-gray-300 whitespace-nowrap">
                            {item.quantity}{" "}
                            <span className="text-gray-500 text-[10px]">
                              {getDictName("unitsOfMeasure", item.unit_of_measure)}
                            </span>
                          </span>

                        </div>

                        {/* STAGE */}
                        <div className="flex justify-between items-center mb-1">

                          <span className="text-[10px] text-gray-400 truncate">
                            {getDictName("blockStages", item.stage_id)}

                            {item.subsection_id && (
                              <> → {getDictName("stageSubsections", item.subsection_id)}</>
                            )}
                          </span>

                        </div>

                        {/* PRICE + SUM */}
                        <div className="flex justify-between">

                          <span className="text-[10px] text-gray-400">

                            {item.price && (
                              <>
                                {item.price}{" "}
                                {getDictName("currencies", item.currency, "code")}
                              </>
                            )}

                            {item.currency_rate > 0 && item.currency !== 1 && (
                              <> | курс: {item.currency_rate}</>
                            )}

                          </span>

                          <span className="text-green-300 text-[12px] font-semibold">
                            {sum.toLocaleString()} Сом
                          </span>

                        </div>

                        {/* COMMENT */}
                        {item.comment && (
                          <div className="text-[10px] text-gray-500 mt-1">
                            {item.comment}
                          </div>
                        )}

                        {checkToShowInputFields(item, a) && (

                          <div className="space-y-2 mt-2">

                            {/* 🔥 1 СТРОКА — ЦЕНА */}
                            <input
                              type="text"
                              placeholder="Цена"
                              value={item.price || ""}
                              onChange={numberHandler((val) =>
                                updateItemField(a.id, item.id, "price", val)
                              )}
                              className="w-full p-2 bg-gray-700 rounded text-xs"
                            />

                            {/* 🔥 2 СТРОКА — ВАЛЮТА + КУРС */}
                            <div className="grid grid-cols-2 gap-2">

                              <Select
                                styles={selectStyles}
                                options={currencyOptions}
                                value={currencyOptions.find(
                                  c => c.value === (item.currency ?? 1)
                                )}
                                onChange={(v) => {
                                  const currency = v?.value || 1;
                                  const rate = currency === 1 ? 1 : getRateByCurrency(currency);

                                  updateItemField(a.id, item.id, "currency", currency);
                                  updateItemField(a.id, item.id, "currency_rate", rate);
                                }}
                                placeholder="Валюта"
                                isSearchable={false}
                              />

                              <input
                                type="text"
                                placeholder="Курс"
                                value={
                                  (item.currency ?? 1) === 1
                                    ? 1
                                    : item.currency_rate || ""
                                }

                                onChange={numberHandler((val) =>
                                  updateItemField(a.id, item.id, "currency_rate", val)
                                )}
                                disabled={(item.currency ?? 1) === 1}
                                className={`w-full p-2 rounded text-xs ${(item.currency ?? 1) === 1
                                  ? "bg-gray-800 text-gray-500"
                                  : "bg-gray-700"
                                  }`}
                              />

                            </div>

                            {/* 🔥 3 СТРОКА — СМЕТА */}
                            {/* <select
                              value={item.material_estimate_id || ""}
                              onChange={(e) =>
                                updateItemField(
                                  a.id,
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
                            </select> */}

                          </div>

                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* CREATE */}
      <button
        onClick={() =>
          navigate(`/projects/${projectId}/blocks/${blockId}/work-performed-create`)
        }
        className="fixed bottom-20 right-8 w-16 h-16 rounded-full bg-green-600 flex items-center justify-center shadow-xl"
      >
        <Plus size={28} className="text-white" />
      </button>

    </div>

  );

}