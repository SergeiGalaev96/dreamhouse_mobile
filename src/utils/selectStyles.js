// utils/selectStyles.js

export const selectStyles = {
    control: (base, state) => ({
        ...base,
        backgroundColor: "#1f2937",
        borderColor: state.isFocused ? "#3b82f6" : "#374151",
        boxShadow: "none",
        color: "white"
    }),

    menu: (base) => ({
        ...base,
        backgroundColor: "#111827",
        border: "1px solid #374151"
    }),

    menuList: (base) => ({
        ...base,
        backgroundColor: "#111827"
    }),

    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? "#374151" : "#111827",
        color: "#f9fafb",
        cursor: "pointer"
    }),

    singleValue: (base) => ({
        ...base,
        color: "#f9fafb"
    }),

    placeholder: (base) => ({
        ...base,
        color: "#9ca3af"
    }),

    input: (base) => ({
        ...base,
        color: "#f9fafb"
    }),

    dropdownIndicator: (base) => ({
        ...base,
        color: "#9ca3af"
    }),

    indicatorSeparator: () => ({
        display: "none"
    })
};