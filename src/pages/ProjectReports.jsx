import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, FileSpreadsheet, FileText, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { getRequest } from "../api/request";
import { getAuthToken } from "../utils/authStorage";
import { reportsFallbackURLs } from "../api/axios";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { useTheme } from "../context/ThemeContext";
import { themeSurface, themeText } from "../utils/themeStyles";

const REPORT_OPTIONS = [
  { value: "form2", label: "Форма 2" },
  { value: "form29", label: "Форма 29" }
];

const REPORT_LABELS = {
  form2: "Форма 2",
  form29: "Форма 29"
};

const REPORT_FORMATS = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "docx", label: "Word", icon: FileText },
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet }
];

const getMonthRange = (monthValue) => {
  if (!monthValue) return null;

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return null;

  const firstDate = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0);

  return {
    dateFrom: firstDate.toISOString().slice(0, 10),
    dateTo: lastDate.toISOString().slice(0, 10)
  };
};

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

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
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

const saveNativeReport = async (blob, filename) => {
  const base64Data = await blobToBase64(blob);
  return Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Documents
  });
};

export default function ProjectReports() {
  const { projectId } = useParams();
  const { isDark } = useTheme();

  const [project, setProject] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  const [reportType, setReportType] = useState("form2");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState("");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    const loadInitialData = async () => {
      const [projectRes, dicts] = await Promise.all([
        getRequest(`/projects/getById/${projectId}`),
        loadDictionaries(["projectBlocks"])
      ]);

      if (projectRes?.success) {
        setProject(projectRes.data);
      }

      setDictionaries(dicts || {});
      const projectBlocks = (dicts?.projectBlocks || []).filter(
        (item) => Number(item.project_id) === Number(projectId)
      );
      if (projectBlocks[0]?.id) {
        setSelectedBlockId(String(projectBlocks[0].id));
      }
    };

    loadInitialData();
  }, [projectId]);

  const blocks = useMemo(
    () =>
      (dictionaries.projectBlocks || []).filter(
        (item) => Number(item.project_id) === Number(projectId)
      ),
    [dictionaries.projectBlocks, projectId]
  );

  const selectedBlock = useMemo(
    () => blocks.find((item) => Number(item.id) === Number(selectedBlockId)),
    [blocks, selectedBlockId]
  );

  const currentReportLabel = REPORT_LABELS[reportType] || "Отчет";

  const loadPreview = async () => {
    const range = getMonthRange(selectedMonth);
    const token = getAuthToken();

    if (!selectedBlockId || !range) {
      toast.error("Выберите блок и месяц");
      return;
    }

    try {
      setLoadingPreview(true);

      let html = "";
      let lastError = null;

      for (const url of reportsFallbackURLs()) {
        try {
          const reportUrl = `${url}/report/${reportType}?blockId=${Number(selectedBlockId)}&dateFrom=${range.dateFrom}&dateTo=${range.dateTo}&format=html`;
          const res = await fetch(reportUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            lastError = new Error(errorText || `HTTP ${res.status}`);
            continue;
          }

          html = await res.text();
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!html) {
        throw lastError || new Error("Report service is unavailable");
      }

      setPreviewHtml(html);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Ошибка формирования превью");
    } finally {
      setLoadingPreview(false);
    }
  };

  const downloadReport = async (format) => {
    const range = getMonthRange(selectedMonth);
    const token = getAuthToken();

    if (!selectedBlockId || !range) {
      toast.error("Выберите блок и месяц");
      return;
    }

    try {
      setDownloadingFormat(format);
      let res = null;
      let lastError = null;

      for (const url of reportsFallbackURLs()) {
        try {
          const reportUrl = `${url}/report/${reportType}?blockId=${Number(selectedBlockId)}&dateFrom=${range.dateFrom}&dateTo=${range.dateTo}&format=${format}`;
          res = await fetch(reportUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (res.ok) break;

          let errorText = "";
          try {
            errorText = await res.text();
          } catch {
            errorText = "";
          }

          lastError = new Error(errorText || `HTTP ${res.status}`);
        } catch (error) {
          lastError = error;
        }
      }

      if (!res?.ok) {
        throw lastError || new Error("Report service is unavailable");
      }

      const blob = await res.blob();
      const fallbackName = `${currentReportLabel} ${selectedBlock?.label || selectedBlockId} ${selectedMonth}.${format}`;
      const filename = getFilenameFromDisposition(
        res.headers.get("Content-Disposition"),
        fallbackName
      );

      if (Capacitor.isNativePlatform()) {
        await saveNativeReport(blob, filename);
        toast.success(`Файл сохранен: ${filename}`);
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        toast.success("Отчет скачан");
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Ошибка скачивания отчета");
    } finally {
      setDownloadingFormat("");
    }
  };

  const pageClass = `${themeText.page(isDark)} space-y-4 pb-24`;
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const compactFieldClass = isDark
    ? "w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-black focus:border-blue-500 focus:outline-none";
  const buttonClass =
    "rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-60";
  const mutedTextClass = themeText.secondary(isDark);
  const fieldLabelClass = `mb-1.5 block pl-1 text-[11px] font-medium uppercase tracking-[0.08em] ${mutedTextClass}`;

  return (
    <div className={pageClass}>
      <div className="px-1">
        <h1 className="text-lg font-semibold">{`Отчеты: ${project?.name || `Проект #${projectId}`}`}</h1>
      </div>

      <div className={`${panelClass} space-y-4`}>
        <div className="grid gap-2.5 md:grid-cols-3">
          <label className="block">
            <span className={fieldLabelClass}>Тип отчета</span>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value);
                setPreviewHtml("");
                setDownloadMenuOpen(false);
              }}
              className={compactFieldClass}
            >
              {REPORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={fieldLabelClass}>Блок</span>
            <select
              value={selectedBlockId}
              onChange={(e) => {
                setSelectedBlockId(e.target.value);
                setPreviewHtml("");
                setDownloadMenuOpen(false);
              }}
              className={compactFieldClass}
            >
              <option value="">Выберите блок</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={fieldLabelClass}>Месяц</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPreviewHtml("");
                setDownloadMenuOpen(false);
              }}
              className={compactFieldClass}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={loadPreview} disabled={loadingPreview} className={buttonClass}>
            {loadingPreview ? "Формирование..." : "Показать"}
          </button>

          <div className="relative">
            <button
              onClick={() => setDownloadMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600"
            >
              <FileSpreadsheet size={16} />
              Скачать
              <ChevronDown size={16} />
            </button>

            {downloadMenuOpen && (
              <div
                className={`absolute right-0 z-20 mt-2 min-w-[170px] overflow-hidden rounded-lg border shadow-lg ${
                  isDark ? "border-gray-700 bg-gray-900" : "border-slate-200 bg-white"
                }`}
              >
                {REPORT_FORMATS.map(({ format, label, icon: Icon }) => {
                  const loading = downloadingFormat === format;

                  return (
                    <button
                      key={format}
                      onClick={() => {
                        if (!loading) {
                          setDownloadMenuOpen(false);
                        }
                        downloadReport(format);
                      }}
                      disabled={loading}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-60 ${
                        isDark ? "text-white hover:bg-gray-800" : "text-black hover:bg-slate-50"
                      }`}
                      title={`Скачать ${label}`}
                    >
                      <Icon size={16} />
                      {loading ? "Скачивание..." : label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`${panelClass} space-y-3`}>
        <div className="flex items-center gap-2">
          <Search size={16} className="text-blue-500" />
          <h2 className="text-base font-semibold">Превью</h2>
        </div>

        {!previewHtml && (
          <div className={`text-sm ${mutedTextClass}`}>
            Выберите параметры и нажмите «Показать».
          </div>
        )}

        {previewHtml && (
          <div className="overflow-hidden rounded-xl border border-slate-300/20 bg-white">
            <iframe
              title={`${currentReportLabel} Preview`}
              srcDoc={previewHtml}
              className="h-[900px] w-full bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
}
