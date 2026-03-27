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