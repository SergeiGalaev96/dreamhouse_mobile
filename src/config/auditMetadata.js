export const AUDIT_ENTITY_META = {
  document: {
    title: "История документа",
    hiddenFields: ["id"],
    fields: {
      name: { label: "Название" },
      description: { label: "Описание" },
      location: { label: "Место" },
      price: { label: "Цена", type: "money" },
      deadline: { label: "Дедлайн", type: "date" },
      status: { label: "Статус", type: "mapped" },
      responsible_users: { label: "Ответственные", type: "list" }
    }
  },
  material: {
    title: "История материала",
    hiddenFields: ["id"],
    fields: {
      name: { label: "Название" },
      type: { label: "Группа", type: "mapped" },
      unit_of_measure: { label: "Ед. изм.", type: "mapped" },
      coefficient: { label: "Коэф." },
      description: { label: "Описание" }
    }
  },
  service: {
    title: "История услуги",
    hiddenFields: ["id"],
    fields: {
      name: { label: "Название" },
      service_type: { label: "Группа", type: "mapped" },
      unit_of_measure: { label: "Ед. изм.", type: "mapped" }
    }
  }
};
