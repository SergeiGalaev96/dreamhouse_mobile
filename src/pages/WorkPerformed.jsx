import { React, useEffect, useState, useContext } from "react";
import Select from "react-select";
import { useParams, useNavigate } from "react-router-dom";
import { baseURL, reportsFallbackURLs } from "../api/axios";
import { getRequest, postRequest, putRequest, deleteRequest } from "../api/request";
import { formatDateTime, formatDateReverse } from "../utils/date";
import { numberHandler } from "../utils/numberInput";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { AuthContext } from "../auth/AuthContext";
import { getAuthToken } from "../utils/authStorage";
import { useTheme } from "../context/ThemeContext";
import { FileIcon, defaultStyles } from "react-file-icon";
import { selectStyles } from "../utils/selectStyles";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import PullToRefresh from "../components/PullToRefresh";

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
  ChevronDown,
  X,
  Upload
} from "lucide-react"

import { Search, ClipboardList, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { act } from "react";

export default function WorkPerformed() {

  const { projectId, blockId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const roleId = user?.role_id;

  const [acts, setActs] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [hideTitle, setHideTitle] = useState(false);

  const [rates, setRates] = useState([]);

  const [actDocId, setActDocId] = useState([]);
  const [actFiles, setActFiles] = useState([]);
  const [openFilesId, setOpenFilesId] = useState(null);
  const [openReportFormatsId, setOpenReportFormatsId] = useState(null);
  const [downloadingReportKey, setDownloadingReportKey] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [zoom, setZoom] = useState(1);
  const previewFiles = actFiles.filter((file) => file.mime_type?.startsWith("image"));

  useEffect(() => {
    loadActs();
  }, [page]);
  useEffect(() => {
    loadDicts();
    loadRates();
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

  const loadActs = async () => {
    const res = await postRequest("/workPerformed/search", {
      block_id: Number(blockId),
      code: search,
      page,
      size: 10
    });

    if (res.success) {

      // рџ”Ґ РіСЂСѓР·РёРј СЃРјРµС‚С‹
      // const dicts = await loadDictionaries(["materialEstimates"]);

      // const estimates = [...(dicts.materialEstimates || [])]
      //   .sort((a, b) => a.block_id - b.block_id);

      // const firstEstimateId = estimates[0]?.id || null;

      // рџ”Ґ init СЃСЂР°Р·Сѓ РїСЂРё СѓСЃС‚Р°РЅРѕРІРєРµ
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

  const updateActField = (actId, field, value) => {
    setActs((prev) =>
      prev.map((act) => (act.id === actId ? { ...act, [field]: value } : act))
    );
  };

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

    docId = docs.data?.[0]?.id;

    if (!docId) {
      setActDocId(null);
      setActFiles([]);
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
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await postRequest(`/documentFiles/upload/${actDocId}`, formData);
      if (res.success) {
        toast.success("Файлы загружены");
        loadFiles(actId);
        e.target.value = null;
      } else {
        toast.error(res.message || "Ошибка загрузки");
        console.log(res)
      }
    }
    catch (err) {
      console.error(err);
      toast.error("Ошибка загрузки");
    }
  };

  const getFileIcon = (file, size = 40) => {
    const name = (file.name || "").toLowerCase();

    const ext = name.includes(".")
      ? name.split(".").pop()
      : "";

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
  const reportFormats = [
    { format: "pdf", label: "PDF", icon: FileText },
    { format: "docx", label: "Word", icon: FileText },
    { format: "xlsx", label: "Excel", icon: FileSpreadsheet }
  ];

  const getFilenameFromDisposition = (disposition, fallback) => {
    if (!disposition) return fallback;

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return fallback;
      }
    }

    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
    return filenameMatch?.[1] || fallback;
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to convert blob"));
          return;
        }

        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const saveNativeReport = async (blob, filename) => {
    const base64Data = await blobToBase64(blob);
    return Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents
    });
  };

  const downloadWorkPerformedReport = async (actId, format) => {
    const token = getAuthToken();
    const key = `${actId}-${format}`;

    try {
      setDownloadingReportKey(key);

      let res = null;
      let lastError = null;

      for (const url of reportsFallbackURLs()) {
        try {
          res = await fetch(`${url}/report/workPerformed/${actId}?format=${format}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (res.ok) break;
          lastError = new Error(`HTTP ${res.status}`);
        } catch (e) {
          lastError = e;
        }
      }

      if (!res?.ok) {
        throw lastError || new Error("Report service is unavailable");
      }

      const blob = await res.blob();
      const fallbackName = `Акт вып. работ №${actId}.${format}`;
      const filename = getFilenameFromDisposition(
        res.headers.get("Content-Disposition"),
        fallbackName
      );

      if (Capacitor.isNativePlatform()) {
        await saveNativeReport(blob, filename);
        toast.success(`Файл сохранен: ${filename}`);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast.success("Отчет скачан");
      }
      setOpenReportFormatsId(null);
    } catch (e) {
      console.error(e);
      toast.error("Ошибка скачивания отчета");
    } finally {
      setDownloadingReportKey(null);
    }
  };

  const openPreview = (index) => {
    setPreviewIndex(index);
    setZoom(1);
  };

  const closePreview = () => {
    setPreviewIndex(null);
    setZoom(1);
  };

  const nextImage = () => {
    setPreviewIndex((prev) => (prev + 1) % previewFiles.length);
  };

  const prevImage = () => {
    setPreviewIndex((prev) =>
      prev === 0 ? previewFiles.length - 1 : prev - 1
    );
  };

  let startX = 0;

  const handleTouchStart = (e) => {
    startX = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;

    if (startX - endX > 50) nextImage();     // СЃРІР°Р№Рї РІР»РµРІРѕ
    if (endX - startX > 50) prevImage();     // СЃРІР°Р№Рї РІРїСЂР°РІРѕ
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

    // СѓР¶Рµ РїРѕРґРїРёСЃР°РЅРѕ
    if (act[field]) return false;

    // Р°РґРјРёРЅ РјРѕР¶РµС‚ РІСЃС‘
    if (role === "admin") return true;

    // РЅРµ СЃРІРѕСЏ СЂРѕР»СЊ
    if (role !== stage) return false;

    const index = workflow.indexOf(stage);

    // РїРµСЂРІС‹Р№ СЌС‚Р°Рї
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
        [getUserField(stage)]: user.id,
        advance_payment:
          act.advance_payment === "" || act.advance_payment == null
            ? null
            : Number(act.advance_payment)
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

  const calcAdvancePayment = (act) => Number(act?.advance_payment) || 0;

  const calcRemaining = (act) => calcTotal(act?.items || []) - calcAdvancePayment(act);

  const itemTypeStyles = {
    1: "border-green-500/40",
    2: "border-orange-500/40"
  };

  const pageClass = isDark ? "space-y-4 text-white pb-24" : "space-y-4 text-black pb-24";
  const inputClass = isDark
    ? "w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-white"
    : "w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-black";
  const cardClass = isDark
    ? "bg-gray-900 border border-gray-800 rounded-lg p-3"
    : "bg-white border border-slate-200 rounded-lg p-3 shadow-sm";
  const menuClass = isDark
    ? "absolute right-0 top-8 z-20 w-32 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
    : "absolute right-0 top-8 z-20 w-32 bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden";
  const pagerButtonClass = isDark
    ? "px-3 py-1 bg-gray-800 rounded text-white"
    : "px-3 py-1 bg-white border border-slate-300 rounded text-black";
  const stickyClass = isDark
    ? "sticky z-30 -mx-4 border-b border-gray-900 bg-gray-950 px-4 pb-2 pt-0"
    : "sticky z-30 -mx-4 border-b border-gray-300 bg-white px-4 pb-2 pt-0";

  /* ---------------- UI ---------------- */
  return (

    <div className={pageClass}>

      <div className={`select-none transition-all duration-200 ${hideTitle ? "mb-0 max-h-0 overflow-hidden opacity-0" : "mb-4 max-h-12 opacity-100"}`}>
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-green-500" />
          <h1 className="text-lg font-semibold">
            Акты: {getDictName("projectBlocks", Number(blockId))}
          </h1>
        </div>
      </div>

      <div
        className={stickyClass}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className={inputClass}
            />
          </div>

          <button
            onClick={() => {
              setPage(1);
              loadActs();
            }}
            className="px-4 bg-blue-600 rounded-lg text-sm text-white"
          >
            Go
          </button>
        </div>

      </div>

      {/* LIST */}
      <PullToRefresh className="mt-3" contentClassName="space-y-1" onRefresh={loadActs}>
        {acts.map(a => {

          const expanded = expandedId === a.id;
          const total = calcTotal(a.items || []);
          const advancePayment = calcAdvancePayment(a);
          return (
            <div
              key={a.id}
              className={cardClass}
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

                  <span className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {formatDateTime(a.created_at)}
                  </span>

                </div>

                <div className="flex justify-between text-[12px]">

                  <span className={`${isDark ? "text-gray-400" : "text-gray-600"} truncate`}>
                    {a.performed_person_name}
                  </span>

                  <div className="text-right">
                    <div className="text-green-500 font-medium">
                      {total.toLocaleString()} Сом
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      Аванс: {advancePayment.toLocaleString()} Сом
                    </div>
                  </div>

                </div>

                {/* WORKFLOW + STATUS */}
                <div className="flex justify-between items-center">

                  <div className="flex items-center gap-2 flex-wrap text-[11px]">

                    {workflow.map(stage => {

                      const approved = a[getField(stage)];

                      return (
                        <div key={stage} className="flex items-center gap-1">

                          <div
                            className={`w-3 h-3 rounded-full ${approved ? "bg-green-500" : isDark ? "bg-gray-600" : "bg-slate-300"
                              }`}
                          />

                          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
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
                      className="px-2 py-[3px] bg-blue-600 rounded text-[11px] text-white hover:bg-blue-500 transition"
                    >
                      {roles[stage].label}
                    </button>
                  );

                })}

              </div>

              {/* ITEMS */}
              {expanded && (
                <div>
                  <div className="flex justify-end mt-2 gap-2 relative">

                    <div className="relative">
                      <button
                        className="text-xs px-2 py-1 bg-emerald-700 rounded flex items-center gap-1 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenReportFormatsId(openReportFormatsId === a.id ? null : a.id);
                        }}
                      >
                        <Download size={14} /> Отчет <ChevronDown size={12} />
                      </button>

                      {openReportFormatsId === a.id && (
                        <div
                          className={menuClass}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {reportFormats.map(({ format, label, icon: Icon }) => {
                            const key = `${a.id}-${format}`;
                            const loading = downloadingReportKey === key;

                            return (
                              <button
                                key={format}
                                disabled={loading}
                                onClick={() => downloadWorkPerformedReport(a.id, format)}
                                className={`w-full px-3 py-2 text-left text-xs disabled:opacity-60 flex items-center gap-2 ${isDark ? "hover:bg-gray-800" : "hover:bg-slate-100"}`}
                              >
                                <Icon size={14} />
                                {loading ? "Скачивание..." : label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      className={isDark
                        ? "text-xs px-2 py-1 bg-gray-800 rounded flex items-center gap-1"
                        : "text-xs px-2 py-1 border border-slate-300 bg-white rounded flex items-center gap-1"}
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

                    <div className={`mt-2 space-y-2 border-t pt-2 ${isDark ? "border-gray-800" : "border-slate-200"}`}>

                      <div className="flex justify-end">
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500">
                          <Upload size={14} /> Добавить
                          <input
                            type="file"
                            multiple
                            onChange={(e) => handleUpload(e, a.id)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {actFiles.length === 0 && (
                        <div className={`rounded-lg border border-dashed p-4 text-center text-xs ${isDark
                          ? "border-gray-800 bg-gray-900/60 text-gray-500"
                          : "border-slate-300 bg-white text-slate-500"
                          }`}>
                          Нет файлов
                        </div>
                      )}

                      {actFiles.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {actFiles.map((file) => {
                            const isImage = file.mime_type?.startsWith("image");
                            const imageIndex = isImage
                              ? previewFiles.findIndex((previewFile) => previewFile.id === file.id)
                              : -1;

                            return (
                              <div
                                key={file.id}
                                className={`${isDark ? "border-gray-800 bg-gray-900" : "border-slate-200 bg-white"} flex h-[140px] w-full flex-col rounded-xl border p-2`}
                              >
                                <div className={`flex h-[70px] items-center justify-center overflow-hidden rounded-lg ${isDark ? "bg-gray-950" : "bg-slate-100"}`}>
                                  {isImage ? (
                                    <img
                                      src={getFileUrl(file.id)}
                                      onClick={() => openPreview(imageIndex)}
                                      className="h-full w-full cursor-pointer object-contain"
                                    />
                                  ) : (
                                    getFileIcon(file, 42)
                                  )}
                                </div>

                                <div className={`mt-1 line-clamp-2 text-[11px] ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                  {file.name || `Файл #${file.id}`}
                                </div>

                                <div className="mt-auto flex items-center justify-between px-1 pt-1">
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
                                    className="flex items-center justify-center rounded-md bg-red-600/20 p-1.5 text-red-500"
                                  >
                                    <Trash2 size={16} />
                                  </button>

                                  <button
                                    onClick={() => window.open(getFileUrl(file.id))}
                                    className="flex items-center justify-center rounded-md bg-blue-600/20 p-1.5 text-blue-400"
                                  >
                                    <Download size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {previewIndex !== null && (() => {

                        const file = previewFiles[previewIndex];
                        if (!file) return null;
                        const isImage = file.mime_type?.startsWith("image");
                        if (!isImage) return null;

                        const fileUrl = getFileUrl(file.id);

                        return (
                          <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
                            onClick={closePreview}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                          >
                            <img
                              src={fileUrl}
                              onClick={(e) => e.stopPropagation()}
                              onWheel={handleWheel}
                              style={{ transform: `scale(${zoom})` }}
                              className="max-h-[88vh] max-w-[92vw] rounded-xl transition-transform"
                            />

                            {previewFiles.length > 1 && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    prevImage();
                                  }}
                                  className="absolute left-3 rounded-full bg-black/50 p-3 text-white"
                                >
                                  <ChevronLeft size={28} />
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    nextImage();
                                  }}
                                  className="absolute right-3 rounded-full bg-black/50 p-3 text-white"
                                >
                                  <ChevronRight size={28} />
                                </button>
                              </>
                            )}

                            <div className="absolute right-4 top-4 flex gap-4">
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
                                className="rounded bg-red-600/80 p-3 hover:bg-red-600"
                              >
                                <Trash2 size={22} />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(fileUrl);
                                }}
                                className="rounded bg-black/50 p-3 hover:bg-black/70"
                              >
                                <Download size={22} />
                              </button>
                            </div>

                            <button
                              onClick={closePreview}
                              className="absolute left-4 top-4 rounded-full bg-black/50 p-3 text-white"
                            >
                              <X size={22} />
                            </button>
                          </div>
                        );
                      })()}

                    </div>

                  )}

                  <div className={`mt-3 space-y-2 border-t pt-3 ${isDark ? "border-gray-800" : "border-slate-200"}`}>
                    {a.items?.map(item => {
                      const sum = calcSum(item);
                      return (
                        <div
                          key={item.id}
                          className={`${isDark ? "bg-gray-800" : "bg-slate-100"} border rounded-lg p-3 text-xs transition ${itemTypeStyles[item.item_type] || (isDark ? "border-gray-700" : "border-slate-300")
                            }`}
                        >

                          {/* TOP LINE */}
                          <div className="flex justify-between items-start gap-2 mb-1">

                            <span className={`text-sm font-semibold truncate ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                              {getDictName("services", item.service_id) || "Услуга"}
                            </span>

                            <span className={`text-xs whitespace-nowrap ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                              {item.quantity}{" "}
                              <span className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                                {getDictName("unitsOfMeasure", item.unit_of_measure)}
                              </span>
                            </span>

                          </div>

                          {/* STAGE */}
                          <div className="flex justify-between items-center mb-1">

                            <span className={`text-[10px] truncate ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              {getDictName("blockStages", item.stage_id)}

                              {item.subsection_id && (
                                <> в†’ {getDictName("stageSubsections", item.subsection_id)}</>
                              )}
                            </span>

                          </div>

                          {/* PRICE + SUM */}
                          <div className="flex justify-between">

                            <span className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-600"}`}>

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

                            <span className="text-green-500 text-[12px] font-semibold">
                              {sum.toLocaleString()} Сом
                            </span>

                          </div>

                          {/* COMMENT */}
                          {item.comment && (
                            <div className={`text-[10px] mt-1 ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                              {item.comment}
                            </div>
                          )}

                          {checkToShowInputFields(item, a) && (

                            <div className="mt-2 space-y-2">

                              {/* Цена */}
                              <input
                                type="text"
                                placeholder="Цена"
                                value={item.price || ""}
                                onChange={numberHandler((val) =>
                                  updateItemField(a.id, item.id, "price", val)
                                )}
                                className={isDark ? "w-full p-2 bg-gray-700 rounded text-xs text-white" : "w-full p-2 bg-white border border-slate-300 rounded text-xs text-black"}
                              />

                              {/* Валюта и курс */}
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
                                    ? isDark ? "bg-gray-800 text-gray-500" : "bg-slate-100 text-gray-500 border border-slate-300"
                                    : isDark ? "bg-gray-700 text-white" : "bg-white text-black border border-slate-300"
                                    }`}
                                />

                              </div>

                              {/* Смета */}
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
      </PullToRefresh>

      {/* PAGINATION */}
      {pagination && (

        <div className="flex justify-center gap-3 mt-6">

          <button
            disabled={!pagination.hasPrev}
            onClick={() => setPage(page - 1)}
            className={pagerButtonClass}
          >
            Назад
          </button>

          <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
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
