export const numberHandler = (callback) => {
    return (e) => {
        let val = e.target.value.replace(",", ".");

        // разрешаем только цифры и точку
        if (!/^[\d.]*$/.test(val)) return;

        // только одна точка
        const parts = val.split(".");
        if (parts.length > 2) return;

        callback(val);
    };
};

export const normalizeDecimalInput = (value) => {
    const normalized = String(value || "").replace(",", ".").replace(/[^\d.]/g, "");
    const [integerPart, ...decimalParts] = normalized.split(".");
    return decimalParts.length ? `${integerPart}.${decimalParts.join("")}` : integerPart;
};

export const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(String(value).replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
};

export const formatEditableNumber = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : String(value);
};
